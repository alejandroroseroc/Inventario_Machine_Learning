from django.test import TestCase
from inventory.models import Lote, Producto
from inventory.api.serializers import LoteSerializer
from django.contrib.auth.models import User

class LoteSerializerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser")
        self.producto = Producto.objects.create(usuario=self.user, codigo="P1", nombre="Prod1", valor_unitario=1000)

    def test_serializer_includes_numero_lote(self):
        lote = Lote.objects.create(
            producto=self.producto, 
            numero_lote="LOTE-123", 
            stock_lote=10, 
            fecha_caducidad="2025-12-31"
        )
        serializer = LoteSerializer(lote)
        data = serializer.data
        self.assertIn("numero_lote", data)
        self.assertEqual(data["numero_lote"], "LOTE-123")
