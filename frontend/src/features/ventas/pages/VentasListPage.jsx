import { useEffect, useState } from "react";
import { listarVentas, anularVenta, cierreDelDia } from "../repository";

export default function VentasListPage() {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0,10));
  const [ventas, setVentas] = useState([]);
  const [cierre, setCierre] = useState(null);

  const load = async (f) => {
    const v = await listarVentas(f); setVentas(v);
    const c = await cierreDelDia(f); setCierre(c);
  };

  useEffect(() => { load(fecha); }, [fecha]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ventas del día</h1>

      <div className="flex items-center gap-2">
        <input type="date" value={fecha} onChange={(e)=>setFecha(e.target.value)} className="border rounded px-3 py-2"/>
        <button className="px-3 py-2 border rounded" onClick={()=>load(fecha)}>Actualizar</button>
      </div>

      {cierre && (
        <div className="border rounded p-3">
          <div><b>Fecha:</b> {cierre.fecha}</div>
          <div><b>Ventas registradas:</b> {cierre.ventas_registradas}</div>
          <div><b>Anuladas:</b> {cierre.ventas_anuladas}</div>
          <div><b>Total del día:</b> ${Number(cierre.total_dia).toLocaleString("es-CO")}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2">#</th>
              <th className="text-left">Fecha/Hora</th>
              <th className="text-right">Total</th>
              <th className="text-left">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map(v => (
              <tr key={v.id} className="border-t">
                <td className="py-2">{v.id}</td>
                <td>{new Date(v.fecha).toLocaleString()}</td>
                <td className="text-right">${Number(v.total).toLocaleString("es-CO")}</td>
                <td>{v.anulada ? "ANULADA" : "OK"}</td>
                <td className="text-right">
                  {!v.anulada && (
                    <button className="text-red-600" onClick={async ()=>{
                      if (!confirm(`¿Anular venta #${v.id}?`)) return;
                      await anularVenta(v.id);
                      load(fecha);
                    }}>Anular</button>
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
