// src/features/lotes/service.js
import {
  listLotesByProducto,
  createLote,
  listLotesPorVencer,
} from "./repository";

export const lotesService = {
  listByProducto: listLotesByProducto,
  create: createLote,
  porVencer: listLotesPorVencer,
};
