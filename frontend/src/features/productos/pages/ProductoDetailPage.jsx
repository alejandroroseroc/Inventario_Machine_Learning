import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../../../styles/productos.css";
import { lotesService } from "../../lotes/service";
import { movimientosService } from "../../movimientos/service";
import { productoService } from "../service";

export default function ProductoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  const [prod, setProd] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [porVencer, setPorVencer] = useState([]);

  // formulario de edición del producto
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    categoria: "C",
    punto_reorden: 0,
    valor_unitario: 0,
  });

  // ENTRADA RÁPIDA (auto-lote + escáner/teclado)
  const [entradaForm, setEntradaForm] = useState({
    scan: "",
    fecha_caducidad: "",
    cantidad: 0,
  });

  // Movimientos (salida/entrada/ajuste manual)
  const [movForm, setMovForm] = useState({
    tipo: "salida",
    cantidad: 1,
    lote_id: "",
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const p = await productoService.getById(id);
        setProd(p);
        setForm({
          codigo: p.codigo ?? "",
          nombre: p.nombre ?? "",
          categoria: p.categoria ?? "C",
          punto_reorden: p.punto_reorden ?? 0,
          valor_unitario: Number(p.valor_unitario ?? 0),
        });

        const [f, ls, pv] = await Promise.all([
          productoService.forecast(id).catch(() => null),
          lotesService.listByProducto(id).catch(() => []),
          lotesService.porVencer({ productoId: id, dias: 60 }).catch(() => []),
        ]);
        setForecast(f);
        setLotes(ls || []);
        setPorVencer(pv.items ?? []);
      } catch {
        setError("No se pudo cargar el producto.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const refreshLotes = async () => {
    const ls = await lotesService.listByProducto(id).catch(() => []);
    setLotes(ls || []);
    const pv = await lotesService.porVencer({ productoId: id, dias: 60 }).catch(() => []);
    setPorVencer(pv.items ?? []);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({
      ...s,
      [name]: name === "valor_unitario" || name === "punto_reorden" ? Number(value) : value,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await productoService.update(id, form);
      setProd(updated);
    } catch {
      alert("Error guardando cambios");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar este producto? Esta acción es irreversible.")) return;
    setRemoving(true);
    try {
      await productoService.remove(id);
      navigate("/productos");
    } catch {
      alert("No se pudo eliminar");
    } finally {
      setRemoving(false);
    }
  };

  // Crea o reutiliza lote (por número o caducidad)
  const ensureLoteIdInline = async ({ numeroLote, fechaCaducidad, codigoBarras }) => {
    const current = await lotesService.listByProducto(id).catch(() => []);
    let found = null;
    if (numeroLote) found = (current || []).find((l) => l.numero_lote === numeroLote);
    if (!found && fechaCaducidad) {
      found = (current || []).find((l) => l.fecha_caducidad === fechaCaducidad);
    }
    if (found) return found.id;

    const basePayload = { producto: Number(id), fecha_caducidad: fechaCaducidad, stock_lote: 0 };
    try {
      const created = await lotesService.create({
        ...basePayload,
        numero_lote: numeroLote || null,
        codigo_barras: codigoBarras || null,
      });
      return created.id;
    } catch {
      const created2 = await lotesService.create(basePayload);
      return created2.id;
    }
  };

  const entradaRapida = async () => {
    const cantidad = Number(entradaForm.cantidad);
    if (cantidad <= 0) return alert("Cantidad > 0");
    if (!entradaForm.fecha_caducidad) return alert("Indica la fecha de caducidad");

    try {
      const numeroLote = entradaForm.scan?.trim() || null;
      const loteId = await ensureLoteIdInline({
        numeroLote,
        fechaCaducidad: entradaForm.fecha_caducidad,
        codigoBarras: entradaForm.scan || null,
      });

      await movimientosService.create({
        producto: Number(id),
        tipo: "entrada",
        cantidad,
        lote: loteId,
      });

      await refreshLotes();
      setEntradaForm({ scan: "", fecha_caducidad: "", cantidad: 0 });
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar la entrada");
    }
  };

  const registrarMovimiento = async () => {
    const cantidad = Number(movForm.cantidad);
    if (cantidad <= 0) return alert("Cantidad debe ser > 0");
    try {
      await movimientosService.create({
        producto: Number(id),
        tipo: movForm.tipo,
        cantidad,
        lote: movForm.lote_id ? Number(movForm.lote_id) : undefined,
      });

      const f = await productoService.forecast(id).catch(() => null);
      setForecast(f);
      await refreshLotes();
      setMovForm({ tipo: "salida", cantidad: 1, lote_id: "" });
    } catch (e) {
      console.error("Error mov:", e?.payload || e);
      alert((e?.payload && (e.payload.detail || JSON.stringify(e.payload))) || "No se pudo registrar el movimiento");
    }
  };

  if (loading) return <div className="page"><p>Cargando…</p></div>;
  if (error) return <div className="page"><div className="alert alert--error">{error}</div></div>;
  if (!prod) return <div className="page"><p>Producto no encontrado</p></div>;

  return (
    <div className="page">
      <div className="page__head">
        <h2 className="page__title">Producto #{id}</h2>
        <div className="actions">
          <Link to="/productos" className="btn btn--ghost">← Volver</Link>
          <button onClick={save} disabled={saving} className="btn btn--primary">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button onClick={remove} disabled={removing} className="btn btn--danger">
            {removing ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>

      {/* Edición del producto */}
      <section className="card">
        <div className="row row--2">
          <div className="col">
            <label>Código</label>
            <input name="codigo" value={form.codigo} onChange={handleChange} />
          </div>
          <div className="col">
            <label>Nombre</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} />
          </div>
          <div className="col">
            <label>Categoría ABC</label>
            <select name="categoria" value={form.categoria} onChange={handleChange}>
              <option value="A">A</option><option value="B">B</option><option value="C">C</option>
            </select>
          </div>
          <div className="col">
            <label>Punto de reorden (ROP)</label>
            <input name="punto_reorden" type="number" value={form.punto_reorden} onChange={handleChange} />
          </div>
          <div className="col">
            <label>Valor unitario</label>
            <input name="valor_unitario" type="number" value={form.valor_unitario} onChange={handleChange} />
          </div>
        </div>
      </section>

      {/* Pronóstico y por vencer */}
      <section className="row row--2">
        <div className="card">
          <h3>Pronóstico (próximo mes)</h3>
          {forecast ? (
            <>
              <div className="kpi-big">{forecast.prediction_units}</div>
              <div className="muted">Histórico mensual: {forecast.history_months} mes(es)</div>
            </>
          ) : (
            <div className="muted">Sin datos suficientes</div>
          )}
        </div>

        <div className="card">
          <h3>Lotes por vencer (≤60 días)</h3>
          {porVencer.length === 0 ? (
            <div className="muted">Sin lotes por vencer</div>
          ) : (
            <ul className="list">
              {porVencer.map((l) => (
                <li key={l.lote_id} className="list__row">
                  <span>#{l.lote_id} • Lote: {l.numero_lote || "-"} • caduca {l.fecha_caducidad} • stock {l.stock_lote}</span>
                  <span className={l.days_left <= 30 ? "text-danger" : "text-warn"}>{l.days_left} días</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Lotes */}
      <section className="card">
        <h3>Lotes</h3>
        <div className="row row--4">
          <div className="col">
            <label>Escanear / escribir LOTE</label>
            <input
              placeholder="Apunta el lector aquí"
              value={entradaForm.scan}
              onChange={(e) => setEntradaForm((s) => ({ ...s, scan: e.target.value }))}
            />
          </div>
          <div className="col">
            <label>Fecha de caducidad</label>
            <input
              type="date"
              value={entradaForm.fecha_caducidad}
              onChange={(e) => setEntradaForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
              required
            />
          </div>
          <div className="col">
            <label>Cantidad</label>
            <input
              type="number" min={1}
              value={entradaForm.cantidad}
              onChange={(e) => setEntradaForm((s) => ({ ...s, cantidad: e.target.value }))}
            />
          </div>
          <div className="col col--auto" style={{alignSelf:"end"}}>
            <button onClick={entradaRapida} className="btn">Agregar stock (auto-lote)</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Lote</th><th>Caducidad</th><th>Días</th><th>Stock</th></tr>
            </thead>
            <tbody>
              {(lotes || [])
                .slice()
                .sort((a,b)=>String(a.fecha_caducidad).localeCompare(String(b.fecha_caducidad)))
                .map((l) => {
                  const pv = (porVencer || []).find((x) => x.lote_id === l.id);
                  const days = pv?.days_left ?? "";
                  const cls = days === "" ? "" : days <= 30 ? "text-danger" : days <= 60 ? "text-warn" : "";
                  return (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td>{l.numero_lote || "-"}</td>
                      <td>{l.fecha_caducidad}</td>
                      <td className={cls}>{days !== "" ? days : "-"}</td>
                      <td>{l.stock_lote}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Movimientos */}
      <section className="card">
        <h3>Registrar movimiento</h3>
        <div className="row row--4">
          <div className="col">
            <label>Tipo</label>
            <select value={movForm.tipo} onChange={(e) => setMovForm((s) => ({ ...s, tipo: e.target.value }))}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div className="col">
            <label>Cantidad</label>
            <input type="number" value={movForm.cantidad} onChange={(e) => setMovForm((s) => ({ ...s, cantidad: e.target.value }))}/>
          </div>
          <div className="col">
            <label>Lote (opcional)</label>
            <input
              type="number"
              value={movForm.lote_id}
              onChange={(e) => setMovForm((s) => ({ ...s, lote_id: e.target.value }))}
              placeholder="FEFO si vacío"
            />
          </div>
          <div className="col col--auto" style={{alignSelf:"end"}}>
            <button onClick={registrarMovimiento} className="btn btn--primary">Guardar movimiento</button>
          </div>
        </div>
        <p className="muted">Si dejas vacío el <b>lote</b> y el tipo es <b>salida</b>, el backend asigna automáticamente el lote más próximo a vencer (FEFO).</p>
      </section>
    </div>
  );
}
