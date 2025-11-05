import { useEffect, useMemo, useState } from "react";

const CATS = [
  { value: "A", label: "A (alta rotación/valor)" },
  { value: "B", label: "B (media)" },
  { value: "C", label: "C (baja)" },
];

export default function ProductoForm({ onSubmit, submitting }) {
  const [auto, setAuto] = useState(true);

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    categoria: "C",
    punto_reorden: 5,
    valor_unitario: 0,
  });

  function update(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  // Sugerencias front (heurística simple por precio)
  const sugeridos = useMemo(() => {
    const vu = Number(form.valor_unitario || 0);
    let categoria = "C";
    if (vu >= 50000) categoria = "A";
    else if (vu >= 20000) categoria = "B";
    const ropByCat = { A: 20, B: 10, C: 5 };
    return { categoria, rop: ropByCat[categoria] };
  }, [form.valor_unitario]);

  useEffect(() => {
    if (auto) setForm((s) => ({ ...s, categoria: sugeridos.categoria, punto_reorden: sugeridos.rop }));
  }, [auto, sugeridos.categoria, sugeridos.rop]);

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await onSubmit?.({
      codigo: String(form.codigo || "").trim(),
      nombre: String(form.nombre || "").trim(),
      categoria: String(form.categoria || "C").toUpperCase(),
      punto_reorden: Number(form.punto_reorden || 0),
      valor_unitario: Number(
        typeof form.valor_unitario === "number"
          ? form.valor_unitario
          : String(form.valor_unitario || "0").replace(",", ".")
      ),
    });
    if (ok) {
      setForm({
        codigo: "",
        nombre: "",
        categoria: auto ? sugeridos.categoria : "C",
        punto_reorden: auto ? sugeridos.rop : 5,
        valor_unitario: 0,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="row">
        <div className="col">
          <label>Código</label>
          <input value={form.codigo} onChange={(e) => update("codigo", e.target.value)} required />
          <small className="hint">Usa el código del proveedor o interno de la droguería.</small>
        </div>

        <div className="col">
          <label>Nombre</label>
          <input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} required />
          <small className="hint">Nombre comercial o genérico que usas en el mostrador.</small>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <div className="row row--tight">
            <div className="col">
              <label>Categoría ABC</label>
              <select value={form.categoria} onChange={(e) => update("categoria", e.target.value)} disabled={auto}>
                {CATS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div className="col col--auto">
              <label className="label--tiny">Auto-sugerir</label>
              <div className="switch">
                <input type="checkbox" id="autoABC" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <label htmlFor="autoABC">ABC/ROP</label>
              </div>
            </div>
          </div>
          <small className="hint">
            <strong>¿Qué es ABC?</strong> A = más importantes/rotación alta, B = media, C = baja. Hoy se sugiere por precio y podrás ajustarlo.
          </small>
        </div>

        <div className="col">
          <label>Punto de reorden (unidades)</label>
          <input type="number" min={0} value={form.punto_reorden} onChange={(e) => update("punto_reorden", e.target.value)} disabled={auto} />
          <small className="hint">Mientras no haya historial, sugerimos A=20, B=10, C=5 (editable).</small>
        </div>

        <div className="col">
          <label>Valor unitario (COP)</label>
          <input type="number" step="0.01" min={0} value={form.valor_unitario} onChange={(e) => update("valor_unitario", e.target.value)} />
          <small className="hint">Usado para sugerir la categoría inicial.</small>
        </div>
      </div>

      <div className="row">
        <div className="col col--full">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </div>
    </form>
  );
}
