import { useEffect, useMemo, useState } from "react";
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

  // formularios locales
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    categoria: "C",
    punto_reorden: 0,
    valor_unitario: 0,
  });

  const [loteForm, setLoteForm] = useState({
    fecha_caducidad: "",
    stock_lote: 0,
  });

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
        setLotes(ls);
        setPorVencer(pv.items ?? []);
      } catch (e) {
        setError("No se pudo cargar el producto.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: name === "valor_unitario" || name === "punto_reorden" ? Number(value) : value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await productoService.update(id, form);
      setProd(updated);
    } catch (e) {
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
    } catch (e) {
      alert("No se pudo eliminar");
    } finally {
      setRemoving(false);
    }
  };

  const crearLote = async () => {
    if (!loteForm.fecha_caducidad || Number(loteForm.stock_lote) < 0) {
      alert("Completa fecha y stock >= 0");
      return;
    }
    try {
      const payload = {
        producto: Number(id),
        fecha_caducidad: loteForm.fecha_caducidad,
        stock_lote: Number(loteForm.stock_lote),
      };
      await lotesService.create(payload);
      const ls = await lotesService.listByProducto(id);
      setLotes(ls);
      const pv = await lotesService.porVencer({ productoId: id, dias: 60 });
      setPorVencer(pv.items ?? []);
      setLoteForm({ fecha_caducidad: "", stock_lote: 0 });
    } catch {
      alert("No se pudo crear el lote");
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
      producto: Number(id),              // 👈 antes mandabas producto_id
      tipo: movForm.tipo,
      cantidad,
      lote: movForm.lote_id ? Number(movForm.lote_id) : undefined, // 👈 antes lote_id
    });

    // refrescos mínimos
    const f = await productoService.forecast(id).catch(() => null);
    setForecast(f);
    const ls = await lotesService.listByProducto(id);
    setLotes(ls);
    // opcional: limpia el form
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
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded-md border">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button onClick={remove} disabled={removing} className="px-3 py-2 rounded-md border text-red-600">
            {removing ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>

      {/* Form edición */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm">Código</span>
          <input name="codigo" value={form.codigo} onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Nombre</span>
          <input name="nombre" value={form.nombre} onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Categoría ABC</span>
          <select name="categoria" value={form.categoria} onChange={handleChange} className="w-full border rounded-md px-3 py-2">
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm">Punto de reorden (ROP)</span>
          <input name="punto_reorden" type="number" value={form.punto_reorden} onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Valor unitario</span>
          <input name="valor_unitario" type="number" value={form.valor_unitario} onChange={handleChange} className="w-full border rounded-md px-3 py-2" />
        </label>
      </section>

      {/* Forecast + Por vencer */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-medium mb-2">Pronóstico (próximo mes)</h2>
          {forecast ? (
            <div>
              <div className="text-3xl font-semibold">{forecast.prediction_units}</div>
              <div className="text-sm text-gray-600">Histórico mensual: {forecast.history_months} mes(es)</div>
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
                <li key={l.lote_id} className="flex justify-between border rounded-md px-3 py-2">
                  <span>#{l.lote_id} • caduca {l.fecha_caducidad} • stock {l.stock_lote}</span>
                  <span className={l.days_left <= 30 ? "text-red-600" : "text-yellow-600"}>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-sm">Fecha caducidad</span>
            <input
              type="date"
              value={loteForm.fecha_caducidad}
              onChange={(e) => setLoteForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
              className="w-full border rounded-md px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Stock del lote</span>
            <input
              type="number"
              value={loteForm.stock_lote}
              onChange={(e) => setLoteForm((s) => ({ ...s, stock_lote: e.target.value }))}
              className="w-full border rounded-md px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button onClick={crearLote} className="px-3 py-2 rounded-md border w-full">Crear lote</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="text-left py-2">ID</th><th className="text-left">Caducidad</th><th className="text-left">Stock</th></tr></thead>
            <tbody>
              {(lotes || []).map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2">{l.id}</td>
                  <td>{l.fecha_caducidad}</td>
                  <td>{l.stock_lote}</td>
                </tr>
              ))}
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
            <select value={movForm.tipo} onChange={(e) => setMovForm((s) => ({ ...s, tipo: e.target.value }))} className="w-full border rounded-md px-3 py-2">
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Cantidad</span>
            <input type="number" value={movForm.cantidad} onChange={(e) => setMovForm((s) => ({ ...s, cantidad: e.target.value }))} className="w-full border rounded-md px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Lote (opcional)</span>
            <input type="number" value={movForm.lote_id} onChange={(e) => setMovForm((s) => ({ ...s, lote_id: e.target.value }))} className="w-full border rounded-md px-3 py-2" placeholder="FEFO si vacío" />
          </label>
          <div className="flex items-end">
            <button onClick={registrarMovimiento} className="px-3 py-2 rounded-md border w-full">Guardar movimiento</button>
          </div>
        </div>

        <p className="text-xs text-gray-600">
          Si dejas vacío el <b>lote</b> y el tipo es <b>salida</b>, el backend asigna automáticamente el lote más próximo a vencer (FEFO).
        </p>
      </section>
    </div>
  );
}
