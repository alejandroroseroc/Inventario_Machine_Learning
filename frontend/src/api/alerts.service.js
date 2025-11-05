// src/api/alerts.service.js
import AlertsRepository from "./alerts.repository";

const fromApi = (a) => ({
  id: a.id,
  tipo: a.tipo,
  estado: a.estado,
  severidad: a.severidad,
  mensaje: a.mensaje,
  productoId: a.producto,
  productoCodigo: a.producto_codigo,
  productoNombre: a.producto_nombre,
  loteId: a.lote,
  creadoEn: a.creado_en,
  resueltoEn: a.resuelto_en,
});

export const AlertsService = {
  async list({ tipo = "stock", estado = "activa" } = {}) {
    const data = await AlertsRepository.list({ tipo, estado });
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    return items.map(fromApi);
  },
  async recalc() {
    return AlertsRepository.recalc();
  },
  async resolve(id) {
    await AlertsRepository.resolve(id);
    return true;
  },
};

export default AlertsService;
