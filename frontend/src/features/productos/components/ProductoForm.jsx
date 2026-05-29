import { useEffect, useMemo, useState } from "react";

const CATS = [
  { value: "A", label: "A (alta rotación/valor)" },
  { value: "B", label: "B (media)" },
  { value: "C", label: "C (baja)" },
];

export default function ProductoForm({ onSubmit, submitting }) {
  const [auto, setAuto] = useState(true);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    categoria: "C",
    punto_reorden: 5,
    valor_unitario: 0,
    precio_costo: 0,
    margen_ganancia: 0,
  });

  const [loteForm, setLoteForm] = useState({
    numero_lote: "",
    fecha_caducidad: "",
    cantidad: "",
  });

  function update(k, v) { setForm((s) => ({ ...s, [k]: v })); }
  function updateLote(k, v) { setLoteForm((s) => ({ ...s, [k]: v })); }

  // Auto-calcular valor_unitario cuando cambian precio_costo o margen_ganancia
  useEffect(() => {
    const pc = Number(form.precio_costo || 0);
    const mg = Number(form.margen_ganancia || 0);
    if (pc > 0 && mg > 0) {
      const venta = Math.round(pc * (1 + mg / 100) * 100) / 100;
      setForm((s) => ({ ...s, valor_unitario: venta }));
    }
  }, [form.precio_costo, form.margen_ganancia]);

  const precioAutoCalculado = Number(form.precio_costo || 0) > 0 && Number(form.margen_ganancia || 0) > 0;

  const sugeridos = useMemo(() => {
    const vu = Number(form.valor_unitario || 0);
    let categoria = "C";
    if (vu >= 50000) categoria = "A";
    else if (vu >= 20000) categoria = "B";
    const ropByCat = { A: 20, B: 10, C: 5 };
    return { categoria, rop: ropByCat[categoria] };
  }, [form.valor_unitario]);

  useEffect(() => {
    if (auto) setForm((s) => ({ ...s, categoria: sugeridos.categoria, punto_reorden: sugeridos.rop }));
  }, [auto, sugeridos.categoria, sugeridos.rop]);

  const tieneAlgunCampoLote = loteForm.numero_lote || loteForm.fecha_caducidad || loteForm.cantidad;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (tieneAlgunCampoLote) {
      if (!loteForm.fecha_caducidad || !loteForm.cantidad) {
        setFormError("Si ingresas stock inicial, la fecha de vencimiento y la cantidad son obligatorias.");
        return;
      }
      if (Number(loteForm.cantidad) < 1) {
        setFormError("La cantidad del lote inicial debe ser al menos 1.");
        return;
      }
    }

    const productoData = {
      codigo: String(form.codigo || "").trim(),
      nombre: String(form.nombre || "").trim(),
      categoria: String(form.categoria || "C").toUpperCase(),
      punto_reorden: Number(form.punto_reorden || 0),
      valor_unitario: Number(
        typeof form.valor_unitario === "number"
          ? form.valor_unitario
          : String(form.valor_unitario || "0").replace(",", ".")
      ),
      precio_costo: Number(form.precio_costo || 0),
      margen_ganancia: Number(form.margen_ganancia || 0),
    };

    if (tieneAlgunCampoLote) {
      productoData.lote_inicial = {
        numero_lote: loteForm.numero_lote.trim() || null,
        fecha_caducidad: loteForm.fecha_caducidad,
        stock_lote: Number(loteForm.cantidad),
      };
    }

    const ok = await onSubmit?.(productoData);
    if (ok) {
      setForm({
        codigo: "",
        nombre: "",
        categoria: auto ? sugeridos.categoria : "C",
        punto_reorden: auto ? sugeridos.rop : 5,
        valor_unitario: 0,
        precio_costo: 0,
        margen_ganancia: 0,
      });
      setLoteForm({ numero_lote: "", fecha_caducidad: "", cantidad: "" });
      setFormError("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" aria-labelledby="pf_title">
      {formError && <div className="alert alert--error" role="alert">{formError}</div>}
      <div className="row">
        <div className="col">
          <label htmlFor="pf_codigo">Código</label>
          <input
            id="pf_codigo"
            value={form.codigo}
            onChange={(e) => update("codigo", e.target.value)}
            required
            aria-describedby="pf_codigo_hint"
          />
          <small id="pf_codigo_hint" className="hint">Usa el código del proveedor o interno de la droguería.</small>
        </div>

        <div className="col">
          <label htmlFor="pf_nombre">Nombre</label>
          <input
            id="pf_nombre"
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            required
            aria-describedby="pf_nombre_hint"
          />
          <small id="pf_nombre_hint" className="hint">Nombre comercial o genérico que usas en el mostrador.</small>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <div className="row row--tight">
            <div className="col">
              <label htmlFor="pf_categoria">Categoría ABC</label>
              <select
                id="pf_categoria"
                value={form.categoria}
                onChange={(e) => update("categoria", e.target.value)}
                disabled={auto}
              >
                {CATS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div className="col col--auto">
              <span className="label--tiny" id="pf_auto_label">Auto-sugerir</span>
              <div className="switch" role="group" aria-labelledby="pf_auto_label">
                <input type="checkbox" id="autoABC" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <label htmlFor="autoABC">ABC/ROP</label>
              </div>
            </div>
          </div>
          <small className="hint" id="pf_abc_hint">
            <strong>¿Qué es ABC?</strong> A = más importantes/rotación alta, B = media, C = baja. Hoy se sugiere por precio y podrás ajustarlo.
          </small>
        </div>

        <div className="col">
          <label htmlFor="pf_rop">Punto de reorden (unidades)</label>
          <input
            id="pf_rop"
            type="number"
            min={0}
            value={form.punto_reorden}
            onChange={(e) => update("punto_reorden", e.target.value)}
            disabled={auto}
            aria-describedby="pf_rop_hint"
          />
          <small id="pf_rop_hint" className="hint">Mientras no haya historial, sugerimos A=20, B=10, C=5 (editable).</small>
        </div>
      </div>

      {/* ── Bloque de precios ── */}
      <div className="row">
        <div className="col">
          <small className="hint" style={{ display: "block", marginBottom: 8 }}>
            Si ingresas costo y margen, el precio de venta se calcula automáticamente.
          </small>
        </div>
      </div>
      <div className="row">
        <div className="col">
          <label htmlFor="pf_costo">Precio Costo (COP)</label>
          <input
            id="pf_costo"
            type="number"
            step="0.01"
            min={0}
            value={form.precio_costo}
            onChange={(e) => update("precio_costo", e.target.value)}
            aria-describedby="pf_costo_hint"
          />
          <small id="pf_costo_hint" className="hint">Precio al que llega del laboratorio/proveedor.</small>
        </div>

        <div className="col">
          <label htmlFor="pf_margen">Margen de Ganancia (%)</label>
          <input
            id="pf_margen"
            type="number"
            step="0.01"
            min={0}
            placeholder="Ej: 15"
            value={form.margen_ganancia}
            onChange={(e) => update("margen_ganancia", e.target.value)}
            aria-describedby="pf_margen_hint"
          />
          <small id="pf_margen_hint" className="hint">Solo escribe el número (ej: 15 para 15%).</small>
        </div>

        <div className="col">
          <label htmlFor="pf_valor">Precio Venta (COP)</label>
          <input
            id="pf_valor"
            type="number"
            step="0.01"
            min={0}
            value={form.valor_unitario}
            onChange={(e) => update("valor_unitario", e.target.value)}
            readOnly={precioAutoCalculado}
            disabled={precioAutoCalculado}
            aria-describedby="pf_valor_hint"
            style={precioAutoCalculado ? { background: "#f1f5f9", cursor: "not-allowed" } : {}}
          />
          <small id="pf_valor_hint" className="hint">
            {precioAutoCalculado
              ? "Calculado automáticamente. Limpia costo/margen para editar manualmente."
              : "Usado para sugerir la categoría inicial."}
          </small>
        </div>
      </div>

      {/* ── Sección Stock inicial (opcional) ── */}
      <div className="row" style={{ marginTop: 8 }}>
        <div className="col col--full">
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px" }}>
            <legend style={{ fontWeight: 600, fontSize: "0.9rem", padding: "0 6px", color: "#475569" }}>
              Stock inicial <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span>
            </legend>
            <small className="hint" style={{ display: "block", marginBottom: 10 }}>
              Opcional: puedes agregar el primer lote ahora o hacerlo después desde el detalle del producto.
              {tieneAlgunCampoLote ? " Si ingresas algún campo, fecha de vencimiento y cantidad son obligatorios." : ""}
            </small>
            <div className="row">
              <div className="col">
                <label htmlFor="pf_lote_num">Número de Lote</label>
                <input
                  id="pf_lote_num"
                  type="text"
                  placeholder="Ej: LOT-2024-001"
                  value={loteForm.numero_lote}
                  onChange={(e) => updateLote("numero_lote", e.target.value)}
                />
              </div>
              <div className="col">
                <label htmlFor="pf_lote_fecha">
                  Fecha de Vencimiento{tieneAlgunCampoLote ? " *" : ""}
                </label>
                <input
                  id="pf_lote_fecha"
                  type="date"
                  value={loteForm.fecha_caducidad}
                  onChange={(e) => updateLote("fecha_caducidad", e.target.value)}
                  required={!!tieneAlgunCampoLote}
                />
              </div>
              <div className="col">
                <label htmlFor="pf_lote_cant">
                  Cantidad inicial{tieneAlgunCampoLote ? " *" : ""}
                </label>
                <input
                  id="pf_lote_cant"
                  type="number"
                  min={1}
                  placeholder="Unidades"
                  value={loteForm.cantidad}
                  onChange={(e) => updateLote("cantidad", e.target.value)}
                  required={!!tieneAlgunCampoLote}
                />
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      <div className="row">
        <div className="col col--full">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </div>
    </form>
  );
}
