// src/features/alerts/AlertsAndSuggestions.jsx
import { useEffect, useMemo, useState } from "react";
import { AlertsService } from "../../api/alerts.service";
import { listLotesPorVencer } from "../lotes/repository";

const factorLabel = (f) => {
  if (f === "health_idx") return "Salud (IRA/ETI)";
  if (f === "temp_mean") return "Temperatura";
  if (f === "precip_sum") return "Lluvia";
  if (f === "ma7") return "Tendencia (MA7)";
  if (f === "lag1") return "Últ. día";
  if (f === "lag7") return "Hace 1 semana";
  if (f === "carnaval") return "Carnaval";
  if (typeof f === "string" && f.startsWith("dow_")) {
    const k = parseInt(f.split("_")[1], 10);
    const map = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };
    return map[k] || f;
  }
  return f;
};

const reasonText = (a) => {
  const top = a?.explicacion?.top || [];
  if (!top.length) return "Estimación de demanda";
  const first = top[0]?.factor;
  if (first === "health_idx") return "Demanda por picos de salud";
  if (first === "temp_mean") return "Condiciones de temperatura";
  if (first === "precip_sum") return "Temporada de lluvias";
  if (first === "carnaval") return "Carnaval de Pasto";
  if (first === "ma7") return "Tendencia ascendente";
  if (first === "lag1" || first === "lag7") return "Patrón histórico";
  if (typeof first === "string" && first.startsWith("dow_")) {
    const dia = factorLabel(first);
    return `Mayor demanda los ${dia}`;
  }
  return `Factor: ${factorLabel(first)}`;
};

const parseSuggestedUnits = (mensaje) => {
  if (!mensaje) return null;
  const m = String(mensaje).match(/Sugerido\s+(\d+)\s*ud/i);
  return m ? Number(m[1]) : null;
};

const daysLeft = (isoDate) => {
  try {
    const d = new Date(isoDate);
    const today = new Date();
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

const asArray = (x) => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.results)) return x.results;
  if (Array.isArray(x?.data)) return x.data;
  return [];
};

