export function validateProducto(p) {
  const errors = {};
  const req = (v) => String(v ?? "").trim().length > 0;

  if (!req(p.codigo)) errors.codigo = "El código es requerido.";
  if (!req(p.nombre)) errors.nombre = "El nombre es requerido.";

  const cat = String(p.categoria || "").toUpperCase();
  if (!["A", "B", "C"].includes(cat)) errors.categoria = "La categoría debe ser A, B o C.";

  const rop = Number.isFinite(p.punto_reorden) ? p.punto_reorden : parseInt(p.punto_reorden, 10);
  if (isNaN(rop) || rop < 0) errors.punto_reorden = "El punto de reorden debe ser un entero ≥ 0.";

  const vu = typeof p.valor_unitario === "number" ? p.valor_unitario : parseFloat(String(p.valor_unitario).replace(",", "."));
  if (isNaN(vu) || vu < 0) errors.valor_unitario = "El valor unitario debe ser un número ≥ 0.";

  return errors;
}
