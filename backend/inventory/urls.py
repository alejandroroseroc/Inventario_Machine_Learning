from django.urls import path
from .views import KPIView
from .views_products import ProductoListCreateView, RecalcularProductosView
from .views_lotes import LoteListCreateView

urlpatterns = [
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),
    path("inventory/productos", ProductoListCreateView.as_view(), name="productos"),
    path("inventory/productos/recalcular", RecalcularProductosView.as_view(), name="productos-recalcular"),
    path("inventory/lotes", LoteListCreateView.as_view(), name="lotes-list-create"),
]
