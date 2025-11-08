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
    <form onSubmit={handleSubmit} className="card" aria-labelledby="pf_title">
      <div className="row">
        <div className="col">
          <label htmlFor="pf_codigo">Código</label>
          <input
            id="pf_codigo"
            value={form.codigo}
            onChange={(e) => update("codigo", e.target.value)}
            required
            aria-describedby="pf_codigo_hint"
          />
          <small id="pf_codigo_hint" className="hint">Usa el código del proveedor o interno de la droguería.</small>
        </div>

        <div className="col">
          <label htmlFor="pf_nombre">Nombre</label>
          <input
            id="pf_nombre"
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            required
            aria-describedby="pf_nombre_hint"
          />
          <small id="pf_nombre_hint" className="hint">Nombre comercial o genérico que usas en el mostrador.</small>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <div className="row row--tight">
            <div className="col">
              <label htmlFor="pf_categoria">Categoría ABC</label>
              <select
                id="pf_categoria"
                value={form.categoria}
                onChange={(e) => update("categoria", e.target.value)}
                disabled={auto}
              >
                {CATS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div className="col col--auto">
              <span className="label--tiny" id="pf_auto_label">Auto-sugerir</span>
              <div className="switch" role="group" aria-labelledby="pf_auto_label">
                <input type="checkbox" id="autoABC" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <label htmlFor="autoABC">ABC/ROP</label>
              </div>
            </div>
          </div>
          <small className="hint" id="pf_abc_hint">
            <strong>¿Qué es ABC?</strong> A = más importantes/rotación alta, B = media, C = baja. Hoy se sugiere por precio y podrás ajustarlo.
          </small>
        </div>

        <div className="col">
          <label htmlFor="pf_rop">Punto de reorden (unidades)</label>
          <input
            id="pf_rop"
            type="number"
            min={0}
            value={form.punto_reorden}
            onChange={(e) => update("punto_reorden", e.target.value)}
            disabled={auto}
            aria-describedby="pf_rop_hint"
          />
          <small id="pf_rop_hint" className="hint">Mientras no haya historial, sugerimos A=20, B=10, C=5 (editable).</small>
        </div>

        <div className="col">
          <label htmlFor="pf_valor">Valor unitario (COP)</label>
          <input
            id="pf_valor"
            type="number"
            step="0.01"
            min={0}
            value={form.valor_unitario}
            onChange={(e) => update("valor_unitario", e.target.value)}
            aria-describedby="pf_valor_hint"
          />
          <small id="pf_valor_hint" className="hint">Usado para sugerir la categoría inicial.</small>
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
