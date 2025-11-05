import { useEffect, useState } from "react";
import { AlertsService } from "../../api/alerts.service";
import AlertPill from "../../components/AlertPill";

export default function AlertsPage() {
  const [estado, setEstado] = useState("activa");     // activa | resuelta
  const [cargando, setCargando] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const data = await AlertsService.list({ tipo: "stock", estado });
      setItems(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "No fue posible cargar alertas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, [estado]);

  const onRecalc = async () => {
    try {
      await AlertsService.recalc();
      await cargar();
      alert("Alertas recalculadas.");
    } catch (e) {
      alert(e?.response?.data?.detail || "No fue posible recalcular.");
    }
  };

  const onResolve = async (id) => {
    try {
      await AlertsService.resolve(id);
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.detail || "No fue posible resolver la alerta.");
    }
  };

  return (
    <section className="alerts-wrapper">
      <header className="alerts-header">
        <h1>Alertas de Stock (ROP)</h1>

        <div className="alerts-controls">
          <div className="control">
            <label htmlFor="estado">Estado:</label>
            <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="activa">Activas</option>
              <option value="resuelta">Resueltas</option>
            </select>
          </div>

          <button className="btn primary" onClick={onRecalc}>
            Recalcular
          </button>

          <button className="btn ghost" onClick={cargar}>
            Refrescar
          </button>
        </div>
      </header>

      {cargando && <div className="card">Cargando…</div>}
      {error && <div className="card error">{error}</div>}

      {!cargando && !error && (
        <div className="alerts-grid">
          {items.length === 0 && (
            <div className="card">Sin alertas para mostrar.</div>
          )}

          {items.map((a) => (
            <article key={a.id} className="card alert-item">
              <div className="row between">
                <strong>{a.productoCodigo} — {a.productoNombre}</strong>
                <AlertPill severity={a.severidad} />
              </div>

              <p className="msg">{a.mensaje}</p>

              <div className="meta">
                <span className="tag">{a.tipo}</span>
                <span className={`tag ${a.estado === "activa" ? "tag-red" : "tag-green"}`}>{a.estado}</span>
                {a.creadoEn && <span className="tag">{new Date(a.creadoEn).toLocaleString()}</span>}
              </div>

              {a.estado === "activa" && (
                <div className="row end">
                  <button className="btn danger" onClick={() => onResolve(a.id)}>
                    Marcar como resuelta
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
