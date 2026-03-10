"""
Servicio para gestionar lotes próximos a vencer o ya caducados.

Regla de negocio colombiana:
  - > 30 días para vencer  → devolucion_proveedor (recupera inversión)
  - ≤ 30 días (o caducado) → baja_vencimiento     (pérdida total)
"""
from datetime import date

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from inventory.models import Lote, Movimiento, Alerta


class GestionVencimientoError(Exception):
    """Error de validación en gestión de vencimiento."""
    pass


@transaction.atomic
def gestionar_vencimiento(*, usuario, lote_id: int) -> dict:
    """
    Procesa un lote próximo a vencer o caducado:
     1. Determina acción (devolución o baja).
     2. Registra el movimiento con tipo adecuado.
     3. Pone stock_lote = 0.
     4. Resuelve alertas de caducidad asociadas.

    Returns:
        dict con info del resultado.
    """
    try:
        lote = Lote.objects.select_for_update().select_related("producto").get(id=lote_id)
    except Lote.DoesNotExist:
        raise GestionVencimientoError("Lote no encontrado.")

    if lote.stock_lote <= 0:
        raise GestionVencimientoError("Este lote ya no tiene stock disponible.")

    # ── Regla de los 30 días ──────────────────────────────────────────
    hoy = date.today()
    dias_restantes = (lote.fecha_caducidad - hoy).days

    if dias_restantes > 30:
        tipo = "devolucion_proveedor"
        accion_label = "Devolución a proveedor"
    else:
        tipo = "baja_vencimiento"
        accion_label = "Baja por vencimiento / destrucción"

    cantidad_retirada = lote.stock_lote

    # ── Crear movimiento de trazabilidad ──────────────────────────────
    mov = Movimiento.objects.create(
        producto=lote.producto,
        lote=lote,
        usuario=usuario,
        tipo=tipo,
        cantidad=cantidad_retirada,
        fecha_mov=timezone.now(),
    )

    # ── Poner stock a 0 ──────────────────────────────────────────────
    lote.stock_lote = 0
    lote.save(update_fields=["stock_lote"])

    # ── Resolver alertas de caducidad asociadas ──────────────────────
    alertas_resueltas = Alerta.objects.filter(
        lote=lote,
        tipo="caducidad",
        estado="activa",
    ).update(estado="resuelta", resolved_at=timezone.now())

    return {
        "lote_id": lote.id,
        "producto_id": lote.producto_id,
        "producto_nombre": lote.producto.nombre,
        "tipo_movimiento": tipo,
        "accion": accion_label,
        "cantidad_retirada": cantidad_retirada,
        "dias_restantes": dias_restantes,
        "movimiento_id": mov.id,
        "alertas_resueltas": alertas_resueltas,
    }
