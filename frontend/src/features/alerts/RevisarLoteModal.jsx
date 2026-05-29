import { useState } from "react";
import { PackageCheck, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { gestionarVencimiento } from "../lotes/repository";

export default function RevisarLoteModal({ lote, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!lote) return null;

  const dias = lote.diasRestantes;
  const caducado = dias != null && dias < 0;
  const aptoDevolucion = dias != null && dias > 30;
  const perdida = aptoDevolucion
    ? lote.precio_costo * lote.cantidad * 0.5
    : lote.precio_costo * lote.cantidad;

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
        <div className="modal-header">
          <h2 id="revisar-title" className="modal-title">Revisar lote</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-info-grid">
            <div className="modal-info-item">
              <span className="modal-info-label">Producto</span>
              <span className="modal-info-value">{lote.productoNombre}</span>
            </div>
            <div className="modal-info-item">
              <span className="modal-info-label">N. Lote</span>
              <span className="modal-info-value">{lote.numeroLote || "-"}</span>
            </div>
            <div className="modal-info-item">
              <span className="modal-info-label">Cantidad en stock</span>
              <span className="modal-info-value">{lote.cantidad} unidades</span>
            </div>
            <div className="modal-info-item">
              <span className="modal-info-label">Dias restantes</span>
              <span className="modal-info-value">{caducado ? "Caducado" : `${dias} dias`}</span>
            </div>
          </div>

          {aptoDevolucion ? (
            <div className="badge-devolucion">
              <span className="badge-icon"><RefreshCw size={18} /></span>
              <div>
                <strong>Apto para devolucion al proveedor</strong>
                <p>
                  Faltan mas de 30 dias. El lote puede devolverse al proveedor
                  para recuperar parte de la inversion.
                </p>
              </div>
            </div>
          ) : (
            <div className="badge-baja">
              <span className="badge-icon"><TriangleAlert size={18} /></span>
              <div>
                <strong>Plazo vencido - perdida total</strong>
                <p>
                  {caducado ? "Este lote ya caduco." : `Solo quedan ${dias} dia(s).`}{" "}
                  Debe registrarse como baja por vencimiento.
                </p>
              </div>
            </div>
          )}

          {lote.precio_costo > 0 && lote.cantidad > 0 && (
            <div className={`loss-preview ${aptoDevolucion ? "loss-preview--return" : "loss-preview--loss"}`}>
              <div className="loss-preview__label">Perdida estimada</div>
              <div className="loss-preview__amount">
                ${Number(perdida).toLocaleString("es-CO")}
              </div>
              <div className="loss-preview__note">
                {aptoDevolucion
                  ? `${lote.cantidad} uds x $${Number(lote.precio_costo).toLocaleString("es-CO")} x 50% devolucion`
                  : `${lote.cantidad} uds x $${Number(lote.precio_costo).toLocaleString("es-CO")} x 100% baja`}
              </div>
            </div>
          )}

          {error && <div className="modal-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn modal-btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${aptoDevolucion ? "modal-btn-devolucion" : "modal-btn-baja"}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              "Procesando..."
            ) : aptoDevolucion ? (
              <>
                <PackageCheck size={16} />
                Registrar devolucion
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Registrar baja
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
