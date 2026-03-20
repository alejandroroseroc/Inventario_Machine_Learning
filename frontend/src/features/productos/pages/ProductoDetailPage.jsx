import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "../../../styles/productos.css";
import { lotesService } from "../../lotes/service";
import { movimientosService } from "../../movimientos/service";
import { patchProducto, sugerirRop } from "../repository";
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

  const [ropModo, setRopModo] = useState("manual");
  const [leadTime, setLeadTime] = useState(5);
  const [lookback, setLookback] = useState(90);
  const [ss, setSs] = useState(0);
  const [sugerencia, setSugerencia] = useState(null);
  const [calculando, setCalculando] = useState(false);

  const [form, setForm] = useState({
    codigo: "", nombre: "", categoria: "C", punto_reorden: 0, valor_unitario: 0,
  });

  const [entradaForm, setEntradaForm] = useState({ scan: "", fecha_caducidad: "", cantidad: 0 });
  const [movForm, setMovForm] = useState({ tipo: "salida", cantidad: 1, lote_id: "" });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const p = await productoService.getById(id);
        setProd(p);
        setForm({
          codigo: p.codigo ?? "", nombre: p.nombre ?? "", categoria: p.categoria ?? "C",
          punto_reorden: p.punto_reorden ?? 0, valor_unitario: Number(p.valor_unitario ?? 0),
        });

        const [f, ls, pv] = await Promise.all([
          productoService.forecast(id).catch(() => null),
          lotesService.listByProducto(id).catch(() => []),
          lotesService.porVencer({ productoId: id, dias: 60 }).catch(() => []),
        ]);
        setForecast(f);
        setLotes(ls || []);

        setPorVencer(Array.isArray(pv) ? pv : (pv?.results || pv?.items || []));

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
    setPorVencer(Array.isArray(pv) ? pv : (pv?.results || pv?.items || []));
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
    try { const updated = await productoService.update(id, form); setProd(updated); }
    catch { alert("Error guardando cambios"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar este producto? Esta acción es irreversible.")) return;
    setRemoving(true);
    try { await productoService.remove(id); navigate("/productos"); }
    catch { alert("No se pudo eliminar"); }
    finally { setRemoving(false); }
  };

  const ensureLoteIdInline = async ({ numeroLote, fechaCaducidad, codigoBarras }) => {
    const current = await lotesService.listByProducto(id).catch(() => []);
    let found = null;
    if (numeroLote) found = (current || []).find((l) => l.numero_lote === numeroLote);
    if (!found && fechaCaducidad) found = (current || []).find((l) => l.fecha_caducidad === fechaCaducidad);
    if (found) return found.id;

    const basePayload = { producto: Number(id), fecha_caducidad: fechaCaducidad, stock_lote: 0 };
    try {
      const created = await lotesService.create({ ...basePayload, numero_lote: numeroLote || null, codigo_barras: codigoBarras || null });
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
        numeroLote, fechaCaducidad: entradaForm.fecha_caducidad, codigoBarras: entradaForm.scan || null,
      });

      await movimientosService.create({ producto: Number(id), tipo: "entrada", cantidad, lote: loteId });
      await refreshLotes();
      setEntradaForm({ scan: "", fecha_caducidad: "", cantidad: 0 });
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar la entrada");
    }
  };

  async function calcularSugerencia() {
    if (!prod?.id) return;
    setCalculando(true);
    try { const data = await sugerirRop(prod.id, { lookback, lead_time: leadTime, ss }); setSugerencia(data); }
    catch { alert("No se pudo calcular el ROP sugerido."); setSugerencia(null); }
    finally { setCalculando(false); }
  }

  async function usarRopSugerido() {
    if (!sugerencia?.sugerido_rop || !prod?.id) return;
    const nuevo = Number(sugerencia.sugerido_rop);
    try {
      const updated = await patchProducto(prod.id, { punto_reorden: nuevo });
      setProd(updated || { ...prod, punto_reorden: nuevo });
      setForm((s) => ({ ...s, punto_reorden: nuevo }));
      alert(`Punto de reorden actualizado a ${nuevo}.`);
    } catch { alert("No se pudo actualizar el punto de reorden."); }
  }

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
          <Link
            to="/productos"
            className="btn btn--ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#475569' }}
          >
            <ArrowLeft size={18} color="#64748b" strokeWidth={2.5} />
            Volver
          </Link>
          <button onClick={save} disabled={saving} className="btn btn--primary">{saving ? "Guardando..." : "Guardar cambios"}</button>
          <button onClick={remove} disabled={removing} className="btn btn--danger">{removing ? "Eliminando..." : "Eliminar"}</button>
        </div>
      </div>

      {/* Edición del producto */}
      <section className="card" aria-labelledby="sec_edit_title">
        <h3 id="sec_edit_title" className="sr-only">Editar datos del producto</h3>
        <div className="row row--2">
          <div className="col">
            <label htmlFor="det_codigo">Código</label>
            <input id="det_codigo" name="codigo" value={form.codigo} onChange={handleChange} />
          </div>
          <div className="col">
            <label htmlFor="det_nombre">Nombre</label>
            <input id="det_nombre" name="nombre" value={form.nombre} onChange={handleChange} />
          </div>
          <div className="col">
            <label htmlFor="det_categoria">Categoría ABC</label>
            <select id="det_categoria" name="categoria" value={form.categoria} onChange={handleChange}>
              <option value="A">A</option><option value="B">B</option><option value="C">C</option>
            </select>
          </div>
          <div className="col">
            <label htmlFor="det_rop">Punto de reorden (ROP)</label>
            <input id="det_rop" name="punto_reorden" type="number" value={form.punto_reorden} onChange={handleChange} />
          </div>
          <div className="col">
            <label htmlFor="det_valor">Valor unitario</label>
            <input id="det_valor" name="valor_unitario" type="number" value={form.valor_unitario} onChange={handleChange} />
          </div>
        </div>
      </section>

      {/* ====== ROP – versión humanizada ====== */}
      {/* (se mantiene igual, sólo etiquetas válidas) */}
      <section className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Punto de reorden (ROP)</h3>
        <p className="help__note" style={{ marginBottom: 8 }}>
          El <b>punto de reorden</b> es el nivel de stock al que quiero que el sistema me avise para hacer pedido.
          Puedes definirlo <b>manualmente</b> o dejar que el sistema te dé una <b>sugerencia automática</b>
          usando tu historial de ventas y el tiempo que tarda en llegar un pedido.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="radio" name="rop-modo" checked={ropModo === "manual"} onChange={() => setRopModo("manual")} />
            <span>Definirlo yo (manual)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="radio" name="rop-modo" checked={ropModo === "auto"} onChange={() => setRopModo("auto")} />
            <span>Que el sistema me lo sugiera (automático)</span>
          </label>
        </div>

        {ropModo === "manual" && (
          <p className="help__note">
            Si elijo <b>manual</b>, solo escribo el número en <b>Punto de reorden (ROP)</b> del formulario de arriba.
            <br />
            <i>Ejemplo:</i> si pongo <b>5</b>, cuando el stock total llegue a <b>5</b> o menos veré una <b>alerta</b> y
            el producto contará como <b>crítico</b> en el panel.
          </p>
        )}

        {ropModo === "auto" && (
          <div>
            <p className="help__note" style={{ marginBottom: 8 }}>
              <b>Cálculo sugerido:</b> <code>ROP = promedio que vendo al día × días que tarda en llegar el pedido + colchón</code>.
            </p>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 10 }}>
              <label htmlFor="lk_days">
                <div className="text-sm">Período a revisar (días)</div>
                <input id="lk_days" type="number" min={7} value={lookback} onChange={(e) => setLookback(Number(e.target.value) || 0)} />
                <small className="help__note">Se usa para calcular tu promedio vendido por día.</small>
              </label>

              <label htmlFor="lt_days">
                <div className="text-sm">Días para que llegue un pedido</div>
                <input id="lt_days" type="number" min={0} value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value) || 0)} />
                <small className="help__note">Tiempo típico entre pedir y recibir.</small>
              </label>

              <label htmlFor="ss_units">
                <div className="text-sm">Colchón de seguridad (unidades)</div>
                <input id="ss_units" type="number" min={0} value={ss} onChange={(e) => setSs(Number(e.target.value) || 0)} />
                <small className="help__note">Unidades extra para cubrir imprevistos.</small>
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={calcularSugerencia} className="btn" disabled={calculando}>
                {calculando ? "Calculando..." : "Calcular punto de reorden sugerido"}
              </button>
              {!!sugerencia?.sugerido_rop && (
                <button onClick={usarRopSugerido} className="btn btn--primary">
                  Usar este valor ({sugerencia.sugerido_rop})
                </button>
              )}
            </div>

            {sugerencia && (
              <div className="help" style={{ marginTop: 10 }}>
                <div><b>Resultado del cálculo</b></div>
                <div>Promedio vendido por día: {sugerencia.promedio_diario}</div>
                <div>Días para que llegue un pedido: {sugerencia.lead_time_dias} d</div>
                <div>Colchón de seguridad: {sugerencia.stock_seguridad}</div>
                <div>Punto de reorden sugerido: <b>{sugerencia.sugerido_rop}</b></div>
                <div className="help__note">{sugerencia.formula}. {sugerencia.nota}</div>
              </div>
            )}
          </div>
        )}
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
          ) : <div className="muted">Sin datos suficientes</div>}
        </div>

        <div className="card">
          <h3>Lotes por vencer (≤60 días)</h3>
          {porVencer.length === 0 ? <div className="muted">Sin lotes por vencer</div> : (
            <ul className="list">
              {porVencer.map((l) => {
                const cls = l.days_left <= 30 ? "text-danger" : "text-warn";
                return (
                  <li key={l.lote_id} className="list__row">
                    <span>#{l.lote_id} • Lote: {l.numero_lote || "-"} • caduca {l.fecha_caducidad} • stock {l.stock_lote}</span>
                    <span className={cls}>{l.days_left} días</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Lotes */}
      <section className="card">
        <h3>Lotes</h3>
        <div className="row row--4">
          <div className="col">
            <label htmlFor="in_scan">Escanear / escribir LOTE</label>
            <input
              id="in_scan"
              placeholder="Apunta el lector aquí"
              value={entradaForm.scan}
              onChange={(e) => setEntradaForm((s) => ({ ...s, scan: e.target.value }))}
            />
          </div>
          <div className="col">
            <label htmlFor="in_fecha">Fecha de caducidad</label>
            <input
              id="in_fecha"
              type="date"
              value={entradaForm.fecha_caducidad}
              onChange={(e) => setEntradaForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
              required
            />
          </div>
          <div className="col">
            <label htmlFor="in_cant">Cantidad</label>
            <input
              id="in_cant"
              type="number" min={1}
              value={entradaForm.cantidad}
              onChange={(e) => setEntradaForm((s) => ({ ...s, cantidad: e.target.value }))}
            />
          </div>
          <div className="col col--auto" style={{ alignSelf: "end" }}>
            <button onClick={entradaRapida} className="btn">Agregar stock (auto-lote)</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Lotes del producto con fechas de caducidad y stock</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Lote</th>
                <th scope="col">Caducidad</th>
                <th scope="col">Días</th>
                <th scope="col">Stock</th>
              </tr>
            </thead>
            <tbody>
              {(lotes || [])
                .slice()
                .sort((a, b) => String(a.fecha_caducidad).localeCompare(String(b.fecha_caducidad)))
                .map((l) => {
                  const days = l.days_left ?? "";
                  const cls = days === "" ? "" : days <= 30 ? "text-danger" : days <= 60 ? "text-warn" : "";
                  return (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td>{l.numero_lote || <span className="muted">Sin Lote</span>}</td>
                      <td>{l.fecha_caducidad}</td>
                      <td style={{ textAlign: "center" }} className={cls}>{days !== "" ? days : "-"}</td>
                      <td style={{ textAlign: "center" }}>{l.stock_lote}</td>
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
            <label htmlFor="mv_tipo">Tipo</label>
            <select id="mv_tipo" value={movForm.tipo} onChange={(e) => setMovForm((s) => ({ ...s, tipo: e.target.value }))}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div className="col">
            <label htmlFor="mv_cant">Cantidad</label>
            <input id="mv_cant" type="number" value={movForm.cantidad} onChange={(e) => setMovForm((s) => ({ ...s, cantidad: e.target.value }))} />
          </div>
          <div className="col">
            <label htmlFor="mv_lote">Lote (opcional)</label>
            <input id="mv_lote" type="number" value={movForm.lote_id} onChange={(e) => setMovForm((s) => ({ ...s, lote_id: e.target.value }))} placeholder="FEFO si vacío" />
          </div>
          <div className="col col--auto" style={{ alignSelf: "end" }}>
            <button onClick={registrarMovimiento} className="btn btn--primary">Guardar movimiento</button>
          </div>
        </div>
        <p className="muted">Si dejas vacío el <b>lote</b> y el tipo es <b>salida</b>, el backend asigna automáticamente el lote más próximo a vencer (FEFO).</p>
      </section>
    </div>
  );
}
