# backend/inventory/tests/test_forecast_api.py
# Tests de integración para el endpoint forecast_daily enriquecido.

from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from inventory.models import Producto, Lote, Movimiento


class ForecastDailyAPITests(TestCase):
    """Verifica la estructura JSON del endpoint forecast_daily."""

    def setUp(self):
        self.user = User.objects.create_user(username="api_tester", password="pass1234")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.producto = Producto.objects.create(
            usuario=self.user,
            codigo="API001",
            nombre="Ibuprofeno 400mg",
            categoria="B",
            valor_unitario=2000,
            punto_reorden=5,
        )
        lote = Lote.objects.create(
            producto=self.producto,
            stock_lote=300,
            fecha_caducidad=date.today() + timedelta(days=180),
            numero_lote="L-API-001",
        )

        # 45 días de ventas simuladas
        base_date = date.today() - timedelta(days=45)
        for i in range(45):
            d = base_date + timedelta(days=i)
            qty = 3 + (i % 5)
            Movimiento.objects.create(
                producto=self.producto,
                lote=lote,
                usuario=self.user,
                tipo="salida",
                cantidad=qty,
                fecha_mov=timezone.make_aware(
                    timezone.datetime(d.year, d.month, d.day, 14, 0)
                ),
            )

    def test_forecast_daily_200(self):
        """El endpoint debe retornar 200."""
        resp = self.client.get(
            f"/api/inventory/productos/{self.producto.id}/forecast_daily?h=7"
        )
        self.assertEqual(resp.status_code, 200)

    def test_response_has_metricas(self):
        """La respuesta debe contener el objeto 'metricas'."""
        resp = self.client.get(
            f"/api/inventory/productos/{self.producto.id}/forecast_daily?h=7"
        )
        data = resp.json()
        self.assertIn("metricas", data)

        m = data["metricas"]
        self.assertIn("modelo", m)
        self.assertIn("r2", m)
        self.assertIn("mae", m)
        self.assertIn("rmse", m)
        self.assertIn("safety", m)

    def test_response_has_historico(self):
        """La respuesta debe incluir historico con datos reales."""
        resp = self.client.get(
            f"/api/inventory/productos/{self.producto.id}/forecast_daily?h=7"
        )
        data = resp.json()
        self.assertIn("historico", data)
        self.assertGreater(len(data["historico"]), 0)
        self.assertIn("date", data["historico"][0])
        self.assertIn("y_real", data["historico"][0])

    def test_response_has_prediccion_with_bands(self):
        """La prediccion debe incluir yhat_lower y yhat_upper."""
        resp = self.client.get(
            f"/api/inventory/productos/{self.producto.id}/forecast_daily?h=7"
        )
        data = resp.json()
        self.assertIn("prediccion", data)
        self.assertEqual(len(data["prediccion"]), 7)

        p = data["prediccion"][0]
        self.assertIn("date", p)
        self.assertIn("yhat", p)
        self.assertIn("yhat_lower", p)
        self.assertIn("yhat_upper", p)

        # Lower <= yhat <= upper
        self.assertLessEqual(p["yhat_lower"], p["yhat"])
        self.assertLessEqual(p["yhat"], p["yhat_upper"])

    def test_response_has_explicacion_top(self):
        """La respuesta debe incluir top factores."""
        resp = self.client.get(
            f"/api/inventory/productos/{self.producto.id}/forecast_daily?h=7"
        )
        data = resp.json()
        self.assertIn("explicacion_top", data)

    def test_nonexistent_product_404(self):
        """Un producto que no existe debe retornar 404."""
        resp = self.client.get(
            "/api/inventory/productos/99999/forecast_daily?h=7"
        )
        self.assertEqual(resp.status_code, 404)
