from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone

from .models import Alerta, Producto
from .serializers import AlertaSerializer
from .services import recalcular_alertas_stock_todas, asegurar_alerta_stock

class AlertasStockListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        estado = request.query_params.get("estado", "activa")
        qs = Alerta.objects.select_related("producto").filter(tipo="stock")
        if estado in ("activa", "resuelta"):
            qs = qs.filter(estado=estado)
        data = AlertaSerializer(qs.order_by("-created_at", "-id")[:200], many=True).data
        return Response(data)

class AlertasStockRecalcularView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = recalcular_alertas_stock_todas()
        return Response(payload, status=status.HTTP_200_OK)

class AlertaResolverView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        try:
            al = Alerta.objects.get(id=pk, tipo="stock", estado="activa")
        except Alerta.DoesNotExist:
            return Response({"detail": "No encontrada o ya resuelta."}, status=404)
        al.estado = "resuelta"
        al.resolved_at = timezone.now()
        al.save(update_fields=["estado", "resolved_at"])
        return Response(AlertaSerializer(al).data)
