import { Link } from "react-router-dom";

export default function ProductoTable({ items = [] }) {
  if (!items || items.length === 0) {
    return <p>No hay productos registrados.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Código</th>
            <th style={th}>Nombre</th>
            <th style={th}>Categoría</th>
            <th style={th}>Punto Reorden</th>
            <th style={th}>Valor Unitario</th>
            <th style={{ ...th, textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td style={td}>{p.id}</td>
              <td style={td}>{p.codigo}</td>
              <td style={td}>{p.nombre}</td>
              <td style={td}>
                <Badge kind={p.categoria} />
              </td>
              <td style={td}>{p.punto_reorden}</td>
              <td style={td}>${Number(p.valor_unitario).toLocaleString("es-CO")}</td>
              <td style={{ ...td, textAlign: "right" }}>
                <Link
                  to={`/productos/${p.id}`}
                  className="px-3 py-1 rounded-md border hover:bg-gray-100"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ kind }) {
  const map = { A: "#0ea5e9", B: "#22c55e", C: "#f59e0b" };
  return (
    <span
      style={{
        background: map[kind] || "#94a3b8",
        color: "white",
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
      }}
    >
      {kind}
    </span>
  );
}

const th = { textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" };
const td = { borderBottom: "1px solid #eee", padding: "8px" };
