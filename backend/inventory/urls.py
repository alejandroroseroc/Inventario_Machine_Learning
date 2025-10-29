from django.urls import path
from .views import KPIView
from .views_products import ProductoListCreateView

urlpatterns = [
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),
    path("inventario/productos", ProductoListCreateView.as_view(), name="producto-list-create"),
]
