import { Link } from "react-router-dom";
import { Bot } from "lucide-react";

export default function MlSummaryCard({ countPorVencer = 0 }) {
    return (
        <div className="ml-summary-card">
            <div className="ml-summary-content">
                <div className="ml-icon-wrapper">
                    <Bot size={24} color="#6366f1" />
                </div>
                <div className="ml-text">
                    <h3 className="ml-title">Motor de Sugerencias ML</h3>
                    <p className="ml-desc">
                        {countPorVencer > 0
                            ? `El sistema ha detectado ${countPorVencer} lote(s) próximo(s) a vencer que requieren atención.`
                            : "No hay alertas críticas en este momento. El inventario está optimizado."}
                    </p>
                </div>
            </div>
            <div className="ml-action">
                <Link to="/alertas/sugerencias" className="btn btn--primary ml-btn">
                    Revisar Sugerencias
                </Link>
            </div>
        </div>
    );
}
