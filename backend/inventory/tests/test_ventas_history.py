from django.test import TestCase, RequestFactory
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
from inventory.models import Venta
from inventory.api.views.ventas import VentaMonthlyHistoryView

class VentaHistoryTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.factory = RequestFactory()
        self.view = VentaMonthlyHistoryView.as_view()

    def test_get_monthly_history(self):
        # Create sales in different months
        hoy = timezone.localdate()
        Venta.objects.create(usuario=self.user, total=Decimal("1000"), fecha=hoy.replace(month=1, day=15), anulada=False)
        Venta.objects.create(usuario=self.user, total=Decimal("2000"), fecha=hoy.replace(month=1, day=20), anulada=False)
        Venta.objects.create(usuario=self.user, total=Decimal("5000"), fecha=hoy.replace(month=2, day=10), anulada=False)
        
        # Request
        request = self.factory.get("/api/inventory/ventas/historial-mensual")
        request.user = self.user
        response = self.view(request)
        
        self.assertEqual(response.status_code, 200)
        data = response.data
        
        # Should have Enero (3000) and Febrero (5000)
        enero = next(x for x in data if x["mes"] == "Enero")
        febrero = next(x for x in data if x["mes"] == "Febrero")
        
        self.assertEqual(enero["total"], 3000.0)
        self.assertEqual(febrero["total"], 5000.0)
