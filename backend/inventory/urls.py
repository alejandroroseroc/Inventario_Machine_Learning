from django.urls import path
from .views import KPIView
from .views_products import ProductoListCreateView, RecalcularProductosView

urlpatterns = [
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),
    path("inventory/productos", ProductoListCreateView.as_view(), name="productos"),
    path("inventory/productos/recalcular", RecalcularProductosView.as_view(), name="productos-recalcular"),
]
