import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Hash, XCircle, Search } from "lucide-react";
import { AlertsService } from "../../api/alerts.service";
import { listLotesPorVencer } from "../lotes/repository";
import RevisarLoteModal from "./RevisarLoteModal";

const factorLabel = (factor) => {
  if (factor === "ma7") return "Tendencia (MA7)";
  if (factor === "lag1") return "Ultimo dia";
  if (factor === "lag7") return "Hace 1 semana";
  if (factor === "es_quincena") return "Efecto quincena";
  if (factor === "es_fin_mes") return "Fin de mes";
  if (typeof factor === "string" && factor.startsWith("dow_")) {
    const index = parseInt(factor.split("_")[1], 10);
    const map = { 1: "Lun", 2: "Mar", 3: "Mie", 4: "Jue", 5: "Vie", 6: "Sab" };
    return map[index] || factor;
  }
  return factor || "Tendencia";
};

const reasonText = (alerta) => {
  const top = alerta?.explicacion?.top || [];
  if (!top.length) return "Estimacion de demanda historica";

  const first = top[0]?.factor;
  if (first === "ma7") return "La tendencia reciente sostiene la sugerencia";
  if (first === "lag1" || first === "lag7") return "El comportamiento reciente del producto sigue estable";
  if (typeof first === "string" && first.startsWith("dow_")) {
    return `La demanda suele subir los ${factorLabel(first)}`;
  }
  return `Factor principal: ${factorLabel(first)}`;
};

const parseSuggestedUnits = (mensaje) => {
  if (!mensaje) return null;
  const match = String(mensaje).match(/Sugerido\s+(\d+)\s*ud/i);
  return match ? Number(match[1]) : null;
};

