// src/features/productos/components/ProductosTable.jsx
export default function ProductoTable({ items }) {
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
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td style={td}>{p.id}</td>
              <td style={td}>{p.codigo}</td>
              <td style={td}>{p.nombre}</td>
              <td style={td}>{p.categoria}</td>
              <td style={td}>{p.punto_reorden}</td>
              <td style={td}>${Number(p.valor_unitario).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" };
const td = { borderBottom: "1px solid #eee", padding: "8px" };
