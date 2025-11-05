import { Link } from "react-router-dom";

export default function ProductoTable({ items = [] }) {
  if (!items || items.length === 0) return <p>No hay productos registrados.</p>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th><th>Código</th><th>Nombre</th><th>Categoría</th><th>Punto Reorden</th><th>Valor Unitario</th><th className="text-right">Acciones</th>
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
              <td>${Number(p.valor_unitario).toLocaleString("es-CO")}</td>
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
