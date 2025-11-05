import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productoService } from "../service";
import { lotesService } from "../../lotes/service";
import { movimientosService } from "../../movimientos/service";

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
    scan: "",                // aquí el lector escribe (o el usuario teclea el LOTE/código)
    fecha_caducidad: "",     // obligatoria si el scan no trae caducidad
    cantidad: 0,
  });

  // Movimientos (salida/entrada/ajuste manual)
  const [movForm, setMovForm] = useState({
    tipo: "salida",        // "entrada" | "salida" | "ajuste"
    cantidad: 1,
    lote_id: "",           // opcional; si vacío y es salida, el backend hace FEFO
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
      [name]:
        name === "valor_unitario" || name === "punto_reorden"
          ? Number(value)
          : value,
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
      navigate("/productos"); // o "/inventario" según tu router
    } catch {
      alert("No se pudo eliminar");
    } finally {
      setRemoving(false);
    }
  };

  /**
   * Asegura un lote por (numero_lote) o (fecha_caducidad).
   * - Si existe, devuelve su id.
   * - Si no existe, intenta crearlo con numero_lote/codigo_barras;
   *   si el backend no acepta esos campos, reintenta sin ellos.
   */
  const ensureLoteIdInline = async ({
    numeroLote,
    fechaCaducidad,
    codigoBarras,
  }) => {
    // 1) buscar en los lotes actuales
    const current = await lotesService.listByProducto(id).catch(() => []);
    let found = null;
    if (numeroLote) {
      found = (current || []).find((l) => l.numero_lote === numeroLote);
    }
    if (!found && fechaCaducidad) {
      found = (current || []).find((l) => l.fecha_caducidad === fechaCaducidad);
    }
    if (found) return found.id;

    // 2) crear: intento con campos extra (si el BE ya los tiene)
    const basePayload = {
      producto: Number(id),
      fecha_caducidad: fechaCaducidad,
      stock_lote: 0,
    };
    try {
      const created = await lotesService.create({
        ...basePayload,
        numero_lote: numeroLote || null,
        codigo_barras: codigoBarras || null,
      });
      return created.id;
    } catch (e) {
      // 3) si falla por campos desconocidos, reintenta sin ellos
      try {
        const created2 = await lotesService.create(basePayload);
        return created2.id;
      } catch (e2) {
        throw e2;
      }
    }
  };

  // ENTRADA RÁPIDA (auto-lote + escáner)
  const entradaRapida = async () => {
    const cantidad = Number(entradaForm.cantidad);
    if (cantidad <= 0) {
      alert("Cantidad > 0");
      return;
    }
    if (!entradaForm.fecha_caducidad) {
      alert("Indica la fecha de caducidad");
      return;
    }

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
    if (cantidad <= 0) {
      alert("Cantidad debe ser > 0");
      return;
    }
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
      alert(
        (e?.payload && (e.payload.detail || JSON.stringify(e.payload))) ||
          "No se pudo registrar el movimiento"
      );
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!prod) return <div className="p-6">Producto no encontrado</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Producto #{id}</h1>
        <div className="space-x-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-2 rounded-md border"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            onClick={remove}
            disabled={removing}
            className="px-3 py-2 rounded-md border text-red-600"
          >
            {removing ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>

      {/* Form edición */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm">Código</span>
          <input
            name="codigo"
            value={form.codigo}
            onChange={handleChange}
            className="w-full border rounded-md px-3 py-2"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Nombre</span>
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            className="w-full border rounded-md px-3 py-2"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Categoría ABC</span>
          <select
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm">Punto de reorden (ROP)</span>
          <input
            name="punto_reorden"
            type="number"
            value={form.punto_reorden}
            onChange={handleChange}
            className="w-full border rounded-md px-3 py-2"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Valor unitario</span>
          <input
            name="valor_unitario"
            type="number"
            value={form.valor_unitario}
            onChange={handleChange}
            className="w-full border rounded-md px-3 py-2"
          />
        </label>
      </section>

      {/* Forecast + Por vencer */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-medium mb-2">Pronóstico (próximo mes)</h2>
          {forecast ? (
            <div>
              <div className="text-3xl font-semibold">
                {forecast.prediction_units}
              </div>
              <div className="text-sm text-gray-600">
                Histórico mensual: {forecast.history_months} mes(es)
              </div>
            </div>
          ) : (
            <div className="text-gray-600 text-sm">Sin datos suficientes</div>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="font-medium mb-2">Lotes por vencer (≤60 días)</h2>
          {porVencer.length === 0 ? (
            <div className="text-gray-600 text-sm">Sin lotes por vencer</div>
          ) : (
            <ul className="space-y-2">
              {porVencer.map((l) => (
                <li
                  key={l.lote_id}
                  className="flex justify-between border rounded-md px-3 py-2"
                >
                  <span>
                    #{l.lote_id} • Lote: {l.numero_lote || "-"} • caduca{" "}
                    {l.fecha_caducidad} • stock {l.stock_lote}
                  </span>
                  <span
                    className={
                      l.days_left <= 30 ? "text-red-600" : "text-yellow-600"
                    }
                  >
                    {l.days_left} días
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Lotes */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Lotes</h2>

        {/* ENTRADA RÁPIDA (auto-lote + escáner) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="text-sm">Escanear / escribir LOTE</span>
            <input
              autoFocus
              placeholder="Apunta el lector aquí"
              value={entradaForm.scan}
              onChange={(e) =>
                setEntradaForm((s) => ({ ...s, scan: e.target.value }))
              }
              className="w-full border rounded-md px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Fecha de caducidad</span>
            <input
              type="date"
              value={entradaForm.fecha_caducidad}
              onChange={(e) =>
                setEntradaForm((s) => ({
                  ...s,
                  fecha_caducidad: e.target.value,
                }))
              }
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Cantidad</span>
            <input
              type="number"
              min={1}
              value={entradaForm.cantidad}
              onChange={(e) =>
                setEntradaForm((s) => ({ ...s, cantidad: e.target.value }))
              }
              className="w-full border rounded-md px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={entradaRapida}
              className="px-3 py-2 rounded-md border w-full"
            >
              Agregar stock (auto-lote)
            </button>
          </div>
        </div>

        {/* Tabla de lotes */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">ID</th>
                <th className="text-left">Lote</th>
                <th className="text-left">Caducidad</th>
                <th className="text-left">Días</th>
                <th className="text-left">Stock</th>
              </tr>
            </thead>
            <tbody>
              {(lotes || [])
                .slice()
                .sort((a, b) =>
                  String(a.fecha_caducidad).localeCompare(
                    String(b.fecha_caducidad)
                  )
                )
                .map((l) => {
                  const pv = (porVencer || []).find((x) => x.lote_id === l.id);
                  const days = pv?.days_left ?? "";
                  const cls =
                    days !== ""
                      ? days <= 30
                        ? "text-red-600"
                        : days <= 60
                        ? "text-yellow-600"
                        : ""
                      : "";
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="py-2">{l.id}</td>
                      <td>{l.numero_lote || "-"}</td>
                      <td>{l.fecha_caducidad}</td>
                      <td className={cls}>{days !== "" ? `${days}` : "-"}</td>
                      <td>{l.stock_lote}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Movimientos */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Registrar movimiento</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="text-sm">Tipo</span>
            <select
              value={movForm.tipo}
              onChange={(e) =>
                setMovForm((s) => ({ ...s, tipo: e.target.value }))
              }
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Cantidad</span>
            <input
              type="number"
              value={movForm.cantidad}
              onChange={(e) =>
                setMovForm((s) => ({ ...s, cantidad: e.target.value }))
              }
              className="w-full border rounded-md px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Lote (opcional)</span>
            <input
              type="number"
              value={movForm.lote_id}
              onChange={(e) =>
                setMovForm((s) => ({ ...s, lote_id: e.target.value }))
              }
              className="w-full border rounded-md px-3 py-2"
              placeholder="FEFO si vacío"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={registrarMovimiento}
              className="px-3 py-2 rounded-md border w-full"
            >
              Guardar movimiento
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-600">
          Si dejas vacío el <b>lote</b> y el tipo es <b>salida</b>, el backend
          asigna automáticamente el lote más próximo a vencer (FEFO).
        </p>
      </section>
    </div>
  );
}
