# backend/inventory/views_products.py
from django.db import IntegrityError
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from datetime import timedelta
from math import ceil
from django.utils import timezone

from .models import Producto, Movimiento
from .serializers import ProductoSerializer
from .services import registrar_producto, obtener_productos, recalcular_productos
from ml.baseline import predict_next_month_from_series

# === IMPORTS NUEVOS (ML con clima/salud + rankings) ===
from ml.linear_daily import forecast_daily
from .repositories import productos_con_stock_total


class ProductoListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/inventory/productos?search=term
    POST /api/inventory/productos
    """
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Producto.objects.all().order_by("id")
        term = self.request.query_params.get("search") or self.request.query_params.get("q")
        if term:
            t = term.strip()
            qs = qs.filter(
                Q(codigo__icontains=t) |
                Q(nombre__icontains=t) |
                Q(codigo_barras__icontains=t)
            )
        return qs

    def post(self, request, *args, **kwargs):
        ser = ProductoSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            producto = registrar_producto(ser.validated_data)
        except IntegrityError:
            return Response({"codigo": ["El código ya existe."]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductoSerializer(producto).data, status=status.HTTP_201_CREATED)


class RecalcularProductosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        res = recalcular_productos()
        return Response(res, status=status.HTTP_200_OK)


class ProductoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/inventory/productos/<pk>
    PUT    /api/inventory/productos/<pk>
    PATCH  /api/inventory/productos/<pk>
    DELETE /api/inventory/productos/<pk>
    """
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    lookup_field = "pk"


class ProductoForecastView(APIView):
    """
    GET /api/inventory/productos/<pk>/forecast
    Pronóstico simple (baseline) con salidas mensuales históricas.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        qs = (
            Movimiento.objects
            .filter(producto_id=pk, tipo="salida")
            .annotate(mes=TruncMonth("fecha_mov"))
            .values("mes")
            .annotate(total=Sum("cantidad"))
            .order_by("mes")
        )
        series = [row["total"] for row in qs]
        history = [{"month": row["mes"].date().isoformat(), "total": row["total"]} for row in qs]
        pred = predict_next_month_from_series(series)
        return Response({
            "producto": int(pk),
            "method": "linear_regression",
            "period": "next_month",
            "history_months": len(series),
            "prediction_units": pred,
            "history": history,
        }, status=status.HTTP_200_OK)


# =========================
# NUEVO: Pronóstico diario ML (lags + clima Pasto + salud Nariño + Carnaval)
# =========================
class ProductoForecastDailyView(APIView):
    """
    GET /api/inventory/productos/<pk>/forecast_daily?h=14
    Retorna:
    - yhat_total: suma pronosticada para h días
    - rmse: error reciente
    - safety: stock de seguridad (por ABC)
    - explicacion_top: top-3 factores (ej: health_idx, precip_sum, ma7)
    - serie: [{date, yhat}] para h días
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            h = int(request.query_params.get("h", 14))
        except ValueError:
            return Response({"detail": "h inválido."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            p = Producto.objects.get(id=pk)
        except Producto.DoesNotExist:
            return Response({"detail": "Producto no existe."}, status=status.HTTP_404_NOT_FOUND)

        res = forecast_daily(producto_id=p.id, h=h, abc=(p.categoria or "C"))
        return Response({
            "producto": p.id,
            "h": h,
            "yhat_total": int(round(res.yhat_total)),
            "rmse": round(res.rmse, 2),
            "safety": int(res.safety),
            "explicacion_top": res.top,  # propiedad del dataclass (mapea top_factors)
            "serie": res.serie,
        }, status=status.HTTP_200_OK)


# =========================
# NUEVO: Ranking por impacto de salud (qué se vendería más por picos epidemiológicos)
# =========================
class ProductosTopPorSaludView(APIView):
    """
    GET /api/inventory/forecast/top_by_health?h=14&n=10
    Lista los N productos con mayor impacto positivo de 'health_idx' en el horizonte h.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            h = int(request.query_params.get("h", 14))
            n = int(request.query_params.get("n", 10))
        except ValueError:
            return Response({"detail": "Parámetros inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        items = []
        # productos_con_stock_total() debe anotar stock_total
        for p in productos_con_stock_total().values("id", "nombre", "categoria"):
            res = forecast_daily(producto_id=p["id"], h=h, abc=(p["categoria"] or "C"))
            impact_salud = 0.0
            for kv in res.top:
                if kv.get("factor") == "health_idx":
                    impact_salud = float(kv.get("impacto", 0.0))
                    break
            items.append({
                "producto_id": p["id"],
                "nombre": p["nombre"],
                "impacto_salud": round(impact_salud, 2),
                "yhat_total": int(round(res.yhat_total)),
            })

        items.sort(key=lambda x: x["impacto_salud"], reverse=True)
        return Response({"h": h, "items": items[:n]}, status=status.HTTP_200_OK)


class ProductoRopSugerirView(APIView):
    """
    GET /api/inventory/productos/<pk>/rop_sugerir?lookback=90&lead_time=5&ss=0
    Calcula: ROP = promedio_diario * lead_time + stock_seguridad
    - promedio_diario se estima con salidas de los últimos 'lookback' días.
    - lead_time y stock_seguridad (ss) vienen por query params (enteros).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            lookback = int(request.query_params.get("lookback", 90))
            lead_time = int(request.query_params.get("lead_time", 5))
            ss = int(request.query_params.get("ss", 0))  # stock de seguridad en unidades
        except ValueError:
            return Response({"detail": "Parámetros inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        fin = timezone.now()
        ini = fin - timedelta(days=lookback)

        total = (
            Movimiento.objects
            .filter(producto_id=pk, tipo="salida", fecha_mov__gte=ini, fecha_mov__lte=fin)
            .aggregate(s=Sum("cantidad"))["s"] or 0
        )
        promedio_diario = total / max(1, lookback)
        rop = ceil(promedio_diario * max(0, lead_time)) + max(0, ss)

        data = {
            "producto": int(pk),
            "lookback_days": lookback,
            "salidas_totales_periodo": int(total),
            "promedio_diario": round(promedio_diario, 2),
            "lead_time_dias": lead_time,
            "stock_seguridad": ss,
            "sugerido_rop": int(rop),
            "formula": "ROP = promedio_diario × lead_time + stock_seguridad",
            "nota": (
                "Si no hay historia de ventas en el período, el ROP sugerido será igual al stock de seguridad."
            ),
        }
        return Response(data, status=status.HTTP_200_OK)
