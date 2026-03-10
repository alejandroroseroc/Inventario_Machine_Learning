from .productos import (
    ProductoListCreateView,
    ProductoDetailView,
    RecalcularProductosView,
    ProductoForecastView,
    ProductoForecastDailyView,
    ProductoRopSugerirView,
)
from .lotes import LoteListCreateView, LotesPorVencerView
from .movimientos import MovimientoListCreateView
from .alertas import (
    AlertasStockListView,
    AlertasStockRecalcularView,
    AlertasStockRecalcularPredictView,
    AlertaResolverView,
)
from .ventas import VentaListCreateView, VentaDetailView, VentaCierreDiaView, VentaMonthlyHistoryView, VentaHistorialView
from .kpis import KPIView
from .imports import CSVImportView
from .gestion_vencimiento import GestionarVencimientoView

__all__ = [
    # Productos
    "ProductoListCreateView",
    "ProductoDetailView",
    "RecalcularProductosView",
    "ProductoForecastView",
    "ProductoForecastDailyView",
    "ProductoRopSugerirView",
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
    "VentaHistorialView",
    # KPIs
    "KPIView",
    # Imports
    "CSVImportView",
    # Gestión vencimiento
    "GestionarVencimientoView",
]