const daysLeft = (isoDate) => {
  try {
    const target = new Date(isoDate);
    const today = new Date();
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const getConfidenceMeta = (expParam = {}) => {
  const exp = expParam || {};
  // Modelos sin datos suficientes → gris, sin confianza
  if (exp.modelo === "insuficiente" || exp.modelo === "actividad_insuficiente" || exp.modelo === "error") {
    return {
      score: 0,
      label: "Sin datos",
      color: "#94a3b8",
      text: "No hay ventas recientes suficientes para generar una prediccion confiable.",
      detail: "Se requiere historial de ventas para sugerir cantidades.",
    };
  }

  const r2 = Number.isFinite(exp?.r2) ? exp.r2 : null;
  const wape = Number.isFinite(exp?.wape) ? exp.wape : null;
  const mae = Number.isFinite(exp?.mae) ? exp.mae : null;

  const r2Score = r2 == null ? 0 : clamp01(r2);
  const wapeScore = wape == null ? r2Score : clamp01(1 - wape);
  const score = Math.round(((r2Score * 0.35) + (wapeScore * 0.65)) * 100);

  if (score >= 75) {
    return {
      score,
      label: "Alta confianza",
      color: "#27ae60",
      text: "La sugerencia es consistente con la demanda reciente y el error historico es bajo.",
      detail: mae == null ? "Lista para aprobar" : `Error medio diario aprox.: ${mae.toFixed(2)} uds`,
    };
  }

  if (score >= 55) {
    return {
      score,
      label: "Confianza moderada",
      color: "#f39c12",
      text: "La prediccion es util para decidir compra, aunque conviene revisar contexto comercial.",
      detail: mae == null ? "Revisar antes de aprobar" : `Error medio diario aprox.: ${mae.toFixed(2)} uds`,
    };
  }

  return {
    score,
    label: "Revision recomendada",
    color: "#e74c3c",
    text: "La demanda es mas inestable y se recomienda revisar el pedido antes de aprobarlo.",
    detail: mae == null ? "Validar con el equipo" : `Error medio diario aprox.: ${mae.toFixed(2)} uds`,
  };
};


export default function AlertsAndSuggestions() {
  const [tab, setTab] = useState("caducan");
  const [estado, setEstado] = useState("activa");
  const [diasVenc, setDiasVenc] = useState(60);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expiring, setExpiring] = useState([]);
  const [mlAlerts, setMlAlerts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loteRevisar, setLoteRevisar] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setErr("");
    try {
      const lotesRaw = await listLotesPorVencer({ dias: diasVenc, estado });
      const lotes = asArray(lotesRaw).map((item) => ({
        id: item.lote_id || item.id,
        productoNombre: item.producto_nombre || item.producto?.nombre || "-",
        numeroLote: item.numero_lote || item.numero || "-",
        cantidad: item.stock_lote || item.cantidad || 0,
        fechaCaducidad: item.fecha_caducidad,
        diasRestantes: item.days_left ?? daysLeft(item.fecha_caducidad),
      }));

      const alerts = await AlertsService.list({ estado });
      const mlOnly = alerts.filter((item) => item?.explicacion && Array.isArray(item.explicacion.top));

      setExpiring(lotes);
      setMlAlerts(mlOnly);
    } catch (error) {
      console.error("Error cargando alertas:", error);
      setErr(error?.response?.data?.detail || "No fue posible cargar datos.");
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
    } catch (error) {
      alert(error?.response?.data?.detail || "No fue posible actualizar la alerta.");
    }
  };

  const onRecalcPredict = async () => {
    try {
      await AlertsService.recalcPredict(14);
      await cargar();
      alert("Sugerencias recalculadas con prediccion de 14 dias.");
    } catch (error) {
      alert(error?.response?.data?.detail || "No fue posible recalcular con prediccion.");
    }
  };

  const filteredExpiring = useMemo(() => {
    if (!searchTerm) return expiring;
    const lower = searchTerm.toLowerCase();
    return expiring.filter(row => {
        const name = (row.productoNombre || "").toLowerCase();
        const lote = (row.numeroLote || "").toLowerCase();
        return name.includes(lower) || lote.includes(lower);
    });
  }, [expiring, searchTerm]);

  const rowsCaducan = useMemo(
    () =>
      filteredExpiring.map((row, index) => {
        const dias = row.diasRestantes;
        const caducado = dias != null && dias < 0;
        const estadoDia = dias == null ? "-" : caducado ? "Caducada" : dias;

        let diasClass = "text-dias-normal";
        if (dias == null) diasClass = "";
        else if (dias <= 30) diasClass = "text-dias-red";
        else if (dias <= 45) diasClass = "text-dias-orange";

        return (
          <tr key={row.id || index}>
            <td>{row.productoNombre}</td>
            <td>{row.numeroLote}</td>
            <td>{row.cantidad ? `${row.cantidad} unidades` : "-"}</td>
            <td className="mono">{row.fechaCaducidad || "-"}</td>
            <td className={diasClass}>{caducado ? "Caducada" : estadoDia}</td>
            <td className="text-right">
              {row.cantidad > 0 ? (
                <button type="button" className="link" onClick={() => setLoteRevisar(row)}>
                  Revisar
                </button>
              ) : (
                <span className="text-dias-normal">Gestionado</span>
              )}
            </td>
          </tr>
        );
      }),
    [filteredExpiring],
  );

  const filteredMlAlerts = useMemo(() => {
    if (!searchTerm) return mlAlerts;
    const lower = searchTerm.toLowerCase();
    return mlAlerts.filter(a => {
        const name = (a.producto_nombre || a.productoNombre || "").toLowerCase();
        const code = (a.productoCodigoBarras || a.productoCodigo || "").toLowerCase();
        return name.includes(lower) || code.includes(lower);
    });
  }, [mlAlerts, searchTerm]);

  const rowsReorden = useMemo(
    () =>
      filteredMlAlerts.map((alerta) => {
        const cant = parseSuggestedUnits(alerta.mensaje);
        const explicacion = alerta.explicacion || {};
        const meta = getConfidenceMeta(explicacion);
        const barcode = alerta.productoCodigoBarras;
        const idDisplay = barcode || alerta.productoCodigo || "Sin ID";
        const r2 = Number.isFinite(explicacion.r2) ? Math.max(0, Math.round(explicacion.r2 * 100)) : null;
        const wape = Number.isFinite(explicacion.wape) ? Math.round(explicacion.wape * 100) : null;

        return (
          <tr key={alerta.id}>
            <td>
              <div>
                <strong style={{ fontSize: "1.05rem", color: "#111", display: "block", marginBottom: 2 }}>
                  {alerta.producto_nombre || alerta.productoNombre || "Nombre no disponible"}
                </strong>
                <div style={{ fontSize: "0.8rem", color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "monospace",
                      background: "#f0f0f0",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: "0.78rem",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <Hash size={12} strokeWidth={2.5} color="#64748b" />
                    {idDisplay}
                  </span>
                </div>
              </div>
            </td>

            <td>
              <strong style={{ fontSize: "1.1rem", color: "#2c5aa0" }}>
                {Number.isFinite(cant) ? `${cant} uds` : alerta.mensaje}
              </strong>
              {explicacion.safety > 0 && (
                <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 2 }}>
                  Incl. {explicacion.safety} uds de seguridad
                </div>
              )}
            </td>

            <td>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 2 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: meta.color === "#27ae60" ? "#27ae60" : "#ddd",
                      boxShadow: meta.color === "#27ae60" ? "0 0 6px #27ae60aa" : "none",
                    }}
                  />
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: meta.color === "#f39c12" ? "#f39c12" : "#ddd",
                      boxShadow: meta.color === "#f39c12" ? "0 0 6px #f39c12aa" : "none",
                    }}
                  />
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: meta.color === "#e74c3c" ? "#e74c3c" : "#ddd",
                      boxShadow: meta.color === "#e74c3c" ? "0 0 6px #e74c3caa" : "none",
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: meta.color, marginBottom: 3 }}>
                    {meta.label} ({meta.score}%)
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#555", lineHeight: 1.4, maxWidth: 240 }}>
                    {meta.text}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                    {meta.detail}
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: 4 }}>
                    R2: {r2 == null ? "-" : `${r2}%`} | WAPE: {wape == null ? "-" : `${wape}%`}
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: 2 }}>
                    {reasonText(alerta)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "#888", marginTop: 4 }}>
                    <Calendar size={12} strokeWidth={2.5} color="#64748b" />
                    Para los proximos {explicacion.h || 14} dias
                  </div>
                </div>
              </div>
            </td>

            <td>
              <span className="tag tag-blue">Sugerencia ML</span>
            </td>

            <td className="text-right" style={{ verticalAlign: "middle" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => onResolve(alerta.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "115px", justifyContent: "flex-start" }}
                >
                  <CheckCircle2 size={16} />
                  Aprobar
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => onResolve(alerta.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "115px", justifyContent: "flex-start" }}
                >
                  <XCircle size={16} />
                  Rechazar
                </button>
              </div>
            </td>
          </tr>
        );
      }),
    [filteredMlAlerts],
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
            Articulos que caducan
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

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", minWidth: 250 }}>
              <Search size={16} color="#9ca3af" />
              <input
                type="text"
                placeholder="Buscar por medicamento o codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "0.9rem", color: "#1e293b" }}
              />
            </div>

            <div className="controls row gap-2" style={{ marginTop: 0 }}>
              <label htmlFor="sel-estado">Estado:</label>
              <select id="sel-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="activa">Activas</option>
              <option value="resuelta">Resueltas</option>
            </select>

            {tab === "caducan" ? (
              <>
                <label htmlFor="dias-input">Dias:</label>
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
                Recalcular (con prediccion)
              </button>
            )}
            </div>
          </div>
        </div>

        {err && <div className="card error">{err}</div>}
        {loading && (
          <div className="card" role="status" aria-live="polite">
            Cargando...
          </div>
        )}

        {!loading && !err && (
          <div id="panel-caducan" role="tabpanel" aria-labelledby="tab-caducan" hidden={tab !== "caducan"}>
            <div className="table-wrapper">
              <table className="w-full">
                <caption className="sr-only">Lotes proximos a caducar</caption>
                <thead>
                  <tr>
                    <th scope="col">NOMBRE DEL PRODUCTO</th>
                    <th scope="col">NUMERO DE LOTE</th>
                    <th scope="col">CANTIDAD</th>
                    <th scope="col">FECHA DE CADUCIDAD</th>
                    <th scope="col">DIAS RESTANTES</th>
                    <th scope="col" className="sr-only">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpiring.length ? (
                    rowsCaducan
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 20 }}>
                        <em>No hay lotes que coincidan con la busqueda o proximos a caducar</em>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !err && (
          <div id="panel-reorden" role="tabpanel" aria-labelledby="tab-reorden" hidden={tab !== "reorden"}>
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
                  {filteredMlAlerts.length ? (
                    rowsReorden
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
                        <em>No hay sugerencias generadas que coincidan con la busqueda. Haz clic en "Recalcular" para generarlas.</em>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
