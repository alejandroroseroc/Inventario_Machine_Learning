import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus } from "lucide-react";
import {
  anularVenta,
  buscarLotePorNumero,
  buscarProductos,
  crearVentaUnit,
  getCierreDia,
  getHistorialPaginado,
  listarLotes,
  listarVentasHoy,
  crearGasto,
  eliminarGasto,
  getReporteDiario,
  getReporteSemanal,
  getReporteMensual,
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
  const [registrando, setRegistrando] = useState(false);

  // ------- LISTA DEL DÍA -------
  const [ventas, setVentas] = useState([]);
  const [totalDia, setTotalDia] = useState(0);
  const [gananciaDia, setGananciaDia] = useState(0);

  // ------- HISTORIAL PAGINADO -------
  const [historialPaginado, setHistorialPaginado] = useState(null);
  const [histFiltroYear, setHistFiltroYear] = useState(new Date().getFullYear());
  const [histFiltroMonth, setHistFiltroMonth] = useState("");
  const [histPage, setHistPage] = useState(1);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const historialRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [confirmAnularId, setConfirmAnularId] = useState(null);
  const [cierreResumen, setCierreResumen] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const [tabPrincipal, setTabPrincipal] = useState("ventas");

  // --- Cierre del día ---
  const [cierreDia, setCierreDia] = useState(null);
  const [loadingCierre, setLoadingCierre] = useState(false);
  const [gastoForm, setGastoForm] = useState({ monto: "", observacion: "" });
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  // --- Cierres anteriores ---
  const [tabReporte, setTabReporte] = useState("diario");
  const [fechaBuscar, setFechaBuscar] = useState(new Date().toISOString().split("T")[0]);
  const [reporteDiario, setReporteDiario] = useState(null);
  const [reporteSemanal, setReporteSemanal] = useState(null);
  const [reporteMensual, setReporteMensual] = useState(null);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [yearMes, setYearMes] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);

  const showNotice = (type, title, message = "") => {
    setNotice({ type, title, message });
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  const formatFechaHistorica = (venta) => {
    if (venta?.fecha_hora) {
      return new Date(venta.fecha_hora).toLocaleString("es-CO");
    }
    if (venta?.fecha) {
      const [year, month, day] = String(venta.fecha).split("-").map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day).toLocaleDateString("es-CO");
      }
    }
    if (venta?.created_at) {
      return new Date(venta.created_at).toLocaleString("es-CO");
    }
    return "-";
  };

  const doSuggest = debounce(async (txt) => {
    const q = (txt || "").trim();
    if (!q) { setSugs([]); return; }
    setBuscando(true);
    try {
      // EAN (6+ chars): buscar primero por producto, que es el caso más común en droguería
      if (q.length >= 6) {
        const pres = await buscarProductos(q).catch(() => []);
        if (Array.isArray(pres) && pres.length > 0) {
          setSugs(pres);
          return;
        }
      }

      // Si no encontró producto, intentar como número de lote
      const lots = await buscarLotePorNumero(q).catch(() => []);
      if (Array.isArray(lots) && lots.length > 0) {
        const l = lots[0];
        const pId = l.producto?.id ?? l.producto;
        const pNom = l.producto_nombre ?? l.producto?.nombre ?? "(producto)";
        const pPrecio = Number(l.producto_valor_unitario ?? l.producto?.valor_unitario ?? 0);
        setSugs([{ id: pId, nombre: pNom, valor_unitario: pPrecio, _loteId: l.id }]);
        return;
      }

      // Búsqueda por nombre (menos de 6 caracteres)
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
      setGananciaDia(Number(c?.ganancia_dia ?? 0));
    } catch { /* noop */ }
  };

  const cargarCierreDia = async (fechaIso) => {
    setLoadingCierre(true);
    try {
      const data = await getReporteDiario(fechaIso);
      setCierreDia(data);
    } catch (e) {
      console.error("Error cargando cierre:", e);
    } finally {
      setLoadingCierre(false);
    }
  };

  const handleAgregarGasto = async () => {
    const monto = Number(gastoForm.monto);
    const obs = gastoForm.observacion.trim();
    if (!monto || monto <= 0) {
      showNotice("warning", "Monto inválido", "El monto debe ser mayor a 0.");
      return;
    }
    if (!obs) {
      showNotice("warning", "Observación requerida", "Debes describir el gasto.");
      return;
    }
    setGuardandoGasto(true);
    try {
      await crearGasto({
        fecha: new Date().toISOString().split("T")[0],
        monto,
        observacion: obs,
      });
      setGastoForm({ monto: "", observacion: "" });
      await cargarCierreDia(new Date().toISOString().split("T")[0]);
      showNotice("success", "Gasto registrado");
    } catch {
      showNotice("error", "No se pudo registrar el gasto");
    } finally {
      setGuardandoGasto(false);
    }
  };

  const handleEliminarGasto = async (gastoId) => {
    try {
      await eliminarGasto(gastoId);
      await cargarCierreDia(new Date().toISOString().split("T")[0]);
      showNotice("success", "Gasto eliminado");
    } catch {
      showNotice("error", "No se pudo eliminar el gasto");
    }
  };

  const cargarReporteDiario = async () => {
    setLoadingReporte(true);
    try {
      const data = await getReporteDiario(fechaBuscar);
      setReporteDiario(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReporte(false);
    }
  };

  const cargarReporteSemanal = async () => {
    setLoadingReporte(true);
    try {
      const data = await getReporteSemanal(fechaBuscar);
      setReporteSemanal(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReporte(false);
    }
  };

  const cargarReporteMensual = async () => {
    setLoadingReporte(true);
    try {
      const data = await getReporteMensual(yearMes, mes);
      setReporteMensual(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReporte(false);
    }
  };

  const handlePrintMensual = () => { window.print(); };

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
  useEffect(() => {
    if (tabPrincipal === "cierre") {
      cargarCierreDia(new Date().toISOString().split("T")[0]);
    }
  }, [tabPrincipal]);

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
        const p = { id: l.producto?.id ?? l.producto, nombre: l.producto_nombre ?? l.producto?.nombre ?? "(producto)", valor_unitario: Number(l.producto_valor_unitario ?? l.producto?.valor_unitario ?? 0) };
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

  const selectedLote = useMemo(
    () => (loteMode === "manual" && loteId ? lotes.find((l) => l.id === loteId) : null),
    [loteId, loteMode, lotes]
  );

  const lotePreview = selectedLote || lotes[0] || null;

  const limpiarEditor = () => {
    setProductoSel(null);
    setLotes([]);
    setLoteMode("auto");
    setLoteId(null);
    setCantidad(1);
    setPrecio(0);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const registrarVenta = async () => {
    if (registrando) return;
    if (!productoSel?.id) { showNotice("warning", "Selecciona un producto"); return; }
    if (Number(precio) < 500) { showNotice("warning", "Precio invalido", "El precio debe ser al menos 500 COP."); return; }
    if (Number(cantidad) <= 0) { showNotice("warning", "Cantidad invalida", "La cantidad debe ser mayor que 0."); return; }

    if (loteMode === "manual" && loteId) {
      const l = lotes.find(x => x.id === loteId);
      if (l && Number(cantidad) > Number(l.stock_lote || 0)) {
        showNotice(
          "warning",
          "Stock insuficiente",
          `El lote #${l.id} tiene stock ${l.stock_lote}. Usa Auto (FEFO) o reduce la cantidad.`
        );
        return;
      }
    }

    setRegistrando(true);
    try {
      const v = await crearVentaUnit({
        producto: productoSel.id,
        cantidad: Number(cantidad),
        precio_unitario: Number(precio || 0),
        lote: loteMode === "manual" ? loteId : undefined,
      });
      await loadDia();
      limpiarEditor();
      showNotice("success", `Venta #${v.id} registrada`, `Total $${money(v.total)}`);
    } catch (e) {
      console.error(e);
      showNotice("error", "No se pudo registrar la venta", e?.response?.data?.detail || "Intentalo nuevamente.");
    } finally {
      setRegistrando(false);
    }
  };

  const doAnular = async (ventaId) => {
    setConfirmAnularId(ventaId);
    setMotivoAnulacion("");
  };

  const confirmarAnulacion = async () => {
    const ventaId = confirmAnularId;
    if (!ventaId) return;
    setConfirmAnularId(null);
    try {
      await anularVenta(ventaId, motivoAnulacion);
      await loadDia();
      showNotice("success", "Venta anulada", `La venta #${ventaId} fue anulada exitosamente.`);
    } catch (e) {
      showNotice("error", "No se pudo anular", e?.payload?.detail || e?.message || "Intentalo nuevamente.");
    }
  };

  const handleCierreDelDia = async () => {
    const c = await getCierreDia().catch(() => null);
    if (!c) {
      showNotice("error", "No se pudo obtener el cierre");
      return;
    }

    let nextYear = String(new Date().getFullYear());
    let nextMonth = "";

    if (c.fecha) {
      const [year, month] = String(c.fecha).split("-");
      nextYear = year || nextYear;
      nextMonth = month ? String(Number(month)) : "";
      setHistFiltroYear(nextYear);
      setHistFiltroMonth(nextMonth);
      setHistPage(1);
    }

    setLoadingHistorial(true);
    try {
      const data = await getHistorialPaginado(nextYear, nextMonth, 1);
      setHistorialPaginado(data);
    } catch {
      setHistorialPaginado(null);
    } finally {
      setLoadingHistorial(false);
    }

    const ventasCompletadas = (c.items || []).filter((venta) => !venta.anulada);
    const productosVendidos = ventasCompletadas.reduce(
      (acc, venta) => acc + (venta.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
      0
    );
    const medicamentosUnicos = new Set(
      ventasCompletadas.flatMap((venta) => (venta.items || []).map((item) => item.producto))
    ).size;

    setCierreResumen({
      fecha: c.fecha,
      hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
      ventas: c.ventas_registradas,
      anuladas: c.ventas_anuladas,
      total: c.total_dia,
      productosVendidos,
      medicamentosUnicos,
    });

    setTimeout(() => {
      historialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const cop = money;
  const filaStyle = {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "8px 0",
    borderBottom: "1px solid #f1f5f9", fontSize: "0.95rem",
  };
  const tdNum = { padding: "8px 12px", textAlign: "right", fontSize: "0.85rem" };

  return (
    <div className="page page--ventas">
      {notice && (
        <div className={`sales-toast sales-toast--${notice.type}`} role="status" aria-live="polite">
          <strong>{notice.title}</strong>
          {notice.message ? <span>{notice.message}</span> : null}
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      {/* Tabs principales */}
      <div className="sales-tabs" role="tablist" aria-label="Vistas de ventas">
        {[
          { key: "ventas", label: "Registrar Venta" },
          { key: "cierre", label: "Cierre del Día" },
          { key: "historico", label: "Cierres Anteriores" },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTabPrincipal(t.key)}
            role="tab"
            aria-selected={tabPrincipal === t.key}
            className={`sales-tab ${tabPrincipal === t.key ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabPrincipal === "ventas" && (
        <>
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

          <div className="stock-preview">
            <span>Stock disponible</span>
            <strong>{lotePreview ? `${lotePreview.stock_lote} uds` : "Sin stock"}</strong>
            <small>{lotePreview?.fecha_caducidad ? `Vence: ${lotePreview.fecha_caducidad}` : "Sin lote disponible"}</small>
          </div>

          <div className="editor__footer">
            <div className="muted">
              Subtotal: <b>${money(subtotal)}</b>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => setProductoSel(null)}>Cancelar</button>
              <button className="btn btn--primary" onClick={registrarVenta} disabled={registrando}>
                {registrando ? "Registrando..." : "Registrar"}
              </button>
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
              const items = v.items || [];
              return (
                <tr key={v.id}>
                  <td>{items.reduce((sum, it) => sum + Number(it.cantidad || 0), 0) || "-"}</td>
                  <td>
                    {items.map((it) => (
                      <div key={it.id}>{it.lote_numero ? `#${it.lote_numero}` : (it.lote ? `#${it.lote}` : "FEFO")}</div>
                    ))}
                  </td>
                  <td>
                    {items.map((it) => (
                      <div key={it.id} className="font-medium">{it.producto_nombre || "-"}</div>
                    ))}
                    {v.anulada && <div className="text-danger tiny">ANULADA</div>}
                    {v.motivo_anulacion && <div className="tiny muted">Motivo: {v.motivo_anulacion}</div>}
                  </td>
                  <td className="text-right">
                    {items.map((it) => <div key={it.id}>${money(it.precio_unitario)}</div>)}
                  </td>
                  <td className="text-right"><b>${money(v.total)}</b></td>
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
            <tr>
              <td colSpan={4} className="text-right" style={{ color: "#475569", fontSize: "0.9rem" }}>Ganancia estimada</td>
              <td className="text-right" style={{ color: "#059669" }}><b>${money(gananciaDia)}</b></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="actions actions--end">
        <button
          className="btn"
          onClick={handleCierreDelDia}
        >
          Ver cierre del dia
        </button>
      </div>

      {/* DETALLE DE VENTAS HISTÓRICAS */}
      <div className="card" style={{ marginTop: 24 }} ref={historialRef}>
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
                  const items = v.items || [];
                  return (
                    <tr key={v.id} style={{ opacity: v.anulada ? 0.6 : 1 }}>
                      <td className="mono">{formatFechaHistorica(v)}</td>
                      <td className="font-medium">
                        {items.map((it) => <div key={it.id}>{it.producto_nombre || "-"}</div>)}
                        {v.motivo_anulacion && <div className="tiny muted">Motivo: {v.motivo_anulacion}</div>}
                      </td>
                      <td>
                        {items.map((it) => (
                          <div key={it.id}>{it.lote_numero ? `#${it.lote_numero}` : (it.lote ? `#${it.lote}` : "FEFO")}</div>
                        ))}
                      </td>
                      <td className="text-right">{items.reduce((sum, it) => sum + Number(it.cantidad || 0), 0) || "-"}</td>
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

      {confirmAnularId && (
        <div className="sales-modal" role="dialog" aria-modal="true" aria-labelledby="anular-title">
          <div className="sales-modal__box sales-modal__box--sm">
            <div className="sales-modal__header">
              <h2 id="anular-title">Anular venta</h2>
              <button type="button" className="sales-modal__close" onClick={() => setConfirmAnularId(null)}>
                x
              </button>
            </div>
            <div className="sales-modal__body">
              <p>
                Esta accion marcara la venta <strong>#{confirmAnularId}</strong> como anulada y actualizara el total del dia.
              </p>
              <label className="cancel-reason">
                <span>Motivo opcional</span>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Ej: error en cantidad, cliente cambio el pedido..."
                  rows={3}
                />
              </label>
            </div>
            <div className="sales-modal__footer">
              <button type="button" className="btn" onClick={() => setConfirmAnularId(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn--danger" onClick={confirmarAnulacion}>
                Anular venta
              </button>
            </div>
          </div>
        </div>
      )}

      {cierreResumen && (
        <div className="sales-modal" role="dialog" aria-modal="true" aria-labelledby="cierre-title">
          <div className="sales-modal__box">
            <div className="sales-modal__header">
              <h2 id="cierre-title">Cierre del dia</h2>
              <button type="button" className="sales-modal__close" onClick={() => setCierreResumen(null)}>
                x
              </button>
            </div>
            <div className="sales-modal__body">
              <div className="sales-summary">
                <div>
                  <span>Fecha y hora</span>
                  <strong>{cierreResumen.fecha} - {cierreResumen.hora}</strong>
                </div>
                <div>
                  <span>Ventas registradas</span>
                  <strong>{cierreResumen.ventas}</strong>
                </div>
                <div>
                  <span>Anuladas</span>
                  <strong>{cierreResumen.anuladas}</strong>
                </div>
                <div>
                  <span>Total del dia</span>
                  <strong>${money(cierreResumen.total)}</strong>
                </div>
                <div>
                  <span>Unidades vendidas</span>
                  <strong>{cierreResumen.productosVendidos}</strong>
                </div>
                <div>
                  <span>Medicamentos distintos</span>
                  <strong>{cierreResumen.medicamentosUnicos}</strong>
                </div>
              </div>
            </div>
            <div className="sales-modal__footer">
              <button type="button" className="btn btn--primary" onClick={() => setCierreResumen(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {tabPrincipal === "cierre" && (
        <div>
          <h2 style={{ fontSize: "1.3rem", marginBottom: 20 }}>
            Cierre del Día — {new Date().toLocaleDateString("es-CO")}
          </h2>

          {loadingCierre ? (
            <p>Calculando cierre...</p>
          ) : cierreDia ? (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, color: "#1e293b" }}>Ventas del día</h3>
                <div style={filaStyle}>
                  <span>Ventas registradas</span>
                  <span>{cierreDia.ventas_registradas} ({cierreDia.ventas_anuladas} anuladas)</span>
                </div>
                <div style={filaStyle}>
                  <span>Total ventas</span>
                  <span style={{ color: "#059669", fontWeight: 700 }}>+${cop(cierreDia.total_ventas)}</span>
                </div>
                <div style={filaStyle}>
                  <span>Costo de lo vendido</span>
                  <span style={{ color: "#dc2626" }}>-${cop(cierreDia.costo_vendido)}</span>
                </div>
                <div style={{ ...filaStyle, borderTop: "2px solid #e2e8f0", paddingTop: 10, fontWeight: 700 }}>
                  <span>Ganancia bruta</span>
                  <span style={{ color: cierreDia.ganancia_bruta >= 0 ? "#059669" : "#dc2626" }}>
                    ${cop(cierreDia.ganancia_bruta)}
                  </span>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, color: "#1e293b" }}>Gastos del día</h3>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 10, marginBottom: 16 }}>
                  <input
                    type="number" min="1" placeholder="Monto $"
                    value={gastoForm.monto}
                    onChange={e => setGastoForm(s => ({ ...s, monto: e.target.value }))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                  <input
                    type="text" placeholder="Descripción obligatoria del gasto"
                    value={gastoForm.observacion}
                    onChange={e => setGastoForm(s => ({ ...s, observacion: e.target.value }))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                  <button type="button" className="btn btn--primary" onClick={handleAgregarGasto} disabled={guardandoGasto}>
                    {guardandoGasto ? "..." : (
                      <>
                        <Plus size={16} />
                        Agregar
                      </>
                    )}
                  </button>
                </div>
                {cierreDia.gastos.length === 0 ? (
                  <p style={{ color: "#94a3b8", margin: "8px 0" }}>Sin gastos registrados hoy</p>
                ) : (
                  cierreDia.gastos.map(g => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div>
                        <span style={{ fontWeight: 600, color: "#dc2626" }}>-${cop(g.monto)}</span>
                        <span style={{ color: "#475569", marginLeft: 12, fontSize: "0.9rem" }}>{g.observacion}</span>
                      </div>
                      <button type="button" className="link-danger" style={{ fontSize: "0.8rem" }} onClick={() => handleEliminarGasto(g.id)}>
                        Eliminar
                      </button>
                    </div>
                  ))
                )}
                <div style={{ ...filaStyle, borderTop: "2px solid #e2e8f0", paddingTop: 10, fontWeight: 700, marginTop: 8 }}>
                  <span>Total gastos</span>
                  <span style={{ color: "#dc2626" }}>-${cop(cierreDia.total_gastos)}</span>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ ...filaStyle, fontWeight: 700, fontSize: "1.1rem" }}>
                  <span>Ganancia neta</span>
                  <span style={{ color: cierreDia.ganancia_neta >= 0 ? "#059669" : "#dc2626" }}>
                    ${cop(cierreDia.ganancia_neta)}
                  </span>
                </div>
              </div>

              {(cierreDia.perdida_vencidos > 0 || cierreDia.perdida_devoluciones > 0) && (
                <div className="card" style={{ marginBottom: 16, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <h3 style={{ marginTop: 0, color: "#92400e" }}>Pérdidas del día</h3>
                  {cierreDia.perdida_vencidos > 0 && (
                    <div style={filaStyle}>
                      <span>Medicamentos vencidos (baja)</span>
                      <span style={{ color: "#dc2626" }}>-${cop(cierreDia.perdida_vencidos)}</span>
                    </div>
                  )}
                  {cierreDia.perdida_devoluciones > 0 && (
                    <div style={filaStyle}>
                      <span>Devoluciones proveedor (50%)</span>
                      <span style={{ color: "#d97706" }}>-${cop(cierreDia.perdida_devoluciones)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="card" style={{ background: cierreDia.resultado_final >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${cierreDia.resultado_final >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
                <div style={{ ...filaStyle, fontWeight: 700, fontSize: "1.3rem" }}>
                  <span>Resultado final del día</span>
                  <span style={{ color: cierreDia.resultado_final >= 0 ? "#059669" : "#dc2626" }}>
                    ${cop(cierreDia.resultado_final)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p>No se pudo cargar el cierre.</p>
          )}
        </div>
      )}

      {tabPrincipal === "historico" && (
        <div>
          <h2 style={{ fontSize: "1.3rem", marginBottom: 16 }}>Cierres Anteriores</h2>

          <div className="sales-tabs sales-tabs--compact" role="tablist" aria-label="Tipos de cierre">
            {[
              { key: "diario", label: "Diario" },
              { key: "semanal", label: "Semanal" },
              { key: "mensual", label: "Mensual" },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabReporte(t.key)}
                role="tab"
                aria-selected={tabReporte === t.key}
                className={`sales-tab ${tabReporte === t.key ? "is-active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tabReporte === "diario" && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                <input
                  type="date" value={fechaBuscar}
                  onChange={e => setFechaBuscar(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
                <button type="button" className="btn btn--primary" onClick={cargarReporteDiario} disabled={loadingReporte}>
                  {loadingReporte ? "Cargando..." : "Ver cierre"}
                </button>
              </div>
              {reporteDiario && <ReporteCierreDetalle data={reporteDiario} cop={cop} filaStyle={filaStyle} />}
            </div>
          )}

          {tabReporte === "semanal" && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                <label style={{ color: "#475569", fontSize: "0.9rem" }}>Selecciona cualquier día de la semana:</label>
                <input
                  type="date" value={fechaBuscar}
                  onChange={e => setFechaBuscar(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
                <button type="button" className="btn btn--primary" onClick={cargarReporteSemanal} disabled={loadingReporte}>
                  {loadingReporte ? "Cargando..." : "Ver semana"}
                </button>
              </div>
              {reporteSemanal && (
                <div>
                  <p style={{ color: "#475569", marginBottom: 12 }}>
                    Semana del {reporteSemanal.semana_inicio} al {reporteSemanal.semana_fin}
                  </p>
                  <div className="card">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["DÍA","VENTAS","COSTO","G. BRUTA","GASTOS","G. NETA","PÉRDIDAS","RESULTADO"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: h === "DÍA" ? "left" : "right", fontSize: "0.78rem", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reporteSemanal.dias.map((d, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: d.total_ventas === 0 ? "#fafafa" : "white" }}>
                            <td style={{ padding: "8px 12px", fontSize: "0.88rem" }}>
                              <div style={{ fontWeight: 600 }}>{d.nombre_dia}</div>
                              <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{d.fecha}</div>
                            </td>
                            <td style={tdNum}>${cop(d.total_ventas)}</td>
                            <td style={{ ...tdNum, color: "#dc2626" }}>-${cop(d.costo_vendido)}</td>
                            <td style={{ ...tdNum, color: "#059669" }}>${cop(d.ganancia_bruta)}</td>
                            <td style={{ ...tdNum, color: "#dc2626" }}>{d.total_gastos > 0 ? `-$${cop(d.total_gastos)}` : "-"}</td>
                            <td style={{ ...tdNum, fontWeight: 600, color: d.ganancia_neta >= 0 ? "#059669" : "#dc2626" }}>${cop(d.ganancia_neta)}</td>
                            <td style={{ ...tdNum, color: "#d97706" }}>{d.total_perdidas > 0 ? `-$${cop(d.total_perdidas)}` : "-"}</td>
                            <td style={{ ...tdNum, fontWeight: 700, color: d.resultado_final >= 0 ? "#059669" : "#dc2626" }}>${cop(d.resultado_final)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f0fdf4" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>TOTAL SEMANA</td>
                          <td style={tdNum}>${cop(reporteSemanal.totales.total_ventas)}</td>
                          <td style={{ ...tdNum, color: "#dc2626" }}>-${cop(reporteSemanal.totales.costo_vendido)}</td>
                          <td style={{ ...tdNum, color: "#059669" }}>${cop(reporteSemanal.totales.ganancia_bruta)}</td>
                          <td style={{ ...tdNum, color: "#dc2626" }}>-${cop(reporteSemanal.totales.total_gastos)}</td>
                          <td style={{ ...tdNum, fontWeight: 700, color: "#059669" }}>${cop(reporteSemanal.totales.ganancia_neta)}</td>
                          <td style={{ ...tdNum, color: "#d97706" }}>-${cop(reporteSemanal.totales.total_perdidas)}</td>
                          <td style={{ ...tdNum, fontWeight: 700, color: reporteSemanal.totales.resultado_final >= 0 ? "#059669" : "#dc2626" }}>${cop(reporteSemanal.totales.resultado_final)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tabReporte === "mensual" && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <select value={yearMes} onChange={e => setYearMes(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
                <button type="button" className="btn btn--primary" onClick={cargarReporteMensual} disabled={loadingReporte}>
                  {loadingReporte ? "Cargando..." : "Ver mes"}
                </button>
                {reporteMensual && (
                  <button type="button" className="btn btn--accent" onClick={handlePrintMensual}>
                    <FileText size={16} />
                    Exportar PDF
                  </button>
                )}
              </div>

              {reporteMensual && (
                <div className="print-section">
                  <div className="print-only" style={{ marginBottom: 24, borderBottom: "2px solid #111", paddingBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: "1.4rem", fontFamily: "Georgia, serif" }}>
                      Droguería Niza I
                    </h2>
                    <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "#333" }}>
                      Reporte mensual de resultados
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#333" }}>
                      {["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                        "Julio","Agosto","Septiembre","Octubre",
                        "Noviembre","Diciembre"][mes - 1]} {yearMes}
                      {" — "}Generado el{" "}
                      {new Date().toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0 }} className="no-print">Resumen del mes</h3>
                    <p style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 16 }}>
                      {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes - 1]} {yearMes}
                    </p>
                    <div style={filaStyle}><span>Total ventas</span><span style={{ color: "#059669", fontWeight: 600 }}>+${cop(reporteMensual.totales.total_ventas)}</span></div>
                    <div style={filaStyle}><span>Costo de lo vendido</span><span style={{ color: "#dc2626" }}>-${cop(reporteMensual.totales.costo_vendido)}</span></div>
                    <div style={{ ...filaStyle, borderTop: "1px solid #e2e8f0", paddingTop: 8, fontWeight: 600 }}><span>Ganancia bruta</span><span style={{ color: "#059669" }}>${cop(reporteMensual.totales.ganancia_bruta)}</span></div>
                    <div style={filaStyle}><span>Total gastos</span><span style={{ color: "#dc2626" }}>-${cop(reporteMensual.totales.total_gastos)}</span></div>
                    <div style={{ ...filaStyle, borderTop: "1px solid #e2e8f0", paddingTop: 8, fontWeight: 600 }}><span>Ganancia neta</span><span style={{ color: reporteMensual.totales.ganancia_neta >= 0 ? "#059669" : "#dc2626" }}>${cop(reporteMensual.totales.ganancia_neta)}</span></div>
                    <div style={filaStyle}><span>Pérdidas vencidos</span><span style={{ color: "#dc2626" }}>-${cop(reporteMensual.totales.perdida_vencidos)}</span></div>
                    <div style={filaStyle}><span>Pérdidas devoluciones (50%)</span><span style={{ color: "#d97706" }}>-${cop(reporteMensual.totales.perdida_devoluciones)}</span></div>
                    <div style={{ ...filaStyle, borderTop: "2px solid #1e293b", paddingTop: 10, fontWeight: 700, fontSize: "1.15rem" }}>
                      <span>Resultado final del mes</span>
                      <span style={{ color: reporteMensual.totales.resultado_final >= 0 ? "#059669" : "#dc2626" }}>
                        ${cop(reporteMensual.totales.resultado_final)}
                      </span>
                    </div>
                  </div>

                  {reporteMensual.gastos_detalle.length > 0 && (
                    <div className="card">
                      <h4 style={{ marginTop: 0 }}>Detalle de gastos del mes</h4>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["FECHA","OBSERVACIÓN","MONTO"].map(h => (
                              <th key={h} style={{ padding: "8px 12px", textAlign: h === "MONTO" ? "right" : "left", fontSize: "0.78rem", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reporteMensual.gastos_detalle.map(g => (
                            <tr key={g.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "7px 12px", fontSize: "0.85rem", color: "#475569" }}>{g.fecha}</td>
                              <td style={{ padding: "7px 12px", fontSize: "0.88rem" }}>{g.observacion}</td>
                              <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>-${cop(g.monto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReporteCierreDetalle({ data, cop, filaStyle }) {
  return (
    <div>
      <p style={{ color: "#475569", marginBottom: 12 }}>Cierre del {data.fecha}</p>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={filaStyle}>
          <span>Ventas ({data.ventas_registradas} registradas, {data.ventas_anuladas} anuladas)</span>
          <span style={{ color: "#059669", fontWeight: 600 }}>+${cop(data.total_ventas)}</span>
        </div>
        <div style={filaStyle}>
          <span>Costo vendido</span>
          <span style={{ color: "#dc2626" }}>-${cop(data.costo_vendido)}</span>
        </div>
        <div style={{ ...filaStyle, fontWeight: 700, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
          <span>Ganancia bruta</span>
          <span style={{ color: "#059669" }}>${cop(data.ganancia_bruta)}</span>
        </div>
        <div style={filaStyle}>
          <span>Gastos del día</span>
          <span style={{ color: "#dc2626" }}>-${cop(data.total_gastos)}</span>
        </div>
        {data.gastos.length > 0 && data.gastos.map(g => (
          <div key={g.id} style={{ ...filaStyle, paddingLeft: 16, fontSize: "0.82rem", color: "#64748b" }}>
            <span>{g.observacion}</span>
            <span>-${cop(g.monto)}</span>
          </div>
        ))}
        <div style={{ ...filaStyle, fontWeight: 700, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
          <span>Ganancia neta</span>
          <span style={{ color: data.ganancia_neta >= 0 ? "#059669" : "#dc2626" }}>${cop(data.ganancia_neta)}</span>
        </div>
        {data.total_perdidas > 0 && (
          <>
            <div style={{ ...filaStyle, color: "#dc2626" }}>
              <span>Vencidos</span>
              <span>-${cop(data.perdida_vencidos)}</span>
            </div>
            <div style={{ ...filaStyle, color: "#d97706" }}>
              <span>Devoluciones (50%)</span>
              <span>-${cop(data.perdida_devoluciones)}</span>
            </div>
          </>
        )}
        <div style={{ ...filaStyle, fontWeight: 700, fontSize: "1.1rem", borderTop: "2px solid #1e293b", paddingTop: 10 }}>
          <span>Resultado final</span>
          <span style={{ color: data.resultado_final >= 0 ? "#059669" : "#dc2626" }}>${cop(data.resultado_final)}</span>
        </div>
      </div>
    </div>
  );
}
