// src/features/panel/components/RecentEvents.jsx
export default function RecentEvents({ items = [], loading = false }) {
  return (
    <div className="events-box">
      <div className="card-title">Transacciones recientes</div>
      <ul className="events">
        {loading && <li className="muted">Cargando…</li>}
        {!loading && items.length === 0 && <li className="muted">Sin eventos</li>}
        {!loading &&
          items.map((t, idx) => (
            <li key={idx}>• {t}</li>
          ))}
      </ul>
    </div>
  );
}
