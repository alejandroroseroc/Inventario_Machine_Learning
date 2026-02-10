from datetime import date, timedelta
from multiprocessing import Value
from django.utils import timezone
from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce

from .models import Producto, Lote, Movimiento, Alerta

def productos_con_stock_total(usuario=None):
    qs = Producto.objects.all()
    if usuario:
        qs = qs.filter(usuario=usuario)
    return qs.annotate(
        stock_total=Coalesce(Sum("lotes__stock_lote"), 0)
    )

def valor_total_inventario(usuario=None):
    expr = ExpressionWrapper(
        Coalesce(F("stock_lote"), 0) * Coalesce(F("producto__valor_unitario"), 0),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )
    qs = Lote.objects.select_related("producto")
    if usuario:
        qs = qs.filter(producto__usuario=usuario)
    agg = qs.aggregate(total=Sum(expr))
    return agg["total"] or 0

def productos_bajo_rop_count(usuario=None):
    qs = productos_con_stock_total(usuario)
    return qs.filter(stock_total__lt=F("punto_reorden")).count(), qs.count()

def lotes_por_vencer_count(meses=2, usuario=None):
    limite = date.today() + timedelta(days=30 * meses)
    qs = Lote.objects.filter(
        fecha_caducidad__lte=limite,
        stock_lote__gt=0
    )
    if usuario:
        qs = qs.filter(producto__usuario=usuario)
    return qs.count()

def movimientos_recientes(n=3, usuario=None):
    qs = Movimiento.objects.select_related("producto")
    if usuario:
        qs = qs.filter(producto__usuario=usuario)
    return qs.order_by("-fecha_mov")[:n]

def _desde_hace(dias=30):
    hoy = timezone.now().date()
    return hoy - timedelta(days=dias)

def ventas_cantidad_ultimos_dias(producto, dias=30):
    desde = _desde_hace(dias)
    agg = (Movimiento.objects.filter(producto=producto, tipo="salida", fecha_mov__date__gte=desde).aggregate(total=Coalesce(Sum("cantidad"), 0)))
    return int(agg["total"] or 0)

def demanda_media_diaria(producto, dias=30):
    total = ventas_cantidad_ultimos_dias(producto, dias=dias)
    return total / float(dias)

def ingresos_por_producto(dias=30, usuario=None):
    """ Dict {producto_id: ingresos_30d} """
    desde = _desde_hace(dias)

    # Tipar la multiplicación a Decimal
    amount = ExpressionWrapper(
        F("cantidad") * F("producto__valor_unitario"),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )

    qs = Movimiento.objects.filter(tipo="salida", fecha_mov__date__gte=desde)
    if usuario:
        qs = qs.filter(producto__usuario=usuario)
    
    rows = (
        qs.values("producto_id")
        .annotate(
            total=Coalesce(
                Sum(amount),
                Value(0, output_field=DecimalField(max_digits=12, decimal_places=2)),
            )
        )
    )

    return {r["producto_id"]: r["total"] for r in rows}


def lotes_de_producto(producto_id: int):
    return (
        Lote.objects
        .filter(producto_id=producto_id)
        .order_by("fecha_caducidad", "id")
    )

def crear_lote(producto_id: int, fecha_caducidad, stock_lote: int, numero_lote: str = None, codigo_barras: str = None):
    return Lote.objects.create(
        producto_id=producto_id,
        fecha_caducidad=fecha_caducidad,
        stock_lote=stock_lote,
        numero_lote=numero_lote,
        codigo_barras=codigo_barras,
    )
    
def stock_total_producto(producto_id: int) -> int:
    return int(Lote.objects.filter(producto_id=producto_id).aggregate(s=Sum("stock_lote"))["s"] or 0)

def alerta_stock_activa(producto_id: int):
    return Alerta.objects.filter(producto_id=producto_id, tipo="stock", estado="activa").first()

def crear_alerta_stock(producto_id: int, mensaje: str, criticidad: str = "critico"):
    return Alerta.objects.create(
        tipo="stock", producto_id=producto_id, mensaje=mensaje,
        criticidad=criticidad, estado="activa"
    )

def resolver_alertas_stock(producto_id: int):
    return Alerta.objects.filter(producto_id=producto_id, tipo="stock", estado="activa") \
        .update(estado="resuelta")