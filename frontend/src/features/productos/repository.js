// src/features/productos/repository.js
import { http } from "../../api/http";

const BASE = "/inventory/productos";

export async function repoGetProductos() {
  return http.get(BASE, { auth: true });
}

export async function repoCreateProducto(payload) {
  return http.post(BASE, { body: payload, auth: true });
}
