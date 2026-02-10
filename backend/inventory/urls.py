from django.urls import path

from .api.views import (
    KPIView,
    ProductoListCreateView,
    RecalcularProductosView,
    ProductoDetailView,
    ProductoForecastView,
    ProductoRopSugerirView,
    ProductoForecastDailyView,
    ProductosTopPorSaludView,
    LoteListCreateView,
    LotesPorVencerView,
    MovimientoListCreateView,
    AlertasStockListView,
    AlertasStockRecalcularView,
    AlertasStockRecalcularPredictView,
    AlertaResolverView,
    VentaListCreateView,
    VentaDetailView,
    VentaCierreDiaView,
    VentaMonthlyHistoryView,
    CSVImportView,
)


urlpatterns = [
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),

    # Productos
    path("inventory/productos", ProductoListCreateView.as_view(), name="productos"),
    path("inventory/productos/<int:pk>", ProductoDetailView.as_view(), name="producto-detail"),
    path("inventory/productos/recalcular", RecalcularProductosView.as_view(), name="productos-recalcular"),
    path("inventory/productos/<int:pk>/forecast", ProductoForecastView.as_view(), name="producto-forecast"),
    path("inventory/productos/<int:pk>/forecast_daily", ProductoForecastDailyView.as_view(), name="producto-forecast-daily"),
    path("inventory/productos/<int:pk>/rop_sugerir", ProductoRopSugerirView.as_view(), name="producto-rop-sugerir"),

    # Lotes
    path("inventory/lotes", LoteListCreateView.as_view(), name="lotes-list-create"),
    path("inventory/lotes/por-vencer", LotesPorVencerView.as_view(), name="lotes-por-vencer"),

    # Movimientos
    path("inventory/movimientos", MovimientoListCreateView.as_view(), name="movimientos-list-create"),

    # Alertas
    path("inventory/alertas/stock", AlertasStockListView.as_view(), name="alertas-stock"),
    path("inventory/alertas/stock/recalcular", AlertasStockRecalcularView.as_view(), name="alertas-stock-recalc"),
    path("inventory/alertas/stock/recalcular_predict", AlertasStockRecalcularPredictView.as_view(), name="alertas-stock-recalc-predict"),
    path("inventory/alertas/<int:pk>/resolver", AlertaResolverView.as_view(), name="alerta-resolver"),

    # Ventas
    path("inventory/ventas", VentaListCreateView.as_view(), name="ventas-list-create"),
    path("inventory/ventas/<int:pk>", VentaDetailView.as_view(), name="ventas-detail"),
    path("inventory/ventas/cierre", VentaCierreDiaView.as_view(), name="ventas-cierre"),
    path("inventory/ventas/historial-mensual", VentaMonthlyHistoryView.as_view(), name="ventas-historial-mensual"),

    # Analítica
    path("inventory/forecast/top_by_health", ProductosTopPorSaludView.as_view(), name="forecast-top-by-health"),

    # Imports
    path("inventory/import-csv", CSVImportView.as_view(), name="import-csv"),
]

