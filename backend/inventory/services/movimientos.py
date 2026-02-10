from datetime import date
from typing import List, Optional

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from inventory.models import Producto, Lote, Movimiento
from .alertas import asegurar_alerta_stock


class StockError(Exception):
    """Error cuando no hay stock suficiente."""
    pass


class MovimientoValidationError(Exception):
    """Error de validación en movimientos."""
    pass


@transaction.atomic
def registrar_movimiento(
    *, usuario, producto_id: int, tipo: str, cantidad: int,
    lote_id: Optional[int] = None, fecha_caducidad: Optional[date] = None,
    motivo: Optional[str] = None,
) -> List[Movimiento]:
    """
    Registra un movimiento de inventario (entrada, salida o ajuste).
    Usa FEFO para salidas sin lote específico.
    """
    try:
        producto = Producto.objects.get(id=producto_id)
    except Producto.DoesNotExist:
        raise MovimientoValidationError("Producto no encontrado.")

    if tipo not in ("entrada", "salida", "ajuste"):
        raise MovimientoValidationError("Tipo de movimiento inválido.")

    if tipo in ("entrada", "salida") and cantidad <= 0:
        raise MovimientoValidationError("La cantidad debe ser > 0 para entrada/salida.")
    if tipo == "ajuste" and cantidad == 0:
        raise MovimientoValidationError("La cantidad de ajuste no puede ser 0.")

    movimientos_creados: List[Movimiento] = []

    def lotes_fefo_qs():
        return (
            Lote.objects.select_for_update()
            .filter(producto=producto, stock_lote__gt=0)
            .order_by("fecha_caducidad", "id")
        )

    if tipo == "entrada":
        if lote_id:
            lote = Lote.objects.select_for_update().get(id=lote_id, producto=producto)
        else:
            if not fecha_caducidad:
                raise MovimientoValidationError(
                    "Para ENTRADA envía 'lote_id' o 'fecha_caducidad' para crear lote."
                )
            lote = Lote.objects.create(
                producto=producto,
                fecha_caducidad=fecha_caducidad,
                stock_lote=0,
            )
        lote.stock_lote = F("stock_lote") + int(cantidad)
        lote.save(update_fields=["stock_lote"])
        lote.refresh_from_db()

        mov = Movimiento.objects.create(
            producto=producto,
            lote=lote,
            usuario=usuario,
            tipo="entrada",
            cantidad=int(cantidad),
            fecha_mov=timezone.now(),
        )
        if motivo and hasattr(mov, "motivo"):
            mov.motivo = motivo
            mov.save(update_fields=["motivo"])
        movimientos_creados.append(mov)
        asegurar_alerta_stock(producto)
        return movimientos_creados

    if tipo == "salida":
        if lote_id:
            lote = Lote.objects.select_for_update().get(id=lote_id, producto=producto)
            if lote.stock_lote < cantidad:
                raise StockError("Stock insuficiente en el lote indicado.")
            lote.stock_lote = F("stock_lote") - int(cantidad)
            lote.save(update_fields=["stock_lote"])
            lote.refresh_from_db()
            mov = Movimiento.objects.create(
                producto=producto,
                lote=lote,
                usuario=usuario,
                tipo="salida",
                cantidad=int(cantidad),
                fecha_mov=timezone.now(),
            )
            if motivo and hasattr(mov, "motivo"):
                mov.motivo = motivo
                mov.save(update_fields=["motivo"])
            movimientos_creados.append(mov)
            asegurar_alerta_stock(producto)
            return movimientos_creados
        else:
            por_descontar = int(cantidad)
            lotes = list(lotes_fefo_qs())
            stock_total = sum(l.stock_lote for l in lotes)
            if stock_total < por_descontar:
                raise StockError("Stock total insuficiente para la salida solicitada.")

            for lote in lotes:
                if por_descontar == 0:
                    break
                toma = min(por_descontar, lote.stock_lote)
                lote.stock_lote = F("stock_lote") - toma
                lote.save(update_fields=["stock_lote"])
                lote.refresh_from_db()

                mov = Movimiento.objects.create(
                    producto=producto,
                    lote=lote,
                    usuario=usuario,
                    tipo="salida",
                    cantidad=int(toma),
                    fecha_mov=timezone.now(),
                )
                if motivo and hasattr(mov, "motivo"):
                    mov.motivo = motivo
                    mov.save(update_fields=["motivo"])
                movimientos_creados.append(mov)
                por_descontar -= toma
            asegurar_alerta_stock(producto)
            return movimientos_creados

    if tipo == "ajuste":
        qty = int(cantidad)
        if qty > 0:
            if lote_id:
                lote = Lote.objects.select_for_update().get(id=lote_id, producto=producto)
            else:
                lote = (
                    Lote.objects.select_for_update()
                    .filter(producto=producto)
                    .order_by("fecha_caducidad", "id")
                    .first()
                )
                if not lote:
                    from datetime import date as _date
                    fc = fecha_caducidad or _date.today().replace(year=_date.today().year + 2)
                    lote = Lote.objects.create(producto=producto, fecha_caducidad=fc, stock_lote=0)
            lote.stock_lote = F("stock_lote") + qty
            lote.save(update_fields=["stock_lote"])
            lote.refresh_from_db()

            mov = Movimiento.objects.create(
                producto=producto,
                lote=lote,
                usuario=usuario,
                tipo="ajuste",
                cantidad=qty,
                fecha_mov=timezone.now(),
            )
            if motivo and hasattr(mov, "motivo"):
                mov.motivo = motivo
                mov.save(update_fields=["motivo"])
            movimientos_creados.append(mov)
            asegurar_alerta_stock(producto)
            return movimientos_creados
        else:
            por_descontar = abs(qty)
            if lote_id:
                lote = Lote.objects.select_for_update().get(id=lote_id, producto=producto)
                if lote.stock_lote < por_descontar:
                    raise StockError("Ajuste negativo excede el stock del lote.")
                lote.stock_lote = F("stock_lote") - por_descontar
                lote.save(update_fields=["stock_lote"])
                lote.refresh_from_db()

                mov = Movimiento.objects.create(
                    producto=producto,
                    lote=lote,
                    usuario=usuario,
                    tipo="ajuste",
                    cantidad=qty,
                    fecha_mov=timezone.now(),
                )
                if motivo and hasattr(mov, "motivo"):
                    mov.motivo = motivo
                    mov.save(update_fields=["motivo"])
                movimientos_creados.append(mov)
                asegurar_alerta_stock(producto)
                return movimientos_creados
            else:
                lotes = list(
                    Lote.objects.select_for_update()
                    .filter(producto=producto, stock_lote__gt=0)
                    .order_by("fecha_caducidad", "id")
                )
                stock_total = sum(l.stock_lote for l in lotes)
                if stock_total < por_descontar:
                    raise StockError("Ajuste negativo dejaría stock total en negativo.")

                for lote in lotes:
                    if por_descontar == 0:
                        break
                    toma = min(por_descontar, lote.stock_lote)
                    lote.stock_lote = F("stock_lote") - toma
                    lote.save(update_fields=["stock_lote"])
                    lote.refresh_from_db()

                    mov = Movimiento.objects.create(
                        producto=producto,
                        lote=lote,
                        usuario=usuario,
                        tipo="ajuste",
                        cantidad=-toma,
                        fecha_mov=timezone.now(),
                    )
                    if motivo and hasattr(mov, "motivo"):
                        mov.motivo = motivo
                        mov.save(update_fields=["motivo"])
                    movimientos_creados.append(mov)
                    por_descontar -= toma
                asegurar_alerta_stock(producto)
                return movimientos_creados
