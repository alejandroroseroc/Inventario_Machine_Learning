export function toApiProducto(ui) {
  return {
    codigo: String(ui.codigo || "").trim(),
    nombre: String(ui.nombre || "").trim(),
    categoria: String(ui.categoria || "C").toUpperCase(),
    punto_reorden: Number.isFinite(ui.punto_reorden) ? ui.punto_reorden : parseInt(ui.punto_reorden || 0, 10),
    valor_unitario: typeof ui.valor_unitario === "number"
      ? ui.valor_unitario
      : parseFloat(String(ui.valor_unitario || "0").replace(",", ".")),
  };
}

export function fromApiProducto(api) {
  return {
    id: api.id,
    codigo: api.codigo,
    nombre: api.nombre,
    categoria: api.categoria,
    punto_reorden: api.punto_reorden,
    valor_unitario: api.valor_unitario,
  };
}

export function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}