export default function AlertsAndSuggestions() {
  const [tab, setTab] = useState("caducan");
  const [estado, setEstado] = useState("activa");
  const [diasVenc, setDiasVenc] = useState(60);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [expiring, setExpiring] = useState([]);
  const [mlAlerts, setMlAlerts] = useState([]);

  const cargar = async () => {
    setLoading(true);
    setErr("");
    try {
      // Cargar lotes por vencer
      const lotesRaw = await listLotesPorVencer({ dias: diasVenc });
      console.log("Lotes crudos:", lotesRaw); // DEBUG
      
      const lotes = asArray(lotesRaw).map((x) => ({
        id: x.lote_id || x.id,
        productoNombre: x.producto_nombre || x.producto?.nombre || "-",
        numeroLote: x.numero_lote || x.numero || "-",
        cantidad: x.stock_lote || x.cantidad || 0,
        fechaCaducidad: x.fecha_caducidad,
        diasRestantes: x.days_left || daysLeft(x.fecha_caducidad),
      }));

      // Cargar alertas
      const alerts = await AlertsService.list({ estado });
      console.log("Alertas crudas:", alerts); // DEBUG
      
      const mlOnly = alerts.filter((a) => a?.explicacion && Array.isArray(a.explicacion.top));

      setExpiring(lotes);
      setMlAlerts(mlOnly);
    } catch (e) {
      console.error("Error cargando datos:", e);
      setErr(e?.response?.data?.detail || "No fue posible cargar datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [estado, diasVenc]);

  const onResolve = async (id) => {
    try {
      await AlertsService.resolve(id);
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.detail || "No fue posible resolver la alerta.");
    }
  };

  const onRecalcPredict = async () => {
    try {
      await AlertsService.recalcPredict(14);
      await cargar();
      alert("Sugerencias recalculadas con predicción (h=14).");
    } catch (e) {
      alert(e?.response?.data?.detail || "No fue posible recalcular con predicción.");
    }
  };

  const rowsCaducan = useMemo(
    () =>
      (expiring || []).map((r, i) => {
        const dias = r.diasRestantes;
        const estadoDia = dias === null ? "-" : dias < 0 ? "Caducada" : dias;
        return (
          <tr key={r.id || i}>
            <td>{r.productoNombre}</td>
            <td>{r.numeroLote}</td>
            <td>{r.cantidad ? `${r.cantidad} unidades` : "-"}</td>
            <td className="mono">{r.fechaCaducidad || "-"}</td>
            <td className={dias < 0 ? "text-red" : "text-green"}>
              {dias < 0 ? "Caducada" : estadoDia}
            </td>
            <td className="text-right">
              <button type="button" className="link">Revisar</button>
            </td>
          </tr>
        );
      }),
    [expiring]
  );

  const rowsReorden = useMemo(
    () =>
      (mlAlerts || []).map((a) => {
        const cant = parseSuggestedUnits(a.mensaje);
        const explicacion = a.explicacion || {};
        
        return (
          <tr key={a.id}>
            <td>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#000', display: 'block', marginBottom: '4px' }}>
                  {/* CORREGIDO: Usar producto_nombre del backend */}
                  {a.producto_nombre || a.productoNombre || "Nombre no disponible"}
                </strong>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Código: {a.producto_codigo || "Sin código"}
                  {explicacion.yhat_total && ` • Pronóstico: ${Math.round(explicacion.yhat_total)} uds`}
                  {explicacion.safety && ` • Stock seguridad: ${explicacion.safety} uds`}
                </div>
              </div>
            </td>
            <td>
              <strong style={{ fontSize: '1.1rem', color: '#2c5aa0' }}>
                {Number.isFinite(cant) ? `${cant} unidades` : a.mensaje}
              </strong>
            </td>
            <td>
              <div className="chips">
                <span className="chip" style={{ backgroundColor: '#e8f4fd', color: '#000' }}>
                  {reasonText(a)}
                </span>
                {(explicacion.top || []).slice(0, 2).map((t, idx) => (
                  <span key={idx} className="chip ghost" style={{ color: '#000' }}>
                    {factorLabel(t.factor)}
                  </span>
                ))}
              </div>
              {explicacion.rmse && (
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                  📊 Error: {explicacion.rmse.toFixed(1)} uds • {explicacion.h || 14}d
                </div>
              )}
            </td>
            <td>
              <span className="tag tag-blue">Sugerencia ML</span>
            </td>
            <td className="text-right">
              <button 
                type="button" 
                className="btn primary" 
                onClick={() => onResolve(a.id)}
                style={{ marginRight: '8px' }}
              >
                Aprobar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => onResolve(a.id)}
              >
                Rechazar
              </button>
            </td>
          </tr>
        );
      }),
    [mlAlerts]
  );

  return (
    <section className="alerts-scope alerts-wrapper" aria-labelledby="alerts-title">
      <h1 id="alerts-title">Alertas y sugerencias</h1>

      <div className="card" style={{ paddingTop: 0 }}>
        <div className="tabs" role="tablist" aria-label="Vistas de alertas">
          <button
            type="button"
            id="tab-caducan"
            role="tab"
            aria-selected={tab === "caducan"}
            aria-controls="panel-caducan"
            className={`tab ${tab === "caducan" ? "active" : ""}`}
            onClick={() => setTab("caducan")}
          >
            Artículos que caducan
          </button>
          <button
            type="button"
            id="tab-reorden"
            role="tab"
            aria-selected={tab === "reorden"}
            aria-controls="panel-reorden"
            className={`tab ${tab === "reorden" ? "active" : ""}`}
            onClick={() => setTab("reorden")}
          >
            Sugerencia de reordenamiento
          </button>

          <div className="spacer" />

          <div className="controls row gap-2">
            <label htmlFor="sel-estado">Estado:</label>
            <select id="sel-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="activa">Activas</option>
              <option value="resuelta">Resueltas</option>
            </select>

            {tab === "caducan" ? (
              <>
                <label htmlFor="dias-input">Días:</label>
                <input
                  id="dias-input"
                  type="number"
                  min={1}
                  max={365}
                  value={diasVenc}
                  onChange={(e) => setDiasVenc(Number(e.target.value || 60))}
                  style={{ width: 72 }}
                />
              </>
            ) : (
              <button type="button" className="btn primary" onClick={onRecalcPredict}>
                Recalcular (con predicción)
              </button>
            )}
          </div>
        </div>

        {err && <div className="card error">{err}</div>}
        {loading && (
          <div className="card" role="status" aria-live="polite">
            Cargando…
          </div>
        )}

        {/* Panel: Caducan */}
        {!loading && !err && (
          <div
            id="panel-caducan"
            role="tabpanel"
            aria-labelledby="tab-caducan"
            hidden={tab !== "caducan"}
          >
            <div className="table-wrapper">
              <table className="w-full">
                <caption className="sr-only">Lotes próximos a caducar</caption>
                <thead>
                  <tr>
                    <th scope="col">NOMBRE DEL PRODUCTO</th>
                    <th scope="col">NÚMERO DE LOTE</th>
                    <th scope="col">CANTIDAD</th>
                    <th scope="col">FECHA DE CADUCIDAD</th>
                    <th scope="col">DÍAS RESTANTES</th>
                    <th scope="col" className="sr-only">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.length ? (
                    rowsCaducan
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                        <em>No hay lotes próximos a caducar</em>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Panel: Reorden */}
        {!loading && !err && (
          <div
            id="panel-reorden"
            role="tabpanel"
            aria-labelledby="tab-reorden"
            hidden={tab !== "reorden"}
          >
            <div className="table-wrapper">
              <table className="w-full">
                <caption className="sr-only">Sugerencias de reordenamiento</caption>
                <thead>
                  <tr>
                    <th scope="col">MEDICAMENTO</th>
                    <th scope="col">CANTIDAD SUGERIDA</th>
                    <th scope="col">RAZÓN Y FACTORES</th>
                    <th scope="col">ESTADO</th>
                    <th scope="col" className="text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {mlAlerts.length ? (
                    rowsReorden
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                        <em>No hay sugerencias generadas. Haz clic en "Recalcular" para generarlas.</em>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}