from datetime import date, timedelta

from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce

from .models import Producto, Lote, Movimiento


def productos_con_stock_total():
    """
    Devuelve QS de Producto con anotación stock_total (0 si no hay lotes).
    """
    return Producto.objects.annotate(
        stock_total=Coalesce(Sum("lotes__stock_lote"), 0)
    )


def valor_total_inventario():
    """
    Suma global del inventario: (stock_lote) * (producto.valor_unitario)

    IMPORTANTE:
    - El queryset base es Lote, por eso los campos correctos son:
      - stock_lote
      - producto__valor_unitario
    - Usamos Coalesce(...) para evitar NULLs en la multiplicación.
    """
    expr = ExpressionWrapper(
        Coalesce(F("stock_lote"), 0) * Coalesce(F("producto__valor_unitario"), 0),
        output_field=DecimalField(max_digits=18, decimal_places=2),
    )
    agg = Lote.objects.select_related("producto").aggregate(total=Sum(expr))
    return agg["total"] or 0


def productos_bajo_rop_count():
    """
    Cuenta productos con stock_total < punto_reorden.
    Devuelve (bajo, total_productos)
    """
    qs = productos_con_stock_total()
    return qs.filter(stock_total__lt=F("punto_reorden")).count(), qs.count()


def lotes_por_vencer_count(meses=2):
    """
    Cuenta lotes con caducidad en <= X meses y stock > 0.
    """
    limite = date.today() + timedelta(days=30 * meses)
    return Lote.objects.filter(
        fecha_caducidad__lte=limite,
        stock_lote__gt=0
    ).count()


def movimientos_recientes(n=3):
    """
    Últimos n movimientos para mostrar en el panel.
    """
    return (
        Movimiento.objects
        .select_related("producto")
        .order_by("-fecha_mov")[:n]
    )
