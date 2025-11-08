import { useEffect, useMemo, useRef, useState } from "react";
import {
  buscarProductos,
  listarLotes,
  buscarLotePorNumero,
  crearVentaUnit,
  listarVentasHoy,
  getCierreDia,
  anularVenta,
} from "../repository";

// debounce simple
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

function money(n) { return Number(n || 0).toLocaleString("es-CO"); }

export default function RegistrarVentaPage() {
  // ------- BUSCADOR / ESCÁNER -------
  const [term, setTerm] = useState("");
  const [sugs, setSugs] = useState([]);      // sugerencias de producto
  const [buscando, setBuscando] = useState(false);
  const scanRef = useRef(null);

  // ------- EDITOR (venta individual) -------
  const [productoSel, setProductoSel] = useState(null); // {id, nombre, valor_unitario}
  const [lotes, setLotes] = useState([]);               // lotes del producto
  const [loteMode, setLoteMode] = useState("auto");     // "auto" (FEFO) | "manual"
  const [loteId, setLoteId] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio]   = useState(0);

  // ------- TABLA DEL DÍA -------
  const [ventas, setVentas] = useState([]);   // [{id, fecha, total, anulada, items:[...]}]
  const [totalDia, setTotalDia] = useState(0);

  // Sugerencias al teclear (primero intento por LOTE exacto; si no, por producto ≥3)
  const doSuggest = debounce(async (txt) => {
    const q = (txt || "").trim();
    if (!q) { setSugs([]); return; }

    setBuscando(true);
    try {
      // 1) ¿coincide con número de lote?
      const lots = await buscarLotePorNumero(q).catch(() => []);
      if (Array.isArray(lots) && lots.length > 0) {
        const l = lots[0];
        const pId = l.producto?.id ?? l.producto;
        const pNom = l.producto?.nombre ?? "(producto)";
        setSugs([{ id: pId, nombre: pNom, valor_unitario: 0, _loteId: l.id }]);
        return;
      }
      // 2) productos por nombre/código/EAN
      if (q.length >= 3) {
        const pres = await buscarProductos(q).catch(() => []);
        setSugs(pres || []);
      } else {
        setSugs([]);
      }
    } finally {
      setBuscando(false);
    }
  }, 350);

  useEffect(() => { doSuggest(term); }, [term]);

  // Cargar listado y total del día
  const loadDia = async () => {
    try {
      const vs = await listarVentasHoy();
      setVentas(vs || []);
      const c = await getCierreDia();
      setTotalDia(Number(c?.total_dia ?? 0));
    } catch {/* noop */}
  };
  useEffect(() => { loadDia(); }, []);

  // Elegir producto (desde sugerencias o Enter)
  const selectProduct = async (p, preferLoteId = null) => {
    setProductoSel({ id: p.id, nombre: p.nombre, valor_unitario: Number(p.valor_unitario || 0) });
    setCantidad(1);
    setPrecio(Number(p.valor_unitario || 0));

    const ls = await listarLotes(p.id).catch(() => []);
    const sorted = [...(ls || [])].sort((a,b)=> (a.fecha_caducidad||"").localeCompare(b.fecha_caducidad||""));
    setLotes(sorted);

    if (preferLoteId) { setLoteMode("manual"); setLoteId(preferLoteId); }
    else { setLoteMode("auto"); setLoteId(sorted[0]?.id ?? null); }

    setTerm(""); setSugs([]);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  // Enter en el buscador: lote exacto o primera sugerencia
  const onScanEnter = async () => {
    const q = term.trim();
    if (!q) return;

    setBuscando(true);
    try {
      const lots = await buscarLotePorNumero(q).catch(() => []);
      if (Array.isArray(lots) && lots.length > 0) {
        const l = lots[0];
        const p = { id: l.producto?.id ?? l.producto, nombre: l.producto?.nombre ?? "(producto)", valor_unitario: 0 };
        await selectProduct(p, l.id);
        return;
      }
      if (sugs.length > 0) {
        await selectProduct(sugs[0], sugs[0]._loteId ?? null);
      }
    } finally { setBuscando(false); }
  };

  const subtotal = useMemo(
    () => Number(cantidad || 0) * Number(precio || 0),
    [cantidad, precio]
  );

  // Registrar UNA venta (1 ítem)
  const registrarVenta = async () => {
    if (!productoSel?.id) { alert("Selecciona un producto."); return; }
    if (Number(cantidad) <= 0) { alert("Cantidad debe ser > 0"); return; }

    // Si estoy en manual y excedo stock del lote, aviso antes
    if (loteMode === "manual" && loteId) {
      const l = lotes.find(x => x.id === loteId);
      if (l && Number(cantidad) > Number(l.stock_lote || 0)) {
        alert(`Cantidad supera el stock del lote #${l.id} (stock ${l.stock_lote}). Usa 'Auto (FEFO)' o reduce la cantidad.`);
        return;
      }
    }

    try {
      const v = await crearVentaUnit({
        producto: productoSel.id,
        cantidad: Number(cantidad),
        precio_unitario: Number(precio || 0),
        lote: loteMode === "manual" ? loteId : undefined, // FEFO si "auto"
      });

      // refresco tabla y total
      await loadDia();

      // limpio editor
      setProductoSel(null);
      setLotes([]); setLoteMode("auto"); setLoteId(null);
      setCantidad(1); setPrecio(0);
      setTimeout(() => scanRef.current?.focus(), 0);

      alert(`Venta #${v.id} registrada. Total $${money(v.total)}`);
    } catch (e) {
      console.error(e);
      alert(e?.payload?.detail || "Error al registrar la venta");
    }
  };

  const doAnular = async (ventaId) => {
    if (!confirm(`¿Anular la venta #${ventaId}?`)) return;
    try {
      await anularVenta(ventaId);
      await loadDia();
    } catch {
      alert("No se pudo anular la venta.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Ventas</h1>

      {/* BUSCADOR */}
      <div className="border rounded-lg p-3">
        <label className="block text-sm text-gray-700 mb-1">
          Escanear / escribir (número de lote, código de barras o nombre)
        </label>
        <div className="flex gap-2">
          <input
            ref={scanRef}
            value={term}
            onChange={(e)=>setTerm(e.target.value)}
            onKeyDown={(e)=> e.key === "Enter" && onScanEnter()}
            placeholder="Apunta el lector aquí o escribe (≥3 letras) y presiona Enter"
            className="w-full border rounded-md px-3 py-2"
            autoFocus
          />
          <button className="px-3 py-2 rounded-md border" onClick={onScanEnter} disabled={buscando}>
            {buscando ? "Buscando..." : "Agregar"}
          </button>
        </div>

        {sugs.length > 0 && (
          <div className="mt-2 border rounded-md divide-y bg-white">
            {sugs.slice(0,8).map(p => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                onClick={()=>selectProduct(p, p._loteId ?? null)}
              >
                <div className="font-medium">{p.nombre}</div>
                <div className="text-gray-600 text-xs">
                  {p.codigo ? `Código: ${p.codigo}` : ""} {p.codigo_barras ? `• EAN: ${p.codigo_barras}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* EDITOR (fila temporal) */}
      {productoSel && (
        <div className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <div className="text-xs text-gray-600">Medicamento</div>
            <div className="text-lg font-medium">{productoSel.nombre}</div>
          </div>

          <label className="space-y-1">
            <span className="text-xs">Unidades</span>
            <input type="number" min={1} value={cantidad}
              onChange={(e)=>setCantidad(e.target.value)}
              className="w-full border rounded-md px-2 py-1 text-right"/>
          </label>

          <label className="space-y-1">
            <span className="text-xs">$ Unidad</span>
            <input type="number" min={0} value={precio}
              onChange={(e)=>setPrecio(e.target.value)}
              className="w-full border rounded-md px-2 py-1 text-right"/>
          </label>

          <div>
            <div className="text-xs text-gray-600 mb-1">Lote</div>
            <div className="flex gap-2">
              <select
                value={loteMode === "auto" ? "auto" : (loteId ?? "auto")}
                onChange={(e)=>{
                  const v = e.target.value;
                  if (v === "auto") { setLoteMode("auto"); setLoteId(null); }
                  else { setLoteMode("manual"); setLoteId(Number(v)); }
                }}
                className="border rounded-md px-2 py-1"
              >
                <option value="auto">Auto (FEFO)</option>
                {(lotes||[]).map(l=>(
                  <option key={l.id} value={l.id}>
                    #{l.id} • {l.fecha_caducidad} • stock {l.stock_lote}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-5 flex justify-between items-center pt-1">
            <div className="text-sm text-gray-600">
              Subtotal: <b>${money(subtotal)}</b>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-md border" onClick={()=>setProductoSel(null)}>Cancelar</button>
              <button className="px-3 py-2 rounded-md border" onClick={registrarVenta}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* TABLA DEL DÍA */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-2 px-3 w-20">Unid</th>
              <th className="text-left py-2 px-3 w-56">Lote</th>
              <th className="text-left py-2 px-3">Medicamento</th>
              <th className="text-right py-2 px-3 w-40">$ Unidad</th>
              <th className="text-right py-2 px-3 w-44">Total</th>
              <th className="py-2 px-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr><td className="py-4 px-3 text-gray-500" colSpan={6}>Sin ventas hoy</td></tr>
            ) : ventas.map(v => {
              // asumimos 1 ítem por venta
              const it = (v.items && v.items[0]) || {};
              const total = Number(it.cantidad || 0) * Number(it.precio_unitario || 0);
              return (
                <tr key={v.id} className="border-t">
                  <td className="py-2 px-3">{it.cantidad ?? "-"}</td>
                  <td className="py-2 px-3">{it.lote_numero ? `#${it.lote_numero}` : (it.lote ? `#${it.lote}` : "FEFO")}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{it.producto_nombre || "-"}</div>
                    {v.anulada && <div className="text-xs text-red-600">ANULADA</div>}
                  </td>
                  <td className="py-2 px-3 text-right">${money(it.precio_unitario)}</td>
                  <td className="py-2 px-3 text-right font-medium">${money(total)}</td>
                  <td className="py-2 px-3 text-right">
                    {!v.anulada && (
                      <button className="text-red-600" onClick={()=>doAnular(v.id)}>Anular</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={4} className="py-2 px-3 text-right">Total del día</td>
              <td className="py-2 px-3 text-right font-semibold">
                ${money(totalDia)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <button className="px-4 py-2 rounded-md border" onClick={async ()=>{
          const c = await getCierreDia().catch(()=>null);
          if (!c) return alert("No se pudo obtener el cierre.");
          alert(`Cierre de hoy\nVentas: ${c.ventas_registradas}\nAnuladas: ${c.ventas_anuladas}\nTotal día: $${money(c.total_dia)}`);
        }}>
          Cierre del día
        </button>
      </div>
    </div>
  );
}
