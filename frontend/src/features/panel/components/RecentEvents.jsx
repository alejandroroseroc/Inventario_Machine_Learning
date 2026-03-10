// Intenta extraer el tipo de transacción de la cadena enviada por el backend, 
// o deduce basado en palabras clave.
function parseEventType(text) {
  const lower = (text || "").toLowerCase();
  if (lower.includes("entrada") || lower.includes("ingreso") || lower.includes("compra") || lower.includes("recib")) return "entrada";
  if (lower.includes("salida") || lower.includes("venta") || lower.includes("vendi")) return "salida";
  if (lower.includes("anulada") || lower.includes("anulación") || lower.includes("baja") || lower.includes("ajuste") || lower.includes("vencimiento")) return "ajuste";
  return "otro";
}

export default function RecentEvents({ items = [], loading = false }) {
  return (
    <div className="events-box">
      <h2 className="card-title">Transacciones Recientes</h2>
      <div className="events-list">
        {loading && <div className="muted text-center py-4">Cargando transacciones…</div>}
        {!loading && items.length === 0 && <div className="muted text-center py-4">No hay eventos recientes.</div>}
        {!loading &&
          items.map((t, idx) => {
            const tipo = parseEventType(t);
            let badgeClass = "badge-gray";
            let badgeText = "Evento";

            if (tipo === "entrada") { badgeClass = "badge-green"; badgeText = "Ingreso"; }
            if (tipo === "salida") { badgeClass = "badge-red"; badgeText = "Venta/Salida"; }
            if (tipo === "ajuste") { badgeClass = "badge-orange"; badgeText = "Ajuste/Anulación"; }

            // Limpiamos el texto si viene con un prefijo tipo "[salida] Venta..."
            const cleanText = t.replace(/^\[.*?\]\s*/, '');

            return (
              <div key={idx} className="event-item">
                <span className={`event-badge ${badgeClass}`}>{badgeText}</span>
                <span className="event-text">{cleanText}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
