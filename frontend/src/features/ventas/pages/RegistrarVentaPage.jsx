import { useEffect, useMemo, useRef, useState } from "react";
import {
  anularVenta,
  buscarLotePorNumero,
  buscarProductos,
  crearVentaUnit,
  getCierreDia,
  getHistorialPaginado,
  listarLotes,
  listarVentasHoy
} from "../repository";

import "../../../styles/ventas.css"; // << importante

const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const money = (n) => Number(n || 0).toLocaleString("es-CO");

export default function RegistrarVentaPage() {
  // ------- BUSCADOR / ESCÁNER -------
  const [term, setTerm] = useState("");
  const [sugs, setSugs] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const scanRef = useRef(null);

  // ------- EDITOR -------
  const [productoSel, setProductoSel] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loteMode, setLoteMode] = useState("auto"); // "auto" | "manual"
  const [loteId, setLoteId] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);

  // ------- LISTA DEL DÍA -------
  const [ventas, setVentas] = useState([]);
  const [totalDia, setTotalDia] = useState(0);

  // ------- HISTORIAL PAGINADO -------
  const [historialPaginado, setHistorialPaginado] = useState(null);
  const [histFiltroYear, setHistFiltroYear] = useState(new Date().getFullYear());
  const [histFiltroMonth, setHistFiltroMonth] = useState("");
  const [histPage, setHistPage] = useState(1);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const doSuggest = debounce(async (txt) => {
    const q = (txt || "").trim();
    if (!q) { setSugs([]); return; }
    setBuscando(true);
    try {
      const lots = await buscarLotePorNumero(q).catch(() => []);
      if (Array.isArray(lots) && lots.length > 0) {
        const l = lots[0];
        const pId = l.producto?.id ?? l.producto;
        const pNom = l.producto?.nombre ?? "(producto)";
        setSugs([{ id: pId, nombre: pNom, valor_unitario: 0, _loteId: l.id }]);
        return;
      }
      if (q.length >= 3) {
        const pres = await buscarProductos(q).catch(() => []);
        setSugs(pres || []);
      } else {
        setSugs([]);
      }
    } finally { setBuscando(false); }
  }, 350);

  useEffect(() => { doSuggest(term); }, [term]);

  const loadDia = async () => {
    try {
      const vs = await listarVentasHoy();
      setVentas(vs || []);
      const c = await getCierreDia();
      setTotalDia(Number(c?.total_dia ?? 0));
    } catch { /* noop */ }
  };

  const loadHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const data = await getHistorialPaginado(histFiltroYear, histFiltroMonth, histPage);
      setHistorialPaginado(data);
    } catch {
      setHistorialPaginado(null);
    } finally {
      setLoadingHistorial(false);
    }
  };

  useEffect(() => { loadDia(); }, []);
  useEffect(() => { loadHistorial(); }, [histFiltroYear, histFiltroMonth, histPage]);

  const selectProduct = async (p, preferLoteId = null) => {
    setProductoSel({ id: p.id, nombre: p.nombre, valor_unitario: Number(p.valor_unitario || 0) });
    setCantidad(1);
    setPrecio(Number(p.valor_unitario || 0));

    const ls = await listarLotes(p.id).catch(() => []);
    const sorted = [...(ls || [])].sort((a, b) => (a.fecha_caducidad || "").localeCompare(b.fecha_caducidad || ""));
    setLotes(sorted);

    if (preferLoteId) { setLoteMode("manual"); setLoteId(preferLoteId); }
    else { setLoteMode("auto"); setLoteId(sorted[0]?.id ?? null); }

    setTerm(""); setSugs([]);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

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
      if (sugs.length > 0) await selectProduct(sugs[0], sugs[0]._loteId ?? null);
    } finally { setBuscando(false); }
  };

  const subtotal = useMemo(
    () => Number(cantidad || 0) * Number(precio || 0),
    [cantidad, precio]
  );

  const registrarVenta = async () => {
    if (!productoSel?.id) { alert("Selecciona un producto."); return; }
    if (Number(precio) < 500) { alert("El precio debe ser al menos 500 COP"); return; }
    if (Number(cantidad) <= 0) { alert("Cantidad debe ser > 0"); return; }

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
        lote: loteMode === "manual" ? loteId : undefined,
      });
      await loadDia();
      setProductoSel(null);
      setLotes([]); setLoteMode("auto"); setLoteId(null);
      setCantidad(1); setPrecio(0);
      setTimeout(() => scanRef.current?.focus(), 0);
      alert(`Venta #${v.id} registrada. Total $${money(v.total)}`);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || "Error al registrar la venta");
    }
  };

  const doAnular = async (ventaId) => {
    if (!confirm(`¿Seguro que deseas anular esta venta #${ventaId}?`)) return;
    try {
      await anularVenta(ventaId);
      await loadDia();
      alert("Venta anulada exitosamente.");
    }
    catch (e) { alert(e?.payload?.detail || e?.message || "No se pudo anular la venta."); }
  };

  return (
    <div className="page page--ventas">
      <h1 className="page__title">Ventas</h1>

      {/* BUSCADOR */}
      <div className="card form-scan" role="search">
        <p id="scanHelp" className="muted">
          Escanear / escribir (número de lote, código de barras o nombre)
        </p>
        <div className="form-scan__row">
          <label className="sr-only" htmlFor="scanInput">Escanear / escribir</label>
          <input
            id="scanInput"
            aria-describedby="scanHelp"
            ref={scanRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onScanEnter()}
            placeholder="Apunta el lector aquí o escribe"
          />
          <button type="button" className="btn btn--primary" onClick={onScanEnter} disabled={buscando}>
            {buscando ? "Buscando..." : "Agregar"}
          </button>
        </div>

        {sugs.length > 0 && (
          <div className="suggest">
            {sugs.slice(0, 8).map(p => (
              <button
                key={p.id}
                className="suggest__item"
                onClick={() => selectProduct(p, p._loteId ?? null)}
              >
                <div className="suggest__title">{p.nombre}</div>
                <div className="suggest__meta">
                  {p.codigo ? `Código: ${p.codigo}` : ""} {p.codigo_barras ? `• EAN: ${p.codigo_barras}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* EDITOR */}
      {productoSel && (
        <div className="card editor">
          <div className="editor__name">
            <div className="muted tiny">Medicamento</div>
            <div className="name">{productoSel.nombre}</div>
          </div>

          <label className="grid">
            <span className="tiny">Unidades</span>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="text-right"
            />
          </label>

          <label className="grid">
            <span className="tiny">$ Unidad</span>
            <input
              type="number"
              min={500}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="text-right"
            />
          </label>

          <label className="grid">
            <span className="tiny">Lote</span>
            <select
              value={loteMode === "auto" ? "auto" : (loteId ?? "auto")}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "auto") { setLoteMode("auto"); setLoteId(null); }
                else { setLoteMode("manual"); setLoteId(Number(v)); }
              }}
            >
              <option value="auto">Auto (FEFO)</option>
              {(lotes || []).map(l => (
                <option key={l.id} value={l.id}>
                  #{l.id} • {l.fecha_caducidad} • stock {l.stock_lote}
                </option>
              ))}
            </select>
          </label>

          <div className="editor__footer">
            <div className="muted">
              Subtotal: <b>${money(subtotal)}</b>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => setProductoSel(null)}>Cancelar</button>
              <button className="btn btn--primary" onClick={registrarVenta}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* TABLA DEL DÍA */}
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">UNID</th>
              <th scope="col">LOTE</th>
              <th scope="col">MEDICAMENTO</th>
              <th scope="col" className="text-right">$ UNIDAD</th>
              <th scope="col" className="text-right">TOTAL</th>
              <th scope="col"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr><td className="muted" colSpan={6}>Sin ventas hoy</td></tr>
            ) : ventas.map(v => {
              const it = (v.items && v.items[0]) || {};
              const total = Number(it.cantidad || 0) * Number(it.precio_unitario || 0);
              return (
                <tr key={v.id}>
                  <td>{it.cantidad ?? "-"}</td>
                  <td>{it.lote_numero ? `#${it.lote_numero}` : (it.lote ? `#${it.lote}` : "FEFO")}</td>
                  <td>
                    <div className="font-medium">{it.producto_nombre || "-"}</div>
                    {v.anulada && <div className="text-danger tiny">ANULADA</div>}
                  </td>
                  <td className="text-right">${money(it.precio_unitario)}</td>
                  <td className="text-right"><b>${money(total)}</b></td>
                  <td className="text-right">
                    {!v.anulada && (
                      <button className="link-danger" onClick={() => doAnular(v.id)}>Anular</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right">Total del día</td>
              <td className="text-right"><b>${money(totalDia)}</b></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="actions actions--end">
        <button
          className="btn"
          onClick={async () => {
            const c = await getCierreDia().catch(() => null);
            if (!c) return alert("No se pudo obtener el cierre.");
            alert(`Cierre de hoy\nVentas: ${c.ventas_registradas}\nAnuladas: ${c.ventas_anuladas}\nTotal día: $${money(c.total_dia)}`);
          }}
        >
          Cierre del día
        </button>
      </div>

      {/* DETALLE DE VENTAS HISTÓRICAS */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Detalle de Ventas Históricas</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              value={histFiltroYear}
              onChange={(e) => { setHistFiltroYear(e.target.value); setHistPage(1); }}
            >
              <option value="">Todos los años</option>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              value={histFiltroMonth}
              onChange={(e) => { setHistFiltroMonth(e.target.value); setHistPage(1); }}
            >
              <option value="">Todos los meses</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">FECHA Y HORA</th>
                <th scope="col">MEDICAMENTO</th>
                <th scope="col">LOTE</th>
                <th scope="col" className="text-right">CANTIDAD</th>
                <th scope="col" className="text-right">TOTAL PAGADO</th>
                <th scope="col" className="text-right">ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistorial ? (
                <tr><td colSpan={6} className="muted text-center" style={{ padding: '24px' }}>Cargando historial...</td></tr>
              ) : !historialPaginado || !historialPaginado.results || historialPaginado.results.length === 0 ? (
                <tr><td colSpan={6} className="muted text-center" style={{ padding: '24px' }}>No hay ventas en este periodo</td></tr>
              ) : (
                historialPaginado.results.map(v => {
                  const it = (v.items && v.items[0]) || {};
                  return (
                    <tr key={v.id} style={{ opacity: v.anulada ? 0.6 : 1 }}>
                      <td className="mono">{v.fecha ? new Date(v.fecha).toLocaleString('es-CO') : "-"}</td>
                      <td className="font-medium">{it.producto_nombre || "-"}</td>
                      <td>{it.lote_numero ? `#${it.lote_numero}` : (it.lote ? `#${it.lote}` : "FEFO")}</td>
                      <td className="text-right">{it.cantidad ?? "-"}</td>
                      <td className="text-right"><b>${money(v.total)}</b></td>
                      <td className="text-right">
                        {v.anulada ? (
                          <span className="text-danger tiny" style={{ background: '#fef2f2', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>ANULADA</span>
                        ) : (
                          <span style={{ color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>COMPLETADA</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {historialPaginado && historialPaginado.num_pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 8px' }}>
            <span className="muted" style={{ fontSize: '0.875rem' }}>
              Página {historialPaginado.current_page} de {historialPaginado.num_pages} ({historialPaginado.count} resultados)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn"
                onClick={() => setHistPage(p => Math.max(1, p - 1))}
                disabled={historialPaginado.current_page === 1 || loadingHistorial}
              >
                Anterior
              </button>
              <button
                className="btn btn--primary"
                onClick={() => setHistPage(p => Math.min(historialPaginado.num_pages, p + 1))}
                disabled={historialPaginado.current_page === historialPaginado.num_pages || loadingHistorial}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
