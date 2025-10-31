// src/features/productos/repository.js
import { http } from "../../api/http";   // <- IMPORT CON NOMBRE

const BASE = "/inventory/productos";

export async function repoGetProductos() {
  // GET /api/inventory/productos con auth
  return http.get(BASE, { auth: true });
}

export async function repoCreateProducto(payload) {
  // POST /api/inventory/productos con auth y body
  return http.post(BASE, { auth: true, body: payload });
}
