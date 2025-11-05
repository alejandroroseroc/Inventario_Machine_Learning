import { http } from "../../api/http";

const BASE = "/inventory/movimientos";

/**
 * Enviar siempre:
 *  - producto: ID del producto (no producto_id)
 *  - tipo: "entrada" | "salida" | "ajuste"
 *  - cantidad: número > 0 (en "ajuste" puede ser negativo si tu BE lo permite)
 * Opcional:
 *  - lote: ID del lote (si lo omites y tipo="salida", el BE aplica FEFO)
 */
export async function createMovimiento({ producto, tipo, cantidad, lote }) {
  const body = { producto: Number(producto), tipo, cantidad: Number(cantidad) };
  if (lote) body.lote = Number(lote);
  return http.post(BASE, { body, auth: true });
}
