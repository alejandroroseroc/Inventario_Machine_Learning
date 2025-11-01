from datetime import date
import math
from decimal import Decimal
from typing import List, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Producto, Lote, Movimiento
from .repositories import (
    valor_total_inventario,
    productos_bajo_rop_count,
    lotes_por_vencer_count,
    movimientos_recientes,
    demanda_media_diaria,
    ingresos_por_producto,
    lotes_de_producto,
    crear_lote,
)

def compute_kpis():
    valor = valor_total_inventario()
    bajo, total = productos_bajo_rop_count()
    porcentaje = float(bajo / total * 100) if total else 0.0
    por_vencer = lotes_por_vencer_count(meses=2)

    eventos = []
    for m in movimientos_recientes():
        if m.tipo == "entrada":
            verb = "Recibí"
        elif m.tipo == "salida":
            verb = "Se vendieron"
        else:
            verb = "Ajuste"
        qtxt = f"{m.cantidad} de {m.producto.nombre}"
        eventos.append(f"{verb} {qtxt}.")

    valor_str = str(valor) if isinstance(valor, Decimal) else str(valor or 0)
    return {
        "valor_total": valor_str,
        "porcentaje_criticos": round(porcentaje, 2),
        "por_vencer": int(por_vencer or 0),
        "transacciones_recientes": eventos,
    }


ABC_CUTOFF_A = 0.80
ABC_CUTOFF_B = 0.95
ABC_WINDOW_DAYS = 30
ROP_LEAD_TIME = 3
ROP_BUFFER = 0.20


def _calcular_rop(producto):
    dmd = demanda_media_diaria(producto, dias=ABC_WINDOW_DAYS)
    rop = math.ceil(dmd * ROP_LEAD_TIME * (1.0 + ROP_BUFFER))
    return max(0, int(rop))


def _clasificacion_abc():
    ingresos = ingresos_por_producto(dias=ABC_WINDOW_DAYS)
    if not ingresos:
        return {}
    total = sum(float(v or 0) for v in ingresos.values()) or 0.0
    if total <= 0:
        return {}
    orden = sorted(ingresos.items(), key=lambda kv: kv[1], reverse=True)
    cumul = 0.0
    out = {}
    for pid, val in orden:
        cumul += float(val or 0) / total
        if cumul <= ABC_CUTOFF_A:
            out[pid] = "A"
        elif cumul <= ABC_CUTOFF_B:
            out[pid] = "B"
        else:
            out[pid] = "C"
    return out


def obtener_productos():
    return Producto.objects.all().order_by("id")


@transaction.atomic
def registrar_producto(data):
    codigo = (data.get("codigo") or "").strip()
    nombre = (data.get("nombre") or "").strip()
    categoria = (data.get("categoria") or None) or None
    punto_reorden = data.get("punto_reorden", None)
    valor_unitario = data.get("valor_unitario")
    if valor_unitario is None:
        valor_unitario = Decimal("0")

    p = Producto.objects.create(
        codigo=codigo,
        nombre=nombre,
        categoria=categoria or "C",
        punto_reorden=punto_reorden or 0,
        valor_unitario=valor_unitario,
    )

    if not data.get("punto_reorden"):
        p.punto_reorden = _calcular_rop(p)

    if not data.get("categoria"):
        mapa = _clasificacion_abc()
        p.categoria = mapa.get(p.id, "C")

    p.save()
    return p


@transaction.atomic
def recalcular_productos():
    mapa = _clasificacion_abc()
    updated = 0
    for p in Producto.objects.all():
        new_rop = _calcular_rop(p)
        new_cat = mapa.get(p.id, "C")
        if p.punto_reorden != new_rop or p.categoria != new_cat:
            p.punto_reorden = new_rop
            p.categoria = new_cat
            p.save(update_fields=["punto_reorden", "categoria"])
            updated += 1
    return {"updated": updated}


def obtener_lotes(producto_id: int):
    if not Producto.objects.filter(id=producto_id).exists():
        raise ValidationError("Producto no encontrado.")
    return list(lotes_de_producto(producto_id))


def registrar_lote(payload: dict):
    try:
        producto_id = int(payload.get("producto"))
        stock_lote = int(payload.get("stock_lote"))
        fc = payload.get("fecha_caducidad")
        if isinstance(fc, str):
            fecha_caducidad = date.fromisoformat(fc)
        elif isinstance(fc, date):
            fecha_caducidad = fc
        else:
            raise ValidationError("Formato de fecha inválido.")
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("Datos inválidos.")

    if not Producto.objects.filter(id=producto_id).exists():
        raise ValidationError("Producto no encontrado.")
    if stock_lote < 0:
        raise ValidationError("El stock del lote no puede ser negativo.")
    if not fecha_caducidad:
        raise ValidationError("La fecha de caducidad es obligatoria.")
    if fecha_caducidad < date.today():
        raise ValidationError("La fecha de caducidad debe ser hoy o futura.")

    return crear_lote(producto_id, fecha_caducidad, stock_lote)


class StockError(Exception):
    ...

class MovimientoValidationError(Exception):
    ...


@transaction.atomic
def registrar_movimiento(
    *,
    usuario,
    producto_id: int,
    tipo: str,
    cantidad: int,
    lote_id: Optional[int] = None,
    fecha_caducidad: Optional[date] = None,
    motivo: Optional[str] = None,
) -> List[Movimiento]:
    """
    - ENTRADA: suma stock al lote indicado; si no hay lote y se envía fecha_caducidad, crea lote.
    - SALIDA: descuenta del lote indicado o FEFO (varios lotes). Nunca deja stock < 0.
    - AJUSTE: cantidad puede ser positiva o negativa. Respeta no stock negativo.
    Retorna la lista de movimientos creados (pueden ser varios en SALIDA FEFO).
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
                    if not fecha_caducidad:
                        # si no hay lotes y no hay fecha, usa +2 años como predeterminado
                        fecha_caducidad = date.today().replace(year=date.today().year + 2)
                    lote = Lote.objects.create(
                        producto=producto, fecha_caducidad=fecha_caducidad, stock_lote=0
                    )
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
                return movimientos_creados
