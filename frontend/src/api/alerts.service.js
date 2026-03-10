import AlertsRepository from "./alerts.repository";

const fromApi = (a) => ({
  id: a.id,
  tipo: a.tipo,
  estado: a.estado,
  severidad: a.criticidad,
  mensaje: a.mensaje,
  productoId: a.producto,
  productoCodigo: a.producto_codigo,
  productoNombre: a.producto_nombre,
  productoCodigoBarras: a.producto_codigo_barras,
  loteId: a.lote,
  creadoEn: a.created_at,
  resueltoEn: a.resolved_at,
  explicacion: a.explicacion || null,
});

export const AlertsService = {
  async list({ estado = "activa", page = 1, page_size = 100 } = {}) {
    const data = await AlertsRepository.list({ estado, page, page_size });
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    return items.map(fromApi);
  },

  async recalc() {
    return AlertsRepository.recalc();
  },

  async recalcPredict(h = 14) {
    return AlertsRepository.recalcPredict(h);
  },

  async resolve(id) {
    await AlertsRepository.resolve(id);
    return true;
  },
};

export default AlertsService;
