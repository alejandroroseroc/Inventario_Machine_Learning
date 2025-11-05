import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductoForm from "../components/ProductoForm";
import ProductoTable from "../components/ProductoTable";
import { productoCreate, productosList } from "../service";

import "../../../styles/productos.css";

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setOk("");
    try {
      const data = await productosList();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los productos.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(form) {
    setCreating(true);
    setError("");
    setOk("");
    try {
      await productoCreate(form);
      setOk("Producto guardado correctamente.");
      await load();
      return true;
    } catch (e) {
      setError(e?.message || "No se pudo crear el producto.");
      return false;
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page page--productos">
      <div className="page__head">
        <h2 className="page__title">Inventario</h2>
        <Link to="/panel" className="link-back">← Volver al Panel</Link>
      </div>

      <section className="help">
        <h3>¿Cómo registrar un medicamento?</h3>
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

      {error && <div className="alert alert--error">{error}</div>}
      {ok && <div className="alert alert--ok">{ok}</div>}

      <ProductoForm onSubmit={handleCreate} submitting={creating} />

      <h3 style={{ marginTop: 24 }}>Listado</h3>
      {loading ? <p>Cargando…</p> : <ProductoTable items={items} />}
    </div>
  );
}
