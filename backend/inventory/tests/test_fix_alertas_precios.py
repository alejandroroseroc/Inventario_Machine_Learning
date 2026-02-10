from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.test import APIClient
from inventory.models import Producto, Lote, Alerta
from inventory.services.alertas import recalcular_alertas_stock_todas
from inventory.api.serializers import ProductoSerializer

class FixAlertasPreciosTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_precio_minimo(self):
        # 1. Fallo con precio bajo
        data_fail = {
            "codigo": "P001",
            "nombre": "Barato",
            "valor_unitario": 100,
            "punto_reorden": 10
        }
        serializer = ProductoSerializer(data=data_fail)
        with self.assertRaises(serializers.ValidationError) as cm:
            serializer.is_valid(raise_exception=True)
        self.assertIn("al menos 500", str(cm.exception))

        # 2. Exito con precio correcto
        data_ok = {
            "codigo": "P002",
            "nombre": "Correcto",
            "valor_unitario": 600,
            "punto_reorden": 10
        }
        serializer = ProductoSerializer(data=data_ok)
        serializer = ProductoSerializer(data=data_ok)
        self.assertTrue(serializer.is_valid())

    def test_venta_precio_minimo(self):
        from inventory.services import crear_venta
        from django.core.exceptions import ValidationError
        
        # Crear producto y lote
        prod = Producto.objects.create(usuario=self.user, codigo="P99", nombre="Test", valor_unitario=1000)
        Lote.objects.create(producto=prod, stock_lote=10, fecha_caducidad="2030-01-01")
        
        # Intento venta precio < 500
        items_fail = [{"producto": prod.id, "cantidad": 1, "precio_unitario": 100}]
        with self.assertRaises(ValidationError) as cm:
            crear_venta(items_fail, user=self.user)
        self.assertIn("al menos 500", str(cm.exception))
        
        # Venta ok
        items_ok = [{"producto": prod.id, "cantidad": 1, "precio_unitario": 600}]
        venta = crear_venta(items_ok, user=self.user)
        self.assertIsNotNone(venta.id)


    def test_alerta_caducidad(self):
        # Crear producto
        prod = Producto.objects.create(
            usuario=self.user,
            codigo="PEXP",
            nombre="Producto Expira",
            valor_unitario=1000,
            punto_reorden=5
        )
        
        # 1. Lote que NO vence (dentro de 100 dias)
        Lote.objects.create(
            producto=prod,
            stock_lote=10,
            fecha_caducidad=date.today() + timedelta(days=100)
        )
        
        stats = recalcular_alertas_stock_todas(self.user)
        self.assertEqual(stats["activos_caducidad"], 0)
        
        # 2. Lote que SI vence (dentro de 30 dias)
        lote_exp = Lote.objects.create(
            producto=prod,
            stock_lote=10,
            fecha_caducidad=date.today() + timedelta(days=30),
            numero_lote="L_VENCE"
        )
        
        stats = recalcular_alertas_stock_todas(self.user)
        self.assertEqual(stats["activos_caducidad"], 1)
        
        # Verificar que existe la alerta en BD
        alerta = Alerta.objects.get(producto=prod, tipo="caducidad", estado="activa")
        self.assertIn("vence en", alerta.mensaje)
        
        # 3. Verificar API endpoint
        resp = self.client.get("/api/inventory/alertas/stock")
        self.assertEqual(resp.status_code, 200)
        results = resp.json()
        # Asegurar que la alerta 'caducidad' esta en la lista
        tipos = [r["tipo"] for r in results]
        self.assertIn("caducidad", tipos)
