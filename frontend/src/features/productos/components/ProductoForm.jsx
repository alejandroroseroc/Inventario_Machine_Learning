// src/features/productos/components/ProductoForm.jsx
import { useState } from "react";

const CATEGORIAS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

export default function ProductoForm({ onSubmit, submitting }) {
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    categoria: "C",
    punto_reorden: 0,
    valor_unitario: 0,
  });

  function update(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await onSubmit?.(form);
    if (ok) {
      setForm({
        codigo: "",
        nombre: "",
        categoria: "C",
        punto_reorden: 0,
        valor_unitario: 0,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 24 }}>
      <div>
        <label>Código</label>
        <input
          type="text"
          value={form.codigo}
          onChange={(e) => update("codigo", e.target.value)}
          required
        />
      </div>

      <div>
        <label>Nombre</label>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          required
        />
      </div>

      <div>
        <label>Categoría</label>
        <select
          value={form.categoria}
          onChange={(e) => update("categoria", e.target.value)}
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Punto de reorden</label>
        <input
          type="number"
          min={0}
          value={form.punto_reorden}
          onChange={(e) => update("punto_reorden", e.target.value)}
        />
      </div>

      <div>
        <label>Valor unitario</label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={form.valor_unitario}
          onChange={(e) => update("valor_unitario", e.target.value)}
        />
      </div>

      <div style={{ alignSelf: "end" }}>
        <button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
