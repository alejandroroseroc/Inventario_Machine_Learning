from .productos import (
    ProductoListCreateView,
    ProductoDetailView,
    RecalcularProductosView,
    ProductoForecastView,
    ProductoForecastDailyView,
    ProductoRopSugerirView,
    ProductosTopPorSaludView,
)
from .lotes import LoteListCreateView, LotesPorVencerView
from .movimientos import MovimientoListCreateView
from .alertas import (
    AlertasStockListView,
    AlertasStockRecalcularView,
    AlertasStockRecalcularPredictView,
    AlertaResolverView,
)
from .ventas import VentaListCreateView, VentaDetailView, VentaCierreDiaView, VentaMonthlyHistoryView
from .kpis import KPIView
from .imports import CSVImportView

__all__ = [
    # Productos
    "ProductoListCreateView",
    "ProductoDetailView",
    "RecalcularProductosView",
    "ProductoForecastView",
    "ProductoForecastDailyView",
    "ProductoRopSugerirView",
    "ProductosTopPorSaludView",
    # Lotes
    "LoteListCreateView",
    "LotesPorVencerView",
    # Movimientos
    "MovimientoListCreateView",
    # Alertas
    "AlertasStockListView",
    "AlertasStockRecalcularView",
    "AlertasStockRecalcularPredictView",
    "AlertaResolverView",
    # Ventas
    "VentaListCreateView",
    "VentaDetailView",
    "VentaCierreDiaView",
    "VentaMonthlyHistoryView",
    # KPIs
    "KPIView",
    # Imports
    "CSVImportView",
]

