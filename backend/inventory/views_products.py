from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from rest_framework import status, permissions
from django.db import IntegrityError

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import timedelta
from .models import Producto, Movimiento, Lote
from .serializers import ProductoSerializer
from .services import registrar_producto, obtener_productos, recalcular_productos
from ml.baseline import predict_next_month_from_series


class ProductoListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        productos = obtener_productos()
        ser = ProductoSerializer(productos, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)

    def post(self, request):
        ser = ProductoSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            producto = registrar_producto(ser.validated_data)
        except IntegrityError:
            return Response({"codigo": ["El código ya existe."]}, status=400)
        return Response(ProductoSerializer(producto).data, status=status.HTTP_201_CREATED)

class RecalcularProductosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        res = recalcular_productos()
        return Response(res, status=status.HTTP_200_OK)
    


class ProductoDetailView(RetrieveUpdateDestroyAPIView):
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
    def get(self, request, pk):
        qs = (
            Movimiento.objects
            .filter(producto_id=pk, tipo="salida")
            .annotate(mes=TruncMonth("fecha_mov"))  # <-- aquí usar fecha_mov
            .values("mes")
            .annotate(total=Sum("cantidad"))
            .order_by("mes")
        )
        history = [{"month": row["mes"].date().isoformat(), "total": row["total"]} for row in qs]
        series = [row["total"] for row in qs]
        from ml.baseline import predict_next_month_from_series
        pred = predict_next_month_from_series(series)
        return Response({
            "producto": int(pk),
            "method": "linear_regression",
            "period": "next_month",
            "history_months": len(series),
            "prediction_units": pred,
            "history": history,
        })

class LotesPorVencerView(APIView):
    """
    GET /api/inventory/lotes/por-vencer?dias=60&producto=<id?>
    Lista lotes con fecha_caducidad <= hoy + dias y stock_lote > 0.
    """
    def get(self, request):
        try:
            dias = int(request.query_params.get("dias", 60))
        except ValueError:
            dias = 60
        producto_id = request.query_params.get("producto")

        hoy = timezone.now().date()
        limite = hoy + timedelta(days=dias)

        qs = Lote.objects.filter(fecha_caducidad__lte=limite, stock_lote__gt=0)
        if producto_id:
            qs = qs.filter(producto_id=producto_id)

        data = []
        for lote in qs.select_related("producto").order_by("fecha_caducidad"):
            data.append({
                "lote_id": lote.id,
                "producto_id": lote.producto_id,
                "producto_nombre": getattr(lote.producto, "nombre", None),
                "fecha_caducidad": lote.fecha_caducidad.isoformat(),
                "days_left": (lote.fecha_caducidad - hoy).days,
                "stock_lote": lote.stock_lote,
            })
        return Response({"count": len(data), "items": data})
