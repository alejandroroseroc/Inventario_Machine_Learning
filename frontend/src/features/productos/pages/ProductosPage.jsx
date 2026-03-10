import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../../../styles/productos.css";
import ProductoForm from "../components/ProductoForm";
import ProductoTable from "../components/ProductoTable";
import { importarCSV } from "../importService";
import { productoCreate, productosList } from "../service";

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const fileInputRef = useRef(null);


  async function load() {
    setLoading(true); setError(""); setOk("");
    try { const data = await productosList(); setItems(Array.isArray(data) ? data : []); }
    catch (e) { setError(e?.message || "No se pudieron cargar los productos."); console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

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
      e.target.value = ""; // Reset input
    }
  }

  return (
    <div className="page page--productos">
      <div className="page__head">
        <h2 className="page__title" id="pf_title">Inventario</h2>

        <div className="page__actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn--secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Importando..." : "📁 Importar CSV"}
          </button>
          <Link to="/panel" className="btn">⬅️ Volver al Panel</Link>
        </div>
      </div>


      <section className="help" aria-labelledby="ayuda_inv_titulo">
        <h3 id="ayuda_inv_titulo">¿Cómo registrar un medicamento?</h3>
        <ol>
          <li>Escribe <strong>Código</strong> y <strong>Nombre</strong> tal como los usas en la droguería.</li>
          <li>Ingresa el <strong>Valor unitario</strong>. Con eso sugerimos <strong>Categoría ABC</strong> y <strong>ROP</strong>.</li>
          <li>Si quieres, desactiva “Auto-sugerir” para ajustar manualmente la categoría o el ROP.</li>
          <li>Guarda el producto. Lo verás en la tabla de abajo.</li>
        </ol>
        <p className="help__note">
          * Estas sugerencias son temporales. Cuando carguemos ventas reales, el sistema propondrá valores basados en tu historial.
        </p>
      </section>

      {error && <div className="alert alert--error" role="alert">{error}</div>}
      {ok && <div className="alert alert--ok" role="status">{ok}</div>}

      <ProductoForm onSubmit={handleCreate} submitting={creating} />

      <h3 style={{ marginTop: 24 }}>Listado</h3>
      {loading ? <p>Cargando…</p> : <ProductoTable items={items} />}
    </div>
  );
}
