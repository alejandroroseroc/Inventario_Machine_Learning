import {
  AlertCircle,
  BarChart3,
  Database,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertsService } from "../../../api/alerts.service";

const FACTOR_LABEL = (f) => {
  if (f === "ma7") return "Tendencia (MA7)";
  if (f === "lag1") return "Último día";
  if (f === "lag7") return "Hace 1 semana";
  if (f === "es_quincena") return "Efecto quincena";
  if (f === "es_fin_mes") return "Fin de mes";
  if (typeof f === "string" && f.startsWith("dow_")) {
    const k = parseInt(f.split("_")[1], 10);
    const map = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
    return map[k] || f;
  }
  return f || "—";
};

const asArray = (x) => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.results)) return x.results;
  if (Array.isArray(x?.data)) return x.data;
  return [];
};

const parseSuggestedUnits = (msg) => {
  if (!msg) return null;
  const m = String(msg).match(/Sugerido\s+(\d+)\s*ud/i);
  return m ? Number(m[1]) : null;
};

function ConfBadge({ r2 }) {
  if (r2 == null) return <span style={{ color: "#94a3b8" }}>—</span>;
  const pct = Math.max(0, Math.min(100, Math.round(r2 * 100)));
  let color = "#ef4444", label = "Baja";
  if (r2 > 0.95) { color = "#f97316"; label = "Overfitting"; }
  else if (r2 >= 0.80) { color = "#22c55e"; label = "Alta"; }
  else if (r2 >= 0.60) { color = "#eab308"; label = "Moderada"; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        background: color, color: "#fff", borderRadius: 6,
        padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700,
        textTransform: "uppercase"
      }}>{label}</span>
      <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>{pct}%</span>
    </span>
  );
}

function Chip({ label, value, Icon }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0",
      padding: "16px 24px", textAlign: "left", flex: "1", minWidth: 160,
      boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
      display: "flex", justifyContent: "space-between", alignItems: "flex-start"
    }}>
      <div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>{value}</div>
      </div>
      {Icon && <Icon size={20} color="#94a3b8" strokeWidth={2.5} />}
    </div>
  );
}

function ModelBadge({ modelo }) {
  const isXgb = modelo === "xgboost";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: isXgb ? "#ede9fe" : "#dbeafe",
      color: isXgb ? "#7c3aed" : "#2563eb",
      padding: "5px 12px", borderRadius: 8,
      fontSize: "0.75rem", fontWeight: 700,
      border: `1px solid ${isXgb ? "#ddd6fe" : "#bfdbfe"}`
    }}>
      <Database size={13} strokeWidth={2.5} />
      {isXgb ? "XGBoost" : "Reg. Lineal"}
    </span>
  );
}

