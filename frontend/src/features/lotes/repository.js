// src/features/lotes/repository.js
import { http } from "../../api/http";

const BASE = "/inventory/lotes";

export async function listLotesByProducto(productoId) {
  return http.get(`${BASE}?producto=${productoId}`, { auth: true });
}

export async function createLote(payload) {
  // payload: { producto, fecha_caducidad, stock_lote }
  return http.post(BASE, { body: payload, auth: true });
}

export async function listLotesPorVencer({ productoId, dias = 60 }) {
  const q = new URLSearchParams();
  if (productoId) q.set("producto", productoId);
  if (dias) q.set("dias", String(dias));
  return http.get(`/inventory/lotes/por-vencer?${q.toString()}`, { auth: true });
}
