# inventory/services_ventas.py
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Producto, Lote, Movimiento, Venta, VentaItem

def _fefo_parts_for(producto_id: int, cantidad: int):
    """
    Devuelve lista de (lote, qty) para cubrir 'cantidad' usando FEFO (caduca antes primero).
    Si la suma total no alcanza, lanza ValidationError.
    """
    if cantidad <= 0:
        raise ValidationError("Cantidad inválida.")

    lotes = (Lote.objects
                  .select_for_update()
                  .filter(producto_id=producto_id, stock_lote__gt=0)
                  .order_by("fecha_caducidad", "id"))

    partes = []
    restante = int(cantidad)

    for l in lotes:
        if restante <= 0:
            break
        tomar = min(l.stock_lote, restante)
        if tomar > 0:
            partes.append((l, tomar))
            restante -= tomar

    if restante > 0:
        # No alcanza sumando todos los lotes
        total_disp = int(cantidad) - restante
        raise ValidationError(f"Stock total insuficiente: solicitado {cantidad}, disponible {total_disp}.")

    return partes

@transaction.atomic
def crear_venta(items, user=None):
    """
    items: [{producto: int, cantidad: int, precio_unitario: number, lote: int|None}, ...]
    - FEFO automático si no envían 'lote'
    - Genera Venta + VentaItems (uno por lote si se dividió)
    - Crea Movimientos de 'salida' ligados a la venta
    """
    if not items:
        raise ValidationError("No hay ítems en la venta.")

    venta = Venta.objects.create(usuario=user, total=Decimal("0"))
    total = Decimal("0")

    for it in items:
        pid = int(it["producto"])
        cant = int(it["cantidad"])
        precio = Decimal(str(it.get("precio_unitario", 0)))
        lote_id = it.get("lote")

        # Bloqueo de producto para consistencia (si quieres)
        prod = Producto.objects.select_for_update().get(id=pid)

        # Partición FEFO (uno o varios lotes)
        if lote_id:
            # Forzar ese lote
            lote = (Lote.objects.select_for_update()
                             .get(id=int(lote_id), producto_id=pid))
            if lote.stock_lote < cant:
                raise ValidationError(f"Stock insuficiente en lote #{lote.id} (tiene {lote.stock_lote}).")
            partes = [(lote, cant)]
        else:
            partes = _fefo_parts_for(pid, cant)

        # Ejecutar consumo por cada parte
        for lote, q in partes:
            # Item por lote (más claro para auditoría)
            VentaItem.objects.create(
                venta=venta, producto=prod, lote=lote,
                cantidad=q, precio_unitario=precio
            )
            # Descontar
            lote.stock_lote -= q
            lote.save(update_fields=["stock_lote"])
            # Movimiento
            Movimiento.objects.create(
                producto=prod, tipo="salida", cantidad=q,
                lote=lote, venta=venta, usuario=user
            )
            total += precio * q

    venta.total = total
    venta.save(update_fields=["total"])
    return venta

@transaction.atomic
def anular_venta(venta_id, user=None):
    """
    Marca venta como anulada y repone stock con movimientos 'entrada'.
    """
    venta = Venta.objects.select_for_update().get(pk=venta_id)
    if venta.anulada:
        return venta

    for item in venta.items.select_related("lote", "producto"):
        if item.lote:
            item.lote.stock_lote += item.cantidad
            item.lote.save(update_fields=["stock_lote"])
        Movimiento.objects.create(
            producto=item.producto, tipo="entrada",
            cantidad=item.cantidad, lote=item.lote,
            venta=venta, usuario=user
        )

    venta.anulada = True
    venta.save(update_fields=["anulada"])
    return venta
