// src/features/panel/pages/panel.jsx
import { useEffect, useState } from "react";
import { getKpis } from "../api";
import { Link } from "react-router-dom";

function KpiCard({ title, value, loading }) {
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{loading ? "…" : value}</div>
    </div>
  );
}

function RecentEvents({ items = [], loading }) {
  return (
    <div className="events-box">
      <div style={{fontWeight:700, marginBottom:8}}>Transacciones recientes</div>
      {loading ? <p>Cargando…</p> : (
        <ul>{items.length ? items.map((t,i)=><li key={i}>• {t}</li>) : <li>• Sin eventos</li>}</ul>
      )}
    </div>
  );
}

function formatCurrency(valueStr){
  const n = Number(valueStr ?? 0);
  try { return new Intl.NumberFormat("es-CO",{ style:"currency", currency:"COP", maximumFractionDigits:0 }).format(n); }
  catch { return `${n}`; }
}

export default function Panel(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try {
        const res = await getKpis();               // ← ahora siempre con auth
        if (mounted) { setData(res); setLoading(false); }
      } catch (err) {
        if (mounted) { 
          setError(err?.payload?.detail || "No se pudieron cargar los KPIs"); 
          setLoading(false); 
        }
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
        <div className="kpi-card" style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Link to="/productos">Ir a Productos</Link>
        </div>
      </div>

      <RecentEvents items={eventos} loading={loading}/>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
