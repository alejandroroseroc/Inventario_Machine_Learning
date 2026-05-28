from .productos import (
    ProductoListCreateView,
    ProductoDetailView,
    RecalcularProductosView,
    ProductoForecastView,
    ProductoForecastDailyView,
    ProductoRopSugerirView,
    ProductoDesactivarView,
    ProductoReactivarView,
    ProductoInactivosListView,
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
from .lotes_estado import (
    MarcarVencidosAutoView,
    LotesVencidosListView,
    LotesDevolucionListView,
)
from .gastos import GastoDiaListCreateView, GastoDiaDeleteView
from .reportes import (
    ReporteDiarioView,
    ReporteSemanalView,
    ReporteMensualView,
)

__all__ = [
    # Productos
    "ProductoListCreateView",
    "ProductoDetailView",
    "RecalcularProductosView",
    "ProductoForecastView",
    "ProductoForecastDailyView",
    "ProductoRopSugerirView",
    "ProductoDesactivarView",
    "ProductoReactivarView",
    "ProductoInactivosListView",
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
    # Lotes por estado
    "MarcarVencidosAutoView",
    "LotesVencidosListView",
    "LotesDevolucionListView",
    # Gastos
    "GastoDiaListCreateView",
    "GastoDiaDeleteView",
    # Reportes
    "ReporteDiarioView",
    "ReporteSemanalView",
    "ReporteMensualView",
]

