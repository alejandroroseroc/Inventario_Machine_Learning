from django.test import TestCase, RequestFactory
from inventory.models import Venta, Producto, VentaItem
from inventory.api.views.ventas import VentaDetailView
from django.contrib.auth.models import User
from decimal import Decimal
from unittest.mock import patch

class AnnulmentErrorTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.factory = RequestFactory()
        self.view = VentaDetailView.as_view()

    @patch("inventory.api.views.ventas.anular_venta")
    def test_delete_returns_500_on_generic_exception(self, mock_anular):
        # Setup mock to raise generic Exception
        mock_anular.side_effect = Exception("Database crashed")
        
        # Create dummy sale
        venta = Venta.objects.create(usuario=self.user, total=Decimal("1000"))
        
        # Request
        request = self.factory.delete(f"/api/inventory/ventas/{venta.id}/")
        request.user = self.user
        response = self.view(request, pk=venta.id)

        # Assert
        self.assertEqual(response.status_code, 400)
        self.assertIn("Error interno: Database crashed", response.data["detail"])
