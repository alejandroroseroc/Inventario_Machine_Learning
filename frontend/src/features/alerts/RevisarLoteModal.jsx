import { useState } from "react";
import { gestionarVencimiento } from "../lotes/repository";

/**
 * Modal de revisión de lote próximo a vencer.
 *
 * Muestra la regla de 30 días:
 *  - >30 días  → Devolución a proveedor (badge verde/azul)
 *  - ≤30 días → Baja por vencimiento   (badge rojo)
 */
export default function RevisarLoteModal({ lote, onClose, onDone }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!lote) return null;

    const dias = lote.diasRestantes;
    const caducado = dias != null && dias < 0;
    const aptoDevolucion = dias != null && dias > 30;

    async function handleConfirm() {
        setLoading(true);
        setError("");
        try {
            await gestionarVencimiento(lote.id);
            onDone?.();
        } catch (e) {
            setError(e?.message || "Error al procesar el lote.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="revisar-title"
            >
                {/* Header */}
                <div className="modal-header">
                    <h2 id="revisar-title" className="modal-title">
                        Revisar lote
                    </h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    {/* Info del lote */}
                    <div className="modal-info-grid">
                        <div className="modal-info-item">
                            <span className="modal-info-label">Producto</span>
                            <span className="modal-info-value">{lote.productoNombre}</span>
                        </div>
                        <div className="modal-info-item">
                            <span className="modal-info-label">N.° Lote</span>
                            <span className="modal-info-value">{lote.numeroLote || "-"}</span>
                        </div>
                        <div className="modal-info-item">
                            <span className="modal-info-label">Cantidad en stock</span>
                            <span className="modal-info-value">{lote.cantidad} unidades</span>
                        </div>
                        <div className="modal-info-item">
                            <span className="modal-info-label">Días restantes</span>
                            <span className="modal-info-value">
                                {caducado ? "Caducado" : `${dias} días`}
                            </span>
                        </div>
                    </div>

                    {/* Badge de estado */}
                    {aptoDevolucion ? (
                        <div className="badge-devolucion">
                            <span className="badge-icon">🔄</span>
                            <div>
                                <strong>Apto para Devolución al Proveedor</strong>
                                <p>
                                    Faltan más de 30 días. El lote puede devolverse al proveedor
                                    para recuperar parte de la inversión (cupones).
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="badge-baja">
                            <span className="badge-icon">⚠️</span>
                            <div>
                                <strong>Plazo vencido — Pérdida Total</strong>
                                <p>
                                    {caducado
                                        ? "Este lote ya caducó."
                                        : `Solo quedan ${dias} día(s).`}{" "}
                                    Debe registrarse como baja por vencimiento / destrucción.
                                </p>
                            </div>
                        </div>
                    )}

                    {error && <div className="modal-error">{error}</div>}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn modal-btn-cancel"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`btn ${aptoDevolucion ? "modal-btn-devolucion" : "modal-btn-baja"}`}
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        {loading
                            ? "Procesando…"
                            : aptoDevolucion
                                ? "📦 Registrar Devolución"
                                : "🗑️ Registrar Baja"}
                    </button>
                </div>
            </div>
        </div>
    );
}
