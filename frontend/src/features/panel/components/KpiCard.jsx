export default function KpiCard({ title, value, subtitle, loading=false }){
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{loading ? "…" : value}</div>
      {subtitle && <div className="kpi-sub">{subtitle}</div>}
    </div>
  );
}
