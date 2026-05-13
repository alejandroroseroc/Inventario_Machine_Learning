# backend/inventory/tests/test_alertas_api.py
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from inventory.models import Alerta, Producto

class AlertasStockApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Autenticación “forzada” de DRF para saltar JWT en pruebas
        self.user = User.objects.create_user(
            username="tester@demo.test",
            email="tester@demo.test",
            password="Demo1234!"
        )
        self.client.force_authenticate(user=self.user)

    def test_list_alertas_stock_ok(self):
        """
        Debe responder 200 y retornar una lista de alertas
        (o un objeto con 'results': []).
        """
        resp = self.client.get("/api/inventory/alertas/stock")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        if isinstance(data, dict):
            self.assertIn("results", data)
            self.assertIsInstance(data["results"], list)
        else:
            self.assertIsInstance(data, list)

    def test_recalcular_alertas_stock_ok(self):
        """
        Recalcular baseline de alertas debe devolver 2xx (200/201/202/204).
        """
        resp = self.client.post("/api/inventory/alertas/stock/recalcular", data=None, format="json")
        self.assertIn(resp.status_code, [200, 201, 202, 204])

    def test_resolver_alerta_stock_guarda_decision(self):
        producto = Producto.objects.create(
            usuario=self.user,
            codigo="P-001",
            nombre="Producto prueba",
            punto_reorden=10,
        )
        alerta = Alerta.objects.create(
            tipo="stock",
            producto=producto,
            mensaje="Sugerido comprar 2 uds",
            criticidad="sugerencia",
            estado="activa",
        )

        resp = self.client.patch(
            f"/api/inventory/alertas/{alerta.id}/resolver",
            data={"decision": "aprobada"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        alerta.refresh_from_db()
        self.assertEqual(alerta.estado, "resuelta")
        self.assertEqual(alerta.decision, "aprobada")
        self.assertIsNotNone(alerta.resolved_at)
