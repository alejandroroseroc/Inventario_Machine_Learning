import { useEffect, useMemo, useState } from "react";
import { 
  Calendar, 
  Hash, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle 
} from "lucide-react";
import { AlertsService } from "../../api/alerts.service";
import { listLotesPorVencer } from "../lotes/repository";
import RevisarLoteModal from "./RevisarLoteModal";

const factorLabel = (f) => {
  if (f === "ma7") return "Tendencia (MA7)";
  if (f === "lag1") return "Ult. dia";
  if (f === "lag7") return "Hace 1 semana";
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
  const [loteRevisar, setLoteRevisar] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setErr("");
    try {
      // Cargar lotes por vencer
      const lotesRaw = await listLotesPorVencer({ dias: diasVenc, estado });
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
        const caducado = dias != null && dias < 0;
        const estadoDia = dias === null ? "-" : caducado ? "Caducada" : dias;

        // Formato condicional: rojo ≤30, naranja 31-45, normal >45
        let diasClass = "text-dias-normal";
        if (dias === null) diasClass = "";
        else if (dias <= 30) diasClass = "text-dias-red";
        else if (dias <= 45) diasClass = "text-dias-orange";

        return (
          <tr key={r.id || i}>
            <td>{r.productoNombre}</td>
            <td>{r.numeroLote}</td>
            <td>{r.cantidad ? `${r.cantidad} unidades` : "-"}</td>
            <td className="mono">{r.fechaCaducidad || "-"}</td>
            <td className={diasClass}>
              {caducado ? "Caducada" : estadoDia}
            </td>
            <td className="text-right">
              {r.cantidad > 0 ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => setLoteRevisar(r)}
                >
                  Revisar
                </button>
              ) : (
                <span className="text-dias-normal">Gestionado</span>
              )}
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
        const r2 = explicacion.r2;

        // Semáforo farmacéutico (solo colores y texto simple)
        let dotColor = '#e74c3c', confLabel = 'Revisión recomendada', confText = 'La predicción tiene baja certeza. Se recomienda revisar con el equipo antes de ordenar.';
        if (r2 != null) {
          if (r2 > 0.95) {
            dotColor = '#e67e22';
            confLabel = 'Revisar cantidad';
            confText = 'El sistema detectó un patrón inusual. Verifica el pedido antes de aprobarlo.';
          } else if (r2 >= 0.80) {
            dotColor = '#27ae60';
            confLabel = 'Alta confianza';
            confText = 'La sugerencia se basa en un patrón de ventas sólido. Puedes aprobarla con seguridad.';
          } else if (r2 >= 0.60) {
            dotColor = '#f39c12';
            confLabel = 'Confianza moderada';
            confText = 'La predicción es razonable, pero considera revisar el historial del producto.';
          }
        }

        const barcode = a.productoCodigoBarras;
        const idDisplay = barcode || a.productoCodigo || 'Sin ID';

        return (
          <tr key={a.id}>
            {/* ── MEDICAMENTO ── */}
            <td>
              <div>
                <strong style={{ fontSize: '1.05rem', color: '#111', display: 'block', marginBottom: '2px' }}>
                  {a.producto_nombre || a.productoNombre || 'Nombre no disponible'}
                </strong>
                <div style={{ fontSize: '0.8rem', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontFamily: 'monospace', background: '#f0f0f0', padding: '1px 6px',
                    borderRadius: '3px', fontSize: '0.78rem', letterSpacing: '0.5px'
                  }}>
                    <Hash size={12} strokeWidth={2.5} color="#64748b" />
                    {barcode || idDisplay}
                  </span>
                  {barcode && a.productoCodigo && (
                    <span style={{ color: '#999', fontSize: '0.75rem' }}>
                      Cód: {a.productoCodigo}
                    </span>
                  )}
                </div>
              </div>
            </td>

            {/* ── CANTIDAD SUGERIDA ── */}
            <td>
              <strong style={{ fontSize: '1.1rem', color: '#2c5aa0' }}>
                {Number.isFinite(cant) ? `${cant} uds` : a.mensaje}
              </strong>
              {explicacion.safety > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                  Incl. {explicacion.safety} uds seguridad
                </div>
              )}
            </td>

            {/* ── SEMÁFORO DE CONFIANZA (vista farmacéutico) ── */}
            <td>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                {/* Semáforo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', paddingTop: '2px' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: dotColor === '#27ae60' ? '#27ae60' : '#ddd', boxShadow: dotColor === '#27ae60' ? '0 0 6px #27ae60aa' : 'none' }} />
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: dotColor === '#f39c12' ? '#f39c12' : '#ddd', boxShadow: dotColor === '#f39c12' ? '0 0 6px #f39c12aa' : 'none' }} />
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: (dotColor === '#e74c3c' || dotColor === '#e67e22') ? dotColor : '#ddd', boxShadow: (dotColor === '#e74c3c' || dotColor === '#e67e22') ? `0 0 6px ${dotColor}aa` : 'none' }} />
                </div>
                {/* Texto */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: dotColor, marginBottom: '3px' }}>
                    {confLabel}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#555', lineHeight: 1.4, maxWidth: 200 }}>
                    {confText}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                    <Calendar size={12} strokeWidth={2.5} color="#64748b" />
                    Para los próximos {explicacion.h || 14} días
                  </div>
                </div>
              </div>
            </td>

            {/* ── ESTADO ── */}
            <td>
              <span className="tag tag-blue">Sugerencia ML</span>
            </td>

            {/* ── ACCIONES ── */}
            <td className="text-right">
              <button
                type="button"
                className="btn primary"
                onClick={() => onResolve(a.id)}
                style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} />
                Aprobar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => onResolve(a.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <XCircle size={16} />
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
                    <th scope="col">CONFIANZA</th>
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

      {/* Modal de revisión de lote */}
      {loteRevisar && (
        <RevisarLoteModal
          lote={loteRevisar}
          onClose={() => setLoteRevisar(null)}
          onDone={() => {
            setLoteRevisar(null);
            cargar();
          }}
        />
      )}
    </section>
  );
}