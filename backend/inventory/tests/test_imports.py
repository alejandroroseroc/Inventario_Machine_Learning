from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from inventory.models import Lote, Producto
from inventory.services.imports import ImportService


class CSVImportMarginTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="farmacia", password="test")

    @patch("inventory.services.imports.recalcular_productos")
    def test_import_creates_product_with_margin_from_csv(self, _mock_recalcular):
        content = (
            "codigo,nombre,fecha,cantidad,tipo_movimiento,lote,"
            "precio_costo,margen_ganancia,fecha_vencimiento\n"
            "P001,Acetaminofen,2026-01-15,10,entrada,L001,1000,35,2027-01-01\n"
        )
        file_obj = SimpleUploadedFile("productos.csv", content.encode("utf-8"))

        count, errors = ImportService.import_from_csv(file_obj, self.user)

        self.assertEqual(errors, [])
        self.assertEqual(count, 1)

        producto = Producto.objects.get(usuario=self.user, codigo="P001")
        self.assertEqual(producto.precio_costo, Decimal("1000.00"))
        self.assertEqual(producto.margen_ganancia, Decimal("35.00"))
        self.assertEqual(producto.valor_unitario, Decimal("1350.00"))

        lote = Lote.objects.get(producto=producto, numero_lote="L001")
        self.assertEqual(lote.stock_lote, 10)

    @patch("inventory.services.imports.recalcular_productos")
    def test_import_updates_margin_when_product_already_exists(self, _mock_recalcular):
        Producto.objects.create(
            usuario=self.user,
            codigo="P002",
            nombre="Dolex",
            precio_costo=Decimal("850.00"),
            valor_unitario=Decimal("1232.00"),
            margen_ganancia=Decimal("0.00"),
        )
        content = (
            "codigo,nombre,fecha,cantidad,tipo_movimiento,lote,"
            "precio_costo,precio_venta,margen_ganancia,fecha_vencimiento\n"
            "P002,Dolex,2026-01-15,5,entrada,L002,850,1232,45,2027-01-01\n"
        )
        file_obj = SimpleUploadedFile("productos.csv", content.encode("utf-8"))

        count, errors = ImportService.import_from_csv(file_obj, self.user)

        self.assertEqual(errors, [])
        self.assertEqual(count, 1)

        producto = Producto.objects.get(usuario=self.user, codigo="P002")
        self.assertEqual(producto.margen_ganancia, Decimal("45.00"))

    @patch("inventory.services.imports.recalcular_productos")
    def test_import_accepts_blank_expiration_date(self, _mock_recalcular):
        content = (
            "codigo,nombre,fecha,cantidad,tipo_movimiento,lote,"
            "precio_costo,precio_venta,fecha_vencimiento\n"
            "P003,Dolex historico,2025-12-01,3,salida,HISTORICO,,1200,\n"
        )
        file_obj = SimpleUploadedFile("ventas.csv", content.encode("utf-8"))

        count, errors = ImportService.import_from_csv(file_obj, self.user)

        self.assertEqual(errors, [])
        self.assertEqual(count, 1)

        producto = Producto.objects.get(usuario=self.user, codigo="P003")
        lote = Lote.objects.get(producto=producto, numero_lote="HISTORICO")
        self.assertIsNotNone(lote.fecha_caducidad)
