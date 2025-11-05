// src/features/productos/repository.js
import { http } from "../../api/http";

const BASE = "/inventory/productos";

export async function repoGetProductos() {
  return http.get(BASE, { auth: true });
}

export async function repoCreateProducto(payload) {
  return http.post(BASE, { body: payload, auth: true });
}

// ---- Detalle / edición / borrado / forecast ----
export async function getProductoById(id) {
  return http.get(`${BASE}/${id}`, { auth: true });
}

export async function updateProducto(id, payload) {
  // usa PUT enviando el objeto completo
  return http.put(`${BASE}/${id}`, { body: payload, auth: true });
}

export async function deleteProducto(id) {
  return http.del(`${BASE}/${id}`, { auth: true });
}

export async function getProductoForecast(id) {
  return http.get(`${BASE}/${id}/forecast`, { auth: true });
}
