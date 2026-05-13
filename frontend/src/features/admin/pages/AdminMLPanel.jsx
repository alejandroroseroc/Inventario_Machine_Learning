import {
  AlertCircle,
  BarChart3,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertsService } from "../../../api/alerts.service";

const FACTOR_LABEL = (f) => {
  if (f === "ma7") return "Tendencia (MA7)";
  if (f === "lag1") return "Ultimo dia";
  if (f === "lag7") return "Hace 1 semana";
  if (f === "es_quincena") return "Efecto quincena";
  if (f === "es_fin_mes") return "Fin de mes";
  if (typeof f === "string" && f.startsWith("dow_")) {
    const k = parseInt(f.split("_")[1], 10);
    const map = { 1: "Lunes", 2: "Martes", 3: "Miercoles", 4: "Jueves", 5: "Viernes", 6: "Sabado" };
    return map[k] || f;
  }
  return f || "-";
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

function getConfidenceMeta(expParam = {}) {
  const exp = expParam || {};
  // Modelos sin datos suficientes
  if (exp.modelo === "insuficiente" || exp.modelo === "actividad_insuficiente" || exp.modelo === "error") {
    return { score: 0, color: "#94a3b8", label: "Sin datos" };
  }

  const r2 = Number.isFinite(exp?.r2) ? exp.r2 : null;
  const wape = Number.isFinite(exp?.wape) ? exp.wape : null;

  const r2Score = r2 == null ? 0 : Math.max(0, Math.min(1, r2));
  const wapeScore = wape == null ? r2Score : Math.max(0, Math.min(1, 1 - wape));
  const score = Math.round(((r2Score * 0.35) + (wapeScore * 0.65)) * 100);

  let color = "#ef4444";
  let label = "Baja";
  if (score >= 75) {
    color = "#22c55e";
    label = "Alta";
  } else if (score >= 55) {
    color = "#eab308";
    label = "Moderada";
  }

  return { score, color, label };
}

function ConfBadge({ exp }) {
  const meta = getConfidenceMeta(exp);
  const r2 = Number.isFinite(exp?.r2) ? exp.r2 : null;
  const r2Pct = r2 == null ? null : Math.max(0, Math.min(100, Math.round(r2 * 100)));

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            background: meta.color,
            color: "#fff",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {meta.label}
        </span>
        <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>{meta.score}%</span>
      </span>
      <span style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600 }}>
        R² {r2Pct == null ? "-" : `${r2Pct}%`}
      </span>
    </div>
  );
}

function Chip({ label, value, Icon }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        padding: "16px 24px",
        textAlign: "left",
        flex: "1",
        minWidth: 160,
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 6,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>{value}</div>
      </div>
      {Icon && <Icon size={20} color="#94a3b8" strokeWidth={2.5} />}
    </div>
  );
}

