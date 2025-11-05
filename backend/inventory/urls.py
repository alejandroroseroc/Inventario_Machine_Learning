from django.urls import path
from .views import KPIView
from .views_products import(ProductoListCreateView, RecalcularProductosView, ProductoDetailView, ProductoForecastView, LotesPorVencerView)
from .views_lotes import LoteListCreateView
from .views_movimientos import MovimientoListCreateView
from .views_alertas import AlertasStockListView, AlertasStockRecalcularView, AlertaResolverView

urlpatterns = [
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),
    path("inventory/productos", ProductoListCreateView.as_view(), name="productos"),
    path("inventory/productos/recalcular", RecalcularProductosView.as_view(), name="productos-recalcular"),
    path("inventory/lotes", LoteListCreateView.as_view(), name="lotes-list-create"),
    path("inventory/movimientos", MovimientoListCreateView.as_view(), name="movimientos-list-create"),
    path("inventory/alertas/stock", AlertasStockListView.as_view(), name="alertas-stock"),
    path("inventory/alertas/stock/recalcular", AlertasStockRecalcularView.as_view(), name="alertas-stock-recalc"),
    path("inventory/alertas/<int:pk>/resolver", AlertaResolverView.as_view(), name="alerta-resolver"),
    # CRUD detalle de producto
    path("inventory/productos/<int:pk>", ProductoDetailView.as_view(), name="producto-detail"),

    # Forecast próximo mes por producto (baseline ML separado)
    path("inventory/productos/<int:pk>/forecast", ProductoForecastView.as_view(), name="producto-forecast"),

    # Caducidades por vencer (consulta 40/60 días)
    path("inventory/lotes/por-vencer", LotesPorVencerView.as_view(), name="lotes-por-vencer"),
]
