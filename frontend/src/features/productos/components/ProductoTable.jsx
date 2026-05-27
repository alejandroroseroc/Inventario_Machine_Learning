import { Link } from "react-router-dom";

const cop = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function ProductoTable({ items = [] }) {
  if (!items || items.length === 0) return <p>No hay productos registrados.</p>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Punto Reorden</th>
            <th>PRECIO COSTO</th>
            <th>MARGEN</th>
            <th>
              PRECIO VENTA
              <div style={{ fontSize: "0.7rem", fontWeight: 400, color: "#94a3b8" }}>por unidad</div>
            </th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.codigo}</td>
              <td>{p.nombre}</td>
              <td><Chip kind={p.categoria} /></td>
              <td>{p.punto_reorden}</td>
              <td>{cop(p.precio_costo)}</td>
              <td style={{ color: Number(p.margen_ganancia) > 0 ? "#059669" : "#94a3b8" }}>
                {Number(p.margen_ganancia || 0).toFixed(1)}%
              </td>
              <td>{cop(p.valor_unitario)}</td>
              <td className="text-right">
                <Link to={`/productos/${p.id}`} className="btn">Ver detalle</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ kind }) {
  return <span className={`chip chip--${kind ?? "C"}`}>{kind ?? "C"}</span>;
}
