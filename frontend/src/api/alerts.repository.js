// src/api/alerts.repository.js
import http from "./http";

export const AlertsRepository = {
  list: ({ tipo = "stock", estado = "activa", page = 1, page_size = 100 } = {}) =>
    http.get("/inventory/alertas", { params: { tipo, estado, page, page_size } }),

  recalc: () =>
    http.post("/inventory/alertas/recalcular", null),

  resolve: (id) =>
    http.patch(`/inventory/alertas/${id}/resolver`, null),
};

export default AlertsRepository;
