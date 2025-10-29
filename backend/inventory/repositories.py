from datetime import date, timedelta
from django.db import transaction
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

def crear_producto(data: dict):
    with transaction.atomic():
        return Producto.objects.create(**data)

def listar_productos():
    return Producto.objects.all().order_by("nombre")
