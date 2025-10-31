// src/features/productos/service.js
import { repoGetProductos, repoCreateProducto } from "./repository";

export async function productosList() {
  const data = await repoGetProductos();
  // data es un array de productos del backend
  return data;
}

export async function productoCreate(dto) {
  // Normalización mínima → números
  const payload = {
    codigo: (dto.codigo || "").trim(),
    nombre: (dto.nombre || "").trim(),
    categoria: dto.categoria || "C",
    punto_reorden: Number(dto.punto_reorden || 0),
    valor_unitario: Number(dto.valor_unitario || 0),
  };

  if (!payload.codigo) throw new Error("El código es obligatorio.");
  if (!payload.nombre) throw new Error("El nombre es obligatorio.");

  const created = await repoCreateProducto(payload);
  return created;
}
