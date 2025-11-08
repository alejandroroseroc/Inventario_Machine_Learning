import { useEffect, useState } from "react";

const initial = { codigo: "", nombre: "", categoria: "C", punto_reorden: 0, valor_unitario: 0 };

export default function ProductoCreateDrawer({ open, onClose, onSubmit, fieldErrors, busy }) {
  const [p, setP] = useState(initial);

  useEffect(() => { if (open) setP(initial); }, [open]);
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="drawerTitle" className="text-xl font-semibold">Nuevo producto</h2>
          <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Cerrar</button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-1">
            <label className="text-sm" htmlFor="pcd_codigo">Código</label>
            <input
              id="pcd_codigo"
              className="border rounded-lg px-3 py-2"
              value={p.codigo}
              onChange={(e) => set("codigo", e.target.value)}
              required
              aria-describedby="pcd_codigo_hint"
            />
            <small id="pcd_codigo_hint" className="text-slate-600 text-sm">
              Usa el código del proveedor o interno de la droguería.
            </small>
            {fieldErrors?.codigo && <span className="text-red-600 text-sm">{fieldErrors.codigo}</span>}
          </div>

          <div className="grid gap-1">
            <label className="text-sm" htmlFor="pcd_nombre">Nombre</label>
            <input
              id="pcd_nombre"
              className="border rounded-lg px-3 py-2"
              value={p.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              required
              aria-describedby="pcd_nombre_hint"
            />
            <small id="pcd_nombre_hint" className="text-slate-600 text-sm">
              Nombre comercial o genérico que usas en el mostrador.
            </small>
            {fieldErrors?.nombre && <span className="text-red-600 text-sm">{fieldErrors.nombre}</span>}
          </div>

          <div className="grid gap-1">
            <label className="text-sm" htmlFor="pcd_categoria">Categoría</label>
            <select
              id="pcd_categoria"
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
            <label className="text-sm" htmlFor="pcd_rop">Punto de reorden</label>
            <input
              id="pcd_rop"
              type="number"
              min={0}
              className="border rounded-lg px-3 py-2"
              value={p.punto_reorden}
              onChange={(e) => set("punto_reorden", e.target.value)}
            />
            {fieldErrors?.punto_reorden && <span className="text-red-600 text-sm">{fieldErrors.punto_reorden}</span>}
          </div>

            <div className="grid gap-1">
              <label className="text-sm" htmlFor="pcd_valor">Valor unitario</label>
              <input
                id="pcd_valor"
                type="number"
                min={0}
                step="0.01"
                className="border rounded-lg px-3 py-2"
                value={p.valor_unitario}
                onChange={(e) => set("valor_unitario", e.target.value)}
                aria-describedby="pcd_valor_hint"
              />
              <small id="pcd_valor_hint" className="text-slate-600 text-sm">
                Usado para sugerir la categoría inicial.
              </small>
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
