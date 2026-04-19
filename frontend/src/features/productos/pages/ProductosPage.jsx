import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../../../styles/productos.css";
import ProductoForm from "../components/ProductoForm";
import ProductoTable from "../components/ProductoTable";
import { FileUp, ArrowLeft, Search } from "lucide-react";
import { importarCSV } from "../importService";
import { productoCreate, productosList } from "../service";

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}
          >
            <FileUp size={18} color="#4f46e5" strokeWidth={2.5} />
            {importing ? "Importando..." : "Importar CSV"}
          </button>
          <Link 
            to="/panel" 
            className="btn" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}
          >
            <ArrowLeft size={18} color="#64748b" strokeWidth={2.5} />
            Volver al Panel
          </Link>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
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
    </div>
  );
}
