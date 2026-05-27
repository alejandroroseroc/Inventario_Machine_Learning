import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import "../../../styles/productos.css";
import ProductoForm from "../components/ProductoForm";
import ProductoTable from "../components/ProductoTable";
import { FileUp, ArrowLeft, Search } from "lucide-react";
import { importarCSV } from "../importService";
import { productoCreate, productosList } from "../service";
import { marcarVencidosAuto, listLotesVencidos, listLotesDevoluciones } from "../../lotes/repository";

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  // Pestañas de inventario
  const [tabInventario, setTabInventario] = useState("activos");
  const [lotesVencidos, setLotesVencidos] = useState([]);
  const [lotesDevoluciones, setLotesDevoluciones] = useState([]);
  const [loadingListas, setLoadingListas] = useState(false);

  // Estilos de tabla compartidos
  const thStyle = {
    padding: "10px 12px", textAlign: "left",
    fontWeight: 700, fontSize: "0.8rem",
    color: "#475569", borderBottom: "2px solid #e2e8f0",
  };
  const tdStyle = {
    padding: "10px 12px", fontSize: "0.9rem",
    verticalAlign: "middle",
  };

  async function load() {
    setLoading(true); setError(""); setOk("");
    try { const data = await productosList(); setItems(Array.isArray(data) ? data : []); }
    catch (e) { setError(e?.message || "No se pudieron cargar los productos."); console.error(e); }
    finally { setLoading(false); }
  }

  async function loadListasEspeciales() {
    setLoadingListas(true);
    try {
      await marcarVencidosAuto();
      const [venc, devol] = await Promise.all([
        listLotesVencidos(),
        listLotesDevoluciones(),
      ]);
      setLotesVencidos(Array.isArray(venc?.results) ? venc.results : []);
      setLotesDevoluciones(Array.isArray(devol?.results) ? devol.results : []);
    } catch (e) {
      console.error("Error cargando listas especiales:", e);
    } finally {
      setLoadingListas(false);
    }
  }

  useEffect(() => {
    load();
    loadListasEspeciales();
  }, []);

  async function handleCreate(form) {
    setCreating(true); setError(""); setOk("");
    try { await productoCreate(form); setOk("Producto guardado correctamente."); await load(); return true; }
    catch (e) { setError(e?.message || "No se pudo crear el producto."); return false; }
    finally { setCreating(false); }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true); setError(""); setOk("");
    try {
      const res = await importarCSV(file);
      setOk(res.message || `Se importaron ${res.count} registros.`);
      await load();
    } catch (e) {
      setError(e?.message || "Error al importar el archivo CSV.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item => {
      const name = (item.nombre || "").toLowerCase();
      const code = (item.codigo || "").toLowerCase();
      const barcode = (item.codigo_barras || "").toLowerCase();
      return name.includes(lower) || code.includes(lower) || barcode.includes(lower);
    });
  }, [items, searchTerm]);

  return (
    <div className="page page--productos">
      <div className="page__head">
        <h2 className="page__title" id="pf_title">Inventario</h2>

        <div className="page__actions" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImport}
            style={{ display: "none" }}
          />
          <button
            className="btn btn--secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#1e293b" }}
          >
            <FileUp size={18} color="#4f46e5" strokeWidth={2.5} />
            {importing ? "Importando..." : "Importar CSV"}
          </button>
          <Link
            to="/panel"
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#1e293b" }}
          >
            <ArrowLeft size={18} color="#64748b" strokeWidth={2.5} />
            Volver al Panel
          </Link>
        </div>
      </div>

      {/* Pestañas de inventario */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { key: "activos", label: "✅ Medicamentos Activos" },
          {
            key: "vencidos",
            label: `🔴 Vencidos${lotesVencidos.length > 0 ? ` (${lotesVencidos.length})` : ""}`,
          },
          {
            key: "devoluciones",
            label: `🟡 Devoluciones${lotesDevoluciones.length > 0 ? ` (${lotesDevoluciones.length})` : ""}`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTabInventario(t.key)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "transparent",
              borderBottom: tabInventario === t.key ? "3px solid #2563eb" : "3px solid transparent",
              color: tabInventario === t.key ? "#2563eb" : "#64748b",
              fontWeight: tabInventario === t.key ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.95rem",
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pestaña Activos ── */}
      {tabInventario === "activos" && (
        <>
          <section className="help" aria-labelledby="ayuda_inv_titulo">
            <h3 id="ayuda_inv_titulo">¿Cómo registrar un medicamento?</h3>
            <ol>
              <li>Escribe <strong>Código</strong> y <strong>Nombre</strong> tal como los usas en la droguería.</li>
              <li>Ingresa el <strong>Valor unitario</strong>. Con eso sugerimos <strong>Categoría ABC</strong> y <strong>ROP</strong>.</li>
              <li>Si quieres, desactiva "Auto-sugerir" para ajustar manualmente la categoría o el ROP.</li>
              <li>Guarda el producto. Lo verás en la tabla de abajo.</li>
            </ol>
            <p className="help__note">
              * Estas sugerencias son temporales. Cuando carguemos ventas reales, el sistema propondrá valores basados en tu historial.
            </p>
          </section>

          {error && <div className="alert alert--error" role="alert">{error}</div>}
          {ok && <div className="alert alert--ok" role="status">{ok}</div>}

          <ProductoForm onSubmit={handleCreate} submitting={creating} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Listado</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", minWidth: 250 }}>
              <Search size={16} color="#9ca3af" />
              <input
                type="text"
                placeholder="Buscar medicamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "0.9rem", color: "#1e293b" }}
              />
            </div>
          </div>

          {loading ? <p>Cargando…</p> : <ProductoTable items={filteredItems} />}
        </>
      )}

      {/* ── Pestaña Vencidos ── */}
      {tabInventario === "vencidos" && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ color: "#dc2626", marginTop: 0 }}>🔴 Lotes Vencidos — Pérdida Total</h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Estos lotes ya fueron dados de baja. Se muestra la pérdida a precio costo.
          </p>
          {loadingListas ? <p>Cargando...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fef2f2" }}>
                  <th style={thStyle}>MEDICAMENTO</th>
                  <th style={thStyle}>N° LOTE</th>
                  <th style={thStyle}>VENCIÓ</th>
                  <th style={thStyle}>CANTIDAD</th>
                  <th style={{ ...thStyle, color: "#dc2626" }}>PÉRDIDA (costo)</th>
                </tr>
              </thead>
              <tbody>
                {lotesVencidos.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
                      No hay lotes vencidos registrados
                    </td>
                  </tr>
                ) : lotesVencidos.map((l) => (
                  <tr key={l.lote_id} style={{ borderBottom: "1px solid #fecaca", background: "#fff5f5" }}>
                    <td style={tdStyle}>{l.producto_nombre}</td>
                    <td style={tdStyle}>{l.numero_lote}</td>
                    <td style={tdStyle}>{l.fecha_caducidad}</td>
                    <td style={tdStyle}>{l.stock_retirado} uds</td>
                    <td style={{ ...tdStyle, color: "#dc2626", fontWeight: 700 }}>
                      ${Number(l.perdida_total || 0).toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))}
                {lotesVencidos.length > 0 && (
                  <tr style={{ background: "#fee2e2" }}>
                    <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, textAlign: "right" }}>
                      Total pérdidas:
                    </td>
                    <td style={{ ...tdStyle, color: "#dc2626", fontWeight: 700 }}>
                      ${lotesVencidos.reduce((s, l) => s + Number(l.perdida_total || 0), 0).toLocaleString("es-CO")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Pestaña Devoluciones ── */}
      {tabInventario === "devoluciones" && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ color: "#d97706", marginTop: 0 }}>🟡 Lotes en Devolución al Proveedor</h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Estos lotes fueron enviados a devolución. Pérdida estimada del 50% del precio costo.
          </p>
          {loadingListas ? <p>Cargando...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fffbeb" }}>
                  <th style={thStyle}>MEDICAMENTO</th>
                  <th style={thStyle}>N° LOTE</th>
                  <th style={thStyle}>VENCÍA</th>
                  <th style={thStyle}>CANTIDAD</th>
                  <th style={{ ...thStyle, color: "#d97706" }}>PÉRDIDA 50% (costo)</th>
                </tr>
              </thead>
              <tbody>
                {lotesDevoluciones.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
                      No hay lotes en devolución registrados
                    </td>
                  </tr>
                ) : lotesDevoluciones.map((l) => (
                  <tr key={l.lote_id} style={{ borderBottom: "1px solid #fde68a", background: "#fffdf0" }}>
                    <td style={tdStyle}>{l.producto_nombre}</td>
                    <td style={tdStyle}>{l.numero_lote}</td>
                    <td style={tdStyle}>{l.fecha_caducidad}</td>
                    <td style={tdStyle}>{l.stock_devuelto} uds</td>
                    <td style={{ ...tdStyle, color: "#d97706", fontWeight: 700 }}>
                      ${Number(l.perdida_50 || 0).toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))}
                {lotesDevoluciones.length > 0 && (
                  <tr style={{ background: "#fef3c7" }}>
                    <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, textAlign: "right" }}>
                      Total pérdidas:
                    </td>
                    <td style={{ ...tdStyle, color: "#d97706", fontWeight: 700 }}>
                      ${lotesDevoluciones.reduce((s, l) => s + Number(l.perdida_50 || 0), 0).toLocaleString("es-CO")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
