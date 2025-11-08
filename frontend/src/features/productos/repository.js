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
  // PUT enviando el objeto completo
  return http.put(`${BASE}/${id}`, { body: payload, auth: true });
}

export async function deleteProducto(id) {
  return http.del(`${BASE}/${id}`, { auth: true });
}

export async function getProductoForecast(id) {
  return http.get(`${BASE}/${id}/forecast`, { auth: true });
}

export async function sugerirRop(productoId, { lookback = 90, lead_time = 5, ss = 0 } = {}) {
  const q = new URLSearchParams({
    lookback: String(lookback),
    lead_time: String(lead_time),
    ss: String(ss),
  }).toString();
  return http.get(`${BASE}/${productoId}/rop_sugerir?${q}`, { auth: true });
}

// PATCH parcial del producto (para guardar el ROP elegido)
export async function patchProducto(id, partial) {
  return http.patch(`${BASE}/${id}`, { body: partial, auth: true });
}
