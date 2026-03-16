// src/api/alerts.repository.js
import { http } from "./http";

const AlertsRepository = {
  // Lista de alertas de stock (estado: activa|resuelta)
  list: ({ estado = "activa", page = 1, page_size = 100, usuario_id = null } = {}) => {
    const q = new URLSearchParams({
      estado,
      page: String(page),
      page_size: String(page_size),
    });
    if (usuario_id) q.append("usuario_id", usuario_id);
    return http.get(`/inventory/alertas/stock?${q.toString()}`, { auth: true });
  },

  // Recalcular alertas de stock (baseline)
  recalc: () =>
    http.post(`/inventory/alertas/stock/recalcular`, { body: null, auth: true }),

  // Recalcular alertas usando predicción ML (h = horizonte en días)
  recalcPredict: (h = 14, usuario_id = null) => {
    const q = new URLSearchParams({ h: String(h) });
    if (usuario_id) q.append("usuario_id", usuario_id);
    return http.post(`/inventory/alertas/stock/recalcular_predict?${q.toString()}`, { body: null, auth: true });
  },

  // Resolver una alerta
  resolve: (id) =>
    http.patch(`/inventory/alertas/${id}/resolver`, { auth: true }),

  // (Opcionales) — solo si implementas en backend
  listByReason: ({ reason, estado = "activa" }) => {
    const q = new URLSearchParams({ reason, estado });
    return http.get(`/inventory/alertas/stock/by_reason?${q.toString()}`, { auth: true });
  },

  summaryByReason: ({ estado = "activa" } = {}) => {
    const q = new URLSearchParams({ estado });
    return http.get(`/inventory/alertas/stock/summary_by_reason?${q.toString()}`, { auth: true });
  },
};

export default AlertsRepository;
