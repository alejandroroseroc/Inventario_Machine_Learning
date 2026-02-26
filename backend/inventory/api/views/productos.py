from django.db import IntegrityError
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from datetime import timedelta
from math import ceil

from inventory.models import Producto, Movimiento
from inventory.api.serializers import ProductoSerializer
from inventory.services import registrar_producto, obtener_productos, recalcular_productos
from ml.baseline import predict_next_month_from_series
from ml.linear_daily import forecast_daily


class ProductoListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/inventory/productos?search=term
    POST /api/inventory/productos
    """
    serializer_class = ProductoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Producto.objects.filter(usuario=self.request.user).order_by("id")
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
            producto = registrar_producto(ser.validated_data, request.user)
        except IntegrityError:
            return Response({"codigo": ["El código ya existe."]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductoSerializer(producto).data, status=status.HTTP_201_CREATED)


class RecalcularProductosView(APIView):
    """POST /api/inventory/productos/recalcular"""
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
    serializer_class = ProductoSerializer
    lookup_field = "pk"
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Producto.objects.filter(usuario=self.request.user)


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


class ProductoForecastDailyView(APIView):
    """
    GET /api/inventory/productos/<pk>/forecast_daily?h=14
    Retorna:
    - yhat_total: suma pronosticada para h días
    - rmse: error reciente
    - safety: stock de seguridad (por ABC)
    - explicacion_top: top-3 factores
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
            "explicacion_top": res.top,
            "serie": res.serie,
        }, status=status.HTTP_200_OK)


class ProductoRopSugerirView(APIView):
    """
    GET /api/inventory/productos/<pk>/rop_sugerir?lookback=90&lead_time=5&ss=0
    Calcula: ROP = promedio_diario * lead_time + stock_seguridad
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            lookback = int(request.query_params.get("lookback", 90))
            lead_time = int(request.query_params.get("lead_time", 5))
            ss = int(request.query_params.get("ss", 0))
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
