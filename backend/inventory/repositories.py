from datetime import date, timedelta
from django.utils import timezone
from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce

from .models import Producto, Lote, Movimiento

def productos_con_stock_total():
    return Producto.objects.annotate(
        stock_total=Coalesce(Sum("lotes__stock_lote"), 0)
    )

def valor_total_inventario():
    expr = ExpressionWrapper(
        Coalesce(F("stock_lote"), 0) * Coalesce(F("producto__valor_unitario"), 0),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )
    agg = Lote.objects.select_related("producto").aggregate(total=Sum(expr))
    return agg["total"] or 0

def productos_bajo_rop_count():
    qs = productos_con_stock_total()
    return qs.filter(stock_total__lt=F("punto_reorden")).count(), qs.count()

def lotes_por_vencer_count(meses=2):
    limite = date.today() + timedelta(days=30 * meses)
    return Lote.objects.filter(
        fecha_caducidad__lte=limite,
        stock_lote__gt=0
    ).count()

def movimientos_recientes(n=3):
    return (
        Movimiento.objects
        .select_related("producto")
        .order_by("-fecha_mov")[:n]
    )

# ====== NUEVO: soporte para ABC y ROP ======

def _desde_hace(dias=30):
    hoy = timezone.now().date()
    return hoy - timedelta(days=dias)

def ventas_cantidad_ultimos_dias(producto, dias=30):
    desde = _desde_hace(dias)
    agg = (Movimiento.objects
           .filter(producto=producto, tipo="salida", fecha_mov__date__gte=desde)
           .aggregate(total=Coalesce(Sum("cantidad"), 0)))
    return int(agg["total"] or 0)

def demanda_media_diaria(producto, dias=30):
    total = ventas_cantidad_ultimos_dias(producto, dias=dias)
    return total / float(dias)

def ingresos_por_producto(dias=30):
    """ Dict {producto_id: ingresos_30d} """
    desde = _desde_hace(dias)
    rows = (Movimiento.objects
            .filter(tipo="salida", fecha_mov__date__gte=desde)
            .values("producto_id")
            .annotate(total=Coalesce(Sum(F("cantidad") * F("producto__valor_unitario")), 0)))
    return {r["producto_id"]: r["total"] for r in rows}
