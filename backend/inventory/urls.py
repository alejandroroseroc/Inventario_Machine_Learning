from django.urls import path
from .views import KPIView

urlpatterns = [
    path("panel/kpis", KPIView.as_view(), name="panel-kpis"),
]
