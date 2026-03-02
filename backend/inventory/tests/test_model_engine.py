# backend/inventory/tests/test_model_engine.py
# Tests unitarios para el motor ML auto-selección (LR vs XGBoost)

from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth.models import User

from inventory.models import Producto, Lote, Movimiento
from ml.linear_daily import forecast_daily


class ForecastDailyTests(TestCase):
    """Verifica que forecast_daily devuelve métricas y estructura correcta."""

    def setUp(self):
        self.user = User.objects.create_user(username="ml_tester", password="pass1234")
        self.producto = Producto.objects.create(
            usuario=self.user,
            codigo="ML001",
            nombre="Acetaminofén 500mg",
            categoria="A",
            valor_unitario=1500,
            punto_reorden=10,
        )
        lote = Lote.objects.create(
            producto=self.producto,
            stock_lote=500,
            fecha_caducidad=date.today() + timedelta(days=365),
            numero_lote="L-TEST-001",
        )

        # Simular 60 días de ventas con patrón cíclico semanal
        base_date = date.today() - timedelta(days=60)
        from django.utils import timezone
        for i in range(60):
            d = base_date + timedelta(days=i)
            dow = d.weekday()
            # Patrón: más ventas lun-vie, menos sáb-dom
            qty = 5 + (3 if dow < 5 else 0) + (i % 3)
            Movimiento.objects.create(
                producto=self.producto,
                lote=lote,
                usuario=self.user,
                tipo="salida",
                cantidad=qty,
                fecha_mov=timezone.make_aware(
                    timezone.datetime(d.year, d.month, d.day, 10, 0)
                ),
            )

    def test_returns_all_metrics(self):
        """forecast_daily debe retornar r2, mae, rmse, modelo como valores válidos."""
        res = forecast_daily(producto_id=self.producto.id, h=7, abc="A")

        self.assertIsInstance(res.r2, float)
        self.assertIsInstance(res.mae, float)
        self.assertIsInstance(res.rmse, float)
        self.assertIsInstance(res.modelo, str)

        # R² en rango teórico
        self.assertGreaterEqual(res.r2, -1.0)
        self.assertLessEqual(res.r2, 1.0)

        # MAE y RMSE no negativos
        self.assertGreaterEqual(res.mae, 0)
        self.assertGreaterEqual(res.rmse, 0)

    def test_modelo_is_valid_name(self):
        """El nombre del modelo debe ser 'linear' o 'xgboost'."""
        res = forecast_daily(producto_id=self.producto.id, h=7, abc="A")
        self.assertIn(res.modelo, ["linear", "xgboost"])

    def test_serie_has_h_elements(self):
        """La serie de predicciones debe tener exactamente h elementos."""
        h = 7
        res = forecast_daily(producto_id=self.producto.id, h=h, abc="A")
        self.assertEqual(len(res.serie), h)

    def test_historico_is_populated(self):
        """El histórico debe contener datos de ventas reales."""
        res = forecast_daily(producto_id=self.producto.id, h=7, abc="A")
        self.assertGreater(len(res.historico), 0)
        first = res.historico[0]
        self.assertIn("date", first)
        self.assertIn("y_real", first)

    def test_safety_stock_positive(self):
        """Con datos suficientes y categoría A, safety debe ser > 0."""
        res = forecast_daily(producto_id=self.producto.id, h=14, abc="A")
        self.assertGreater(res.safety, 0)

    def test_insufficient_data_handling(self):
        """Con un producto sin ventas, debe retornar modelo='insuficiente'."""
        empty_prod = Producto.objects.create(
            usuario=self.user,
            codigo="ML002",
            nombre="Sin ventas",
            valor_unitario=1000,
        )
        res = forecast_daily(producto_id=empty_prod.id, h=7)
        self.assertEqual(res.modelo, "insuficiente")
        self.assertEqual(len(res.serie), 0)

    def test_top_factors_limited(self):
        """top_factors debe tener máximo 3 elementos."""
        res = forecast_daily(producto_id=self.producto.id, h=7, abc="A")
        self.assertLessEqual(len(res.top_factors), 3)
        if res.top_factors:
            self.assertIn("factor", res.top_factors[0])
            self.assertIn("impacto", res.top_factors[0])
