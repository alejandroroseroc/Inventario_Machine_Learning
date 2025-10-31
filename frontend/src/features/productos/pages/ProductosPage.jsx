import { useEffect, useState } from "react";
import { productosList, productoCreate } from "../service";
import ProductoTable from "../components/ProductoTable";  // <-- singular
import ProductoForm from "../components/ProductoForm";    // <-- singular
import { Link } from "react-router-dom";


export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await productosList();
      setItems(data || []);
    } catch (e) {
      setError("No se pudieron cargar los productos.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(form) {
    setCreating(true);
    setError("");
    try {
      await productoCreate(form);
      await load();
      return true;
    } catch (e) {
      const msg = e?.message || "No se pudo crear el producto.";
      setError(msg);
      return false;
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Productos</h2>
        <Link to="/panel">← Volver al Panel</Link>
      </div>

      {error ? (
        <div style={{ background: "#ffe8e8", border: "1px solid #ffb3b3", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <ProductoForm onSubmit={handleCreate} submitting={creating} />

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <ProductoTable items={items} />
      )}
    </div>
  );
}