function ModelBadge({ modelo }) {
  const isXgb = modelo === "xgboost";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: isXgb ? "#ede9fe" : "#dbeafe",
        color: isXgb ? "#7c3aed" : "#2563eb",
        padding: "5px 12px",
        borderRadius: 8,
        fontSize: "0.75rem",
        fontWeight: 700,
        border: `1px solid ${isXgb ? "#ddd6fe" : "#bfdbfe"}`,
      }}
    >
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
  const [searchTerm, setSearchTerm] = useState("");
  const [pharmacists, setPharmacists] = useState([]);
  const [notice, setNotice] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const showNotice = (type, title, message = "") => {
    setNotice({ type, title, message });
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { http } = await import("../../../api/http");
        const resp = await http.get("/auth/users", { auth: true });
        setPharmacists(Array.isArray(resp) ? resp : []);
      } catch (e) {
        console.error("Error al cargar farmaceuticos", e);
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
        usuario_id: selectedUser || null,
      });
      setMlAlerts(asArray(alerts));
    } catch (e) {
      setErr(e?.response?.data?.detail || "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [estado, selectedUser]);

  const onRecalc = async () => {
    setLoading(true);
    try {
      await AlertsService.recalcPredict(14, selectedUser || null);
      await cargar();
      showNotice("success", "Predicciones recalculadas", "Las sugerencias se actualizaron correctamente.");
    } catch (e) {
      showNotice("error", "Error al recalcular", e?.response?.data?.detail || "Intentalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteUser = async () => {
    if (deleteCandidate?.id) {
      // Continua con la eliminacion confirmada en el modal.
    } else {
      if (!selectedUser) return;
      const userObj = pharmacists.find((u) => String(u.id) === String(selectedUser));
      setDeleteCandidate(userObj || { id: selectedUser, username: "Usuario seleccionado" });
      return;
    }
    /*
    
      `¿Estas seguro de que deseas eliminar al usuario "${userObj?.username || userObj?.email}"? Esta accion no se puede deshacer.`,
    );
    if (!confirmPopup) return;
    */

    setLoading(true);
    try {
      const { http } = await import("../../../api/http");
      await http.del(`/auth/users/${deleteCandidate.id}`, { auth: true });
      showNotice("success", "Usuario eliminado", `${deleteCandidate.username || deleteCandidate.email || "El usuario"} fue eliminado correctamente.`);
      setSelectedUser("");
      setDeleteCandidate(null);
      const resp = await http.get("/auth/users", { auth: true });
      setPharmacists(Array.isArray(resp) ? resp : []);
    } catch (e) {
      showNotice("error", "Error al eliminar usuario", e?.payload?.detail || e?.response?.data?.detail || e?.message || "Intentalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = useMemo(() => {
    if (!searchTerm) return mlAlerts;
    const lower = searchTerm.toLowerCase();
    return mlAlerts.filter(a => {
      const name = (a.producto_nombre || a.productoNombre || "").toLowerCase();
      const code = (a.productoCodigoBarras || a.productoCodigo || "").toLowerCase();
      return name.includes(lower) || code.includes(lower);
    });
  }, [mlAlerts, searchTerm]);

  const metrics = useMemo(() => {
    const total = filteredAlerts.length;
    const alta = filteredAlerts.filter((a) => getConfidenceMeta(a.explicacion).label === "Alta").length;
    const xgb = filteredAlerts.filter((a) => a.explicacion?.modelo === "xgboost").length;
    const lin = filteredAlerts.filter((a) => a.explicacion?.modelo === "linear" || a.explicacion?.modelo === "lineal").length;
    return { total, alta, xgb, lin };
  }, [filteredAlerts]);

  const rows = useMemo(
    () =>
      filteredAlerts.map((a) => {
        const exp = a.explicacion || {};
        const cant = parseSuggestedUnits(a.mensaje);
        const topFactor = exp.top?.[0]?.factor;
        const barcode = a.productoCodigoBarras;
        return (
          <tr key={a.id}>
            <td>
              <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 3 }}>
                {a.producto_nombre || a.productoNombre || "-"}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "1px 6px",
                  borderRadius: 4,
                  display: "inline-block",
                }}
              >
                {barcode || a.productoCodigo || "Sin ID"}
              </div>
            </td>
            <td>
              <ModelBadge modelo={exp.modelo} />
            </td>
            <td>
              <ConfBadge exp={exp} />
            </td>
            <td style={{ color: "#64748b", fontFamily: "monospace" }}>
              {exp.mae != null ? `±${exp.mae.toFixed(2)}` : "-"}
            </td>
            <td style={{ color: "#64748b", fontFamily: "monospace" }}>
              {exp.rmse != null ? exp.rmse.toFixed(2) : "-"}
            </td>
            <td style={{ color: "#64748b", fontFamily: "monospace" }}>
              {exp.wape != null ? `${Math.round(exp.wape * 100)}%` : "-"}
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
    [mlAlerts],
  );

  return (
    <section style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 32px" }}>
      {notice && (
        <div className={`admin-toast admin-toast--${notice.type}`} role="status" aria-live="polite">
          <strong>{notice.title}</strong>
          {notice.message ? <span>{notice.message}</span> : null}
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#eff6ff",
                  color: "#2563eb",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  border: "1px solid #dbeafe",
                }}
              >
                <ShieldCheck size={14} strokeWidth={2.5} />
                SOLO ADMINISTRADOR
              </span>
            </div>
            <h1 style={{ color: "#1e293b", margin: 0, fontSize: "2rem", fontWeight: 850, letterSpacing: "-0.02em" }}>
              Panel de Prediccion ML
            </h1>
            <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: "1rem", fontWeight: 500 }}>
              Metricas tecnicas y supervision de modelos de aprendizaje automatico
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fff",
                padding: "8px 14px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
              }}
            >
              <User size={16} color="#64748b" strokeWidth={2.5} />
              <span style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 700 }}>Farmaceutico:</span>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#1e293b",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Todos los farmaceuticos</option>
                {pharmacists.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fff",
                padding: "8px 14px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                width: "250px",
              }}
            >
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Buscar por nombre o codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                  fontSize: "0.85rem",
                  color: "#1e293b",
                }}
              />
            </div>

            {selectedUser && (
              <button
                onClick={onDeleteUser}
                className="btn-danger-light"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#fff1f2",
                  color: "#e11d48",
                  border: "1px solid #fecdd3",
                  borderRadius: 12,
                  padding: "10px 18px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
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
                background: "#fff",
                border: "1px solid #e2e8f0",
                color: "#1e293b",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: "0.85rem",
                fontWeight: 700,
                outline: "none",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <option value="activa">Alertas Activas</option>
              <option value="resuelta">Alertas Resueltas</option>
            </select>

            <button
              onClick={onRecalc}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 24px",
                fontWeight: 750,
                cursor: "pointer",
                fontSize: "0.9rem",
                boxShadow: "0 4px 12px rgba(37,99,235,0.2)",
                transition: "transform 0.2s",
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#fef2f2",
              border: "1px solid #fee2e2",
              color: "#b91c1c",
              borderRadius: 12,
              padding: "16px",
              marginBottom: 24,
              fontWeight: 600,
            }}
          >
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
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Medicamento", "Modelo", "Confianza", "MAE", "RMSE", "WAPE", "Horizonte", "Factor Principal", "Sugerencia"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "16px 20px",
                          textAlign: "left",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          letterSpacing: "0.05em",
                          color: "#64748b",
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: "#1e293b" }}>
                  {mlAlerts.length ? (
                    rows
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: "1rem" }}>
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

      {deleteCandidate && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div className="admin-modal__box">
            <div className="admin-modal__header">
              <h2 id="delete-user-title">Eliminar usuario</h2>
              <button type="button" className="admin-modal__close" onClick={() => setDeleteCandidate(null)}>
                x
              </button>
            </div>
            <div className="admin-modal__body">
              <p>
                Estas seguro de que deseas eliminar a <strong>{deleteCandidate.username || deleteCandidate.email}</strong>?
              </p>
              <p className="admin-modal__warning">Esta accion no se puede deshacer.</p>
            </div>
            <div className="admin-modal__footer">
              <button type="button" className="admin-btn" onClick={() => setDeleteCandidate(null)}>
                Cancelar
              </button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={onDeleteUser}>
                Eliminar usuario
              </button>
            </div>
          </div>
        </div>
      )}

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
        .admin-toast {
          position: fixed;
          top: 88px;
          right: 24px;
          z-index: 1100;
          width: min(360px, calc(100vw - 32px));
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 4px 12px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15, 23, 42, .18);
        }
        .admin-toast strong { color: #0f172a; }
        .admin-toast span { grid-column: 1; color: #475569; font-size: 14px; }
        .admin-toast button {
          grid-column: 2;
          grid-row: 1 / span 2;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-weight: 700;
        }
        .admin-toast--success { border-left: 5px solid #16a34a; }
        .admin-toast--error { border-left: 5px solid #dc2626; }
        .admin-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(15, 23, 42, .48);
        }
        .admin-modal__box {
          width: min(460px, 100%);
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
          overflow: hidden;
        }
        .admin-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        .admin-modal__header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 1.15rem;
        }
        .admin-modal__close {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          cursor: pointer;
          font-weight: 700;
        }
        .admin-modal__body {
          padding: 18px 20px;
          color: #334155;
        }
        .admin-modal__body p { margin: 0; }
        .admin-modal__warning {
          margin-top: 10px !important;
          color: #b91c1c;
          font-weight: 700;
          font-size: .9rem;
        }
        .admin-modal__footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px 18px;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
        }
        .admin-btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 700;
          cursor: pointer;
        }
        .admin-btn--danger {
          background: #b91c1c;
          border-color: #991b1b;
          color: #fff;
        }
      `}</style>
    </section>
  );
}
