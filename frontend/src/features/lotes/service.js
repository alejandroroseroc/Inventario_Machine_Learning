// src/features/lotes/service.js
import { listLotesByProducto, createLote, listLotesPorVencer } from "./repository";

export const lotesService = {
  listByProducto: listLotesByProducto,
  create: createLote,
  porVencer: listLotesPorVencer,

  async ensureLoteId(productoId, { fechaCaducidad, numeroLote, codigoBarras }) {
    const lotes = await listLotesByProducto(productoId);
    let found = null;

    if (numeroLote) {
      found = (lotes || []).find(l => l.numero_lote === numeroLote);
    }
    if (!found && fechaCaducidad) {
      found = (lotes || []).find(l => l.fecha_caducidad === fechaCaducidad);
    }
    if (found) return found.id;

    const nuevo = await createLote({
      producto: Number(productoId),
      fecha_caducidad: fechaCaducidad,
      stock_lote: 0,
      numero_lote: numeroLote || null,
      codigo_barras: codigoBarras || null,
    });
    return nuevo.id;
  },
};
