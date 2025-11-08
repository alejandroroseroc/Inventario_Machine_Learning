from django.urls import path

from .views import KPIView
from .views_products import (
    ProductoListCreateView,
    RecalcularProductosView,
    ProductoDetailView,
    ProductoForecastView,
)
from .views_lotes import (
    LoteListCreateView,
    LotesPorVencerView,
)
from .views_movimientos import MovimientoListCreateView
from .views_alertas import (
    AlertasStockListView,
    AlertasStockRecalcularView,
    AlertaResolverView,
)
from .views_ventas import VentaListCreateView, VentaDetailView, VentaCierreDiaView


urlpatterns = [
    # Panel
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),

    # Productos
    path("inventory/productos", ProductoListCreateView.as_view(), name="productos"),
    path("inventory/productos/<int:pk>", ProductoDetailView.as_view(), name="producto-detail"),
    path("inventory/productos/recalcular", RecalcularProductosView.as_view(), name="productos-recalcular"),
    path("inventory/productos/<int:pk>/forecast", ProductoForecastView.as_view(), name="producto-forecast"),

    # Lotes
    path("inventory/lotes", LoteListCreateView.as_view(), name="lotes-list-create"),
    path("inventory/lotes/por-vencer", LotesPorVencerView.as_view(), name="lotes-por-vencer"),

    # Movimientos
    path("inventory/movimientos", MovimientoListCreateView.as_view(), name="movimientos-list-create"),

    # Alertas
    path("inventory/alertas/stock", AlertasStockListView.as_view(), name="alertas-stock"),
    path("inventory/alertas/stock/recalcular", AlertasStockRecalcularView.as_view(), name="alertas-stock-recalc"),
    path("inventory/alertas/<int:pk>/resolver", AlertaResolverView.as_view(), name="alerta-resolver"),

    path("inventory/ventas", VentaListCreateView.as_view(), name="ventas-list-create"),
    path("inventory/ventas/<int:pk>", VentaDetailView.as_view(), name="ventas-detail"),
    path("inventory/ventas/cierre", VentaCierreDiaView.as_view(), name="ventas-cierre"),
]
