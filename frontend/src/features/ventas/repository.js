import { http } from "../../api/http";

// Buscar productos por nombre/código/EAN
export async function buscarProductos(term) {
  const q = encodeURIComponent(term);
  return http.get(`/inventory/productos?search=${q}`, { auth: true });
}

// Listar lotes del producto (para elegir manualmente si quiero)
export async function listarLotes(productoId) {
  return http.get(`/inventory/lotes?producto=${Number(productoId)}`, { auth: true });
}

// Buscar por número de LOTE (soporta lector o digitado)
export async function buscarLotePorNumero(numero) {
  const q = encodeURIComponent(numero);
  return http.get(`/inventory/lotes?numero_lote=${q}`, { auth: true });
}

// Crear UNA venta (1 ítem) -> backend espera { items: [...] }
export async function crearVentaUnit({ producto, cantidad, precio_unitario, lote }) {
  const body = { items: [{ producto, cantidad, precio_unitario, ...(lote ? { lote } : {}) }] };
  return http.post(`/inventory/ventas`, { body, auth: true });
}

// Ventas del día (sin parámetro = hoy)
export async function listarVentasHoy() {
  return http.get(`/inventory/ventas`, { auth: true });
}

// Resumen/cierre del día
export async function getCierreDia(fechaIso) {
  const qs = fechaIso ? `?fecha=${encodeURIComponent(fechaIso)}` : "";
  return http.get(`/inventory/ventas/cierre${qs}`, { auth: true });
}

// Anular venta (devuelve stock)
export async function anularVenta(id) {
  return http.del(`/inventory/ventas/${id}`, { auth: true });
}

// Historial mensual de ventas
export async function getHistorialMensual() {
  return http.get(`/inventory/ventas/historial-mensual`, { auth: true });
}

// Historial detallado paginado
export async function getHistorialPaginado(year, month, page = 1) {
  const q = new URLSearchParams({ page });
  if (year) q.set("year", year);
  if (month) q.set("month", month);
  return http.get(`/inventory/ventas/historial?${q.toString()}`, { auth: true });
}
