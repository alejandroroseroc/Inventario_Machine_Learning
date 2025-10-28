import { useEffect, useState } from "react";
import { getKpis } from "../api";
import KpiCard from "../components/KpiCard";
import RecentEvents from "../components/RecentEvents";

function formatCurrency(valueStr){
  const n = Number(valueStr ?? 0);
  try {
    return new Intl.NumberFormat("es-CO",{ style:"currency", currency:"COP", maximumFractionDigits:0 }).format(n);
  } catch {
    return `${n}`;
  }
}

export default function Panel(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try {
        const res = await getKpis();
        if (mounted) { setData(res); setLoading(false); }
      } catch (err) {
        if (mounted) { setError(err?.payload?.detail || "No se pudieron cargar los KPIs"); setLoading(false); }
      }
    })();
    return ()=>{ mounted = false; };
  }, []);

  const valor     = data?.valor_total ?? 0;
  const criticos  = data?.porcentaje_criticos ?? 0;
  const porVencer = data?.por_vencer ?? 0;
  const eventos   = data?.transacciones_recientes ?? [];

  return (
    <div className="panel-wrap">
      <h2 className="panel-title">Panel</h2>

      <div className="kpi-grid">
        <KpiCard title="Valor total inventario" value={formatCurrency(valor)} loading={loading}/>
        <KpiCard title="% productos críticos"   value={`${criticos}%`} loading={loading}/>
        <KpiCard title="Lotes por vencer (≤2m)" value={porVencer} loading={loading}/>
      </div>

      <RecentEvents items={eventos} loading={loading}/>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
