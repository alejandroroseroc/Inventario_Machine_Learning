import React, { useState } from "react";

const initial = { codigo: "", nombre: "", categoria: "C", punto_reorden: 0, valor_unitario: 0 };

export default function ProductoCreateDrawer({ open, onClose, onSubmit, fieldErrors, busy }) {
  const [p, setP] = useState(initial);

  React.useEffect(() => {
    if (open) setP(initial);
  }, [open]);

  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Nuevo producto</h2>
          <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Cerrar</button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-1">
            <label className="text-sm">Código</label>
            <input
              aria-label="Código"
              className="border rounded-lg px-3 py-2"
              value={p.codigo}
              onChange={(e) => set("codigo", e.target.value)}
            />
            {fieldErrors?.codigo && <span className="text-red-600 text-sm">{fieldErrors.codigo}</span>}
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Nombre</label>
            <input
              aria-label="Nombre"
              className="border rounded-lg px-3 py-2"
              value={p.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
            {fieldErrors?.nombre && <span className="text-red-600 text-sm">{fieldErrors.nombre}</span>}
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Categoría</label>
            <select
              aria-label="Categoría"
              className="border rounded-lg px-3 py-2"
              value={p.categoria}
              onChange={(e) => set("categoria", e.target.value)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
            {fieldErrors?.categoria && <span className="text-red-600 text-sm">{fieldErrors.categoria}</span>}
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Punto de reorden</label>
            <input
              type="number"
              aria-label="Punto de reorden"
              className="border rounded-lg px-3 py-2"
              value={p.punto_reorden}
              onChange={(e) => set("punto_reorden", e.target.value)}
            />
            {fieldErrors?.punto_reorden && <span className="text-red-600 text-sm">{fieldErrors.punto_reorden}</span>}
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Valor unitario</label>
            <input
              type="number"
              step="0.01"
              aria-label="Valor unitario"
              className="border rounded-lg px-3 py-2"
              value={p.valor_unitario}
              onChange={(e) => set("valor_unitario", e.target.value)}
            />
            {fieldErrors?.valor_unitario && <span className="text-red-600 text-sm">{fieldErrors.valor_unitario}</span>}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="px-4 py-2 rounded-xl shadow border bg-slate-900 text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => onSubmit(p)}
          >
            {busy ? "Guardando..." : "Guardar producto"}
          </button>
          <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
