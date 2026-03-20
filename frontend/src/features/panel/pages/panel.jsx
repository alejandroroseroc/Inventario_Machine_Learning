// src/features/panel/pages/panel.jsx
import { useEffect, useState } from "react";
import "../../../styles/panel.css";
import { getKpis } from "../api";

import KpiCard from "../components/KpiCard.jsx";
import MlSummaryCard from "../components/MlSummaryCard.jsx";
import RecentEvents from "../components/RecentEvents.jsx";
import SalesChart from "../components/SalesChart.jsx";

function formatCurrency(v) {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n}`;
  }
}

export default function Panel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await getKpis();
        if (live) {
          setData(res);
          setLoading(false);
        }
      } catch (e) {
        if (live) {
          setError(e?.payload?.detail || "No se pudieron cargar los KPIs");
          setLoading(false);
        }
      }
    })();
    return () => { live = false; };
  }, []);

  const valor = data?.valor_total ?? 0;
  // tolerante a posible typo del backend: porcentaje_riticos
  const criticos = data?.porcentaje_criticos ?? data?.porcentaje_riticos ?? 0;
  const porVencer = data?.por_vencer ?? 0;
  const eventos = data?.transacciones_recientes ?? [];

  return (
    <div className="panel-wrap">
      {/* Encabezado sin CTA (alineado a la izquierda) */}
      <div className="panel-head panel-head--left">
        <div>
          <h1 className="panel-title">Panel</h1>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Resumen del inventario y actividad reciente
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="kpi-grid">
        <KpiCard
          title="Valor total inventario"
          value={formatCurrency(valor)}
          loading={loading}
        />
        <KpiCard
          title="% productos críticos"
          value={`${criticos}%`}
          loading={loading}
        />
        <KpiCard
          title="Lotes por vencer (≤ 2m)"
          value={porVencer}
          loading={loading}
        />
      </section>

      {/* ML Summary Card */}
      <MlSummaryCard countPorVencer={porVencer} />

      {/* Grid Inferior: Gráfico y Transacciones */}
      <section className="dashboard-grid">
        <SalesChart data={data?.ventas_semana} />
        <RecentEvents items={eventos} loading={loading} />
      </section>

      {/* Error */}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
