import { useEffect, useState } from "react";
import { anularVenta, cierreDelDia, listarVentas } from "../repository";

const money = (n) => Number(n || 0).toLocaleString("es-CO");

export default function VentasListPage() {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [ventas, setVentas] = useState([]);
  const [cierre, setCierre] = useState(null);

  const load = async (f) => {
    const v = await listarVentas(f); setVentas(v || []);
    const c = await cierreDelDia(f); setCierre(c || null);
  };
  useEffect(() => { load(fecha); }, [fecha]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ventas del día</h1>

      <div className="actions">
        <label className="sr-only" htmlFor="fechaSel">Fecha</label>
        <input
          id="fechaSel"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button className="btn" onClick={() => load(fecha)}>Actualizar</button>
      </div>

      {cierre && (
        <div className="card">
          <div><b>Fecha:</b> {cierre.fecha}</div>
          <div><b>Ventas registradas:</b> {cierre.ventas_registradas}</div>
          <div><b>Anuladas:</b> {cierre.ventas_anuladas}</div>
          <div><b>Total del día:</b> ${money(cierre.total_dia)}</div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Listado de ventas de la fecha seleccionada</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Fecha/Hora</th>
              <th scope="col" className="text-right">Total</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-right">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-gray-500">Sin registros</td></tr>
            ) : ventas.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{new Date(v.fecha).toLocaleString()}</td>
                <td className="text-right">${money(v.total)}</td>
                <td>{v.anulada ? "ANULADA" : "OK"}</td>
                <td className="text-right">
                  {!v.anulada && (
                    <button
                      className="btn btn--danger"
                      onClick={async () => {
                        if (!confirm(`¿Anular venta #${v.id}?`)) return;
                        try {
                          await anularVenta(v.id);
                          load(fecha);
                        } catch (e) {
                          const msg = e?.response?.data?.detail || e.message || JSON.stringify(e);
                          alert(`No se pudo anular: ${msg}`);
                        }
                      }}
                    >
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