export default function AdminMLPanel() {
  const [mlAlerts, setMlAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [estado, setEstado] = useState("activa");
  const [selectedUser, setSelectedUser] = useState("");
  const [pharmacists, setPharmacists] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { http } = await import("../../../api/http");
        const resp = await http.get("/auth/users", { auth: true });
        setPharmacists(Array.isArray(resp) ? resp : []);
      } catch (e) {
        console.error("Error al cargar farmacéuticos", e);
      }
    };
    fetchUsers();
  }, []);

  const cargar = async () => {
    setLoading(true);
    setErr("");
    try {
      const alerts = await AlertsService.list({
        estado,
        usuario_id: selectedUser || null
      });
      setMlAlerts(asArray(alerts));
    } catch (e) {
      setErr(e?.response?.data?.detail || "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [estado, selectedUser]);

  const onRecalc = async () => {
    setLoading(true);
    try {
      await AlertsService.recalcPredict(14, selectedUser || null);
      await cargar();
      alert("Sugerencias recalculadas correctamente.");
    } catch (e) {
      alert(e?.response?.data?.detail || "Error al recalcular.");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteUser = async () => {
    if (!selectedUser) return;
    const userObj = pharmacists.find(u => String(u.id) === String(selectedUser));
    const confirmPopup = window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${userObj?.username || userObj?.email}"? Esta acción no se puede deshacer.`);
    if (!confirmPopup) return;

    setLoading(true);
    try {
      const { http } = await import("../../../api/http");
      await http.del(`/auth/users/${selectedUser}`, { auth: true });
      alert("Usuario eliminado correctamente.");
      setSelectedUser("");
      const resp = await http.get("/auth/users", { auth: true });
      setPharmacists(Array.isArray(resp) ? resp : []);
    } catch (e) {
      alert(e?.response?.data?.detail || "Error al eliminar usuario.");
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const total = mlAlerts.length;
    const alta = mlAlerts.filter((a) => (a.explicacion?.r2 ?? 0) >= 0.80 && (a.explicacion?.r2 ?? 0) <= 0.95).length;
    const xgb = mlAlerts.filter((a) => a.explicacion?.modelo === "xgboost").length;
    const lin = mlAlerts.filter((a) => a.explicacion?.modelo === "linear" || a.explicacion?.modelo === "lineal").length;
    return { total, alta, xgb, lin };
  }, [mlAlerts]);

  const rows = useMemo(() =>
    mlAlerts.map((a) => {
      const exp = a.explicacion || {};
      const cant = parseSuggestedUnits(a.mensaje);
      const topFactor = exp.top?.[0]?.factor;
      const barcode = a.productoCodigoBarras;
      return (
        <tr key={a.id}>
          <td>
            <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 3 }}>
              {a.producto_nombre || a.productoNombre || "—"}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4, display: "inline-block" }}>
              {barcode || a.productoCodigo || "Sin ID"}
            </div>
          </td>
          <td><ModelBadge modelo={exp.modelo} /></td>
          <td><ConfBadge r2={exp.r2} /></td>
          <td style={{ color: "#64748b", fontFamily: "monospace" }}>
            {exp.mae != null ? `±${exp.mae.toFixed(2)}` : "—"}
          </td>
          <td style={{ color: "#64748b", fontFamily: "monospace" }}>
            {exp.rmse != null ? exp.rmse.toFixed(2) : "—"}
          </td>
          <td style={{ color: "#64748b" }}>{exp.h || 14}d</td>
          <td style={{ color: "#0369a1", fontSize: "0.82rem", fontWeight: 600 }}>
            {FACTOR_LABEL(topFactor)}
          </td>
          <td>
            <strong style={{ color: "#2563eb", fontSize: "1rem" }}>
              {Number.isFinite(cant) ? `${cant} uds` : a.mensaje}
            </strong>
          </td>
        </tr>
      );
    }),
    [mlAlerts]
  );

  return (
    <section style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 32px" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#eff6ff", color: "#2563eb", padding: "5px 12px", borderRadius: 8,
                fontSize: "0.75rem", fontWeight: 700, letterSpacing: 0.5, border: "1px solid #dbeafe"
              }}>
                <ShieldCheck size={14} strokeWidth={2.5} />
                SOLO ADMINISTRADOR
              </span>
            </div>
            <h1 style={{ color: "#1e293b", margin: 0, fontSize: "2rem", fontWeight: 850, letterSpacing: "-0.02em" }}>
              Panel de Predicción ML
            </h1>
            <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: "1rem", fontWeight: 500 }}>
              Métricas técnicas y supervisión de modelos de aprendizaje automático
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", padding: "8px 14px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <User size={16} color="#64748b" strokeWidth={2.5} />
              <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 700 }}>Farmacéutico:</span>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                style={{
                  background: "transparent", border: "none",
                  color: "#1e293b", fontSize: "0.85rem", fontWeight: 600,
                  outline: "none", cursor: "pointer"
                }}
              >
                <option value="">(Mio / Todos)</option>
                {pharmacists.map(u => (
                  <option key={u.id} value={u.id}>{u.username || u.email}</option>
                ))}
              </select>
            </div>

            {selectedUser && (
              <button
                onClick={onDeleteUser}
                className="btn-danger-light"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3",
                  borderRadius: 12, padding: "10px 18px", fontSize: "0.85rem", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s"
                }}
              >
                <Trash2 size={16} />
                Eliminar Usuario
              </button>
            )}

            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              style={{
                background: "#fff", border: "1px solid #e2e8f0",
                color: "#1e293b", borderRadius: 12, padding: "12px 16px", fontSize: "0.85rem",
                fontWeight: 700, outline: "none", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}
            >
              <option value="activa">Alertas Activas</option>
              <option value="resuelta">Alertas Resueltas</option>
            </select>

            <button
              onClick={onRecalc}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 12,
                padding: "12px 24px", fontWeight: 750, cursor: "pointer", fontSize: "0.9rem",
                boxShadow: "0 4px 12px rgba(37,99,235,0.2)", transition: "transform 0.2s"
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <RefreshCw size={18} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
              Recalcular Predicciones
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <Chip label="Total Sugerencias" value={metrics.total} Icon={BarChart3} />
          <Chip label="Alta Confianza" value={metrics.alta} Icon={ShieldCheck} />
          <Chip label="Modelos XGBoost" value={metrics.xgb} Icon={Database} />
          <Chip label="Modelos Reg. Lineal" value={metrics.lin} Icon={Database} />
        </div>

        {err && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c", borderRadius: 12, padding: "16px", marginBottom: 24, fontWeight: 600 }}>
            <AlertCircle size={20} />
            {err}
          </div>
        )}
        {loading && (
          <div style={{ color: "#64748b", textAlign: "center", padding: 60, fontSize: "1.1rem", fontWeight: 500 }}>
            <div className="animate-spin" style={{ display: "inline-block", marginBottom: 12 }}>
              <RefreshCw size={30} color="#2563eb" strokeWidth={2.5} />
            </div>
            <p>Procesando datos de inteligencia artificial...</p>
          </div>
        )}

        {!loading && !err && (
          <div style={{
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Medicamento", "Modelo", "Confianza (R²)", "MAE", "RMSE", "Horizonte", "Factor Principal", "Sugerencia"].map((h) => (
                      <th key={h} style={{
                        padding: "16px 20px", textAlign: "left",
                        fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.05em",
                        color: "#64748b", textTransform: "uppercase",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: "#1e293b" }}>
                  {mlAlerts.length ? rows : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: "1rem" }}>
                        No hay sugerencias registradas para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        table tbody tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.2s;
        }
        table tbody tr:hover {
          background: #f1f5f966;
        }
        table tbody td {
          padding: 16px 20px;
          vertical-align: middle;
        }
        .btn-danger-light:hover {
          background: #ffe4e6 !important;
          transform: translateY(-1px);
        }
      `}</style>
    </section>
  );
}
