from datetime import timedelta

from django.utils import timezone
from django.core.exceptions import ValidationError

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import Lote
from inventory.api.serializers import LoteSerializer
from inventory.services import registrar_lote


class LoteListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/inventory/lotes?producto=ID&numero_lote=XYZ
    POST /api/inventory/lotes
    """
    serializer_class = LoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Lote.objects.select_related("producto").filter(
            producto__usuario=self.request.user
        ).order_by("fecha_caducidad", "id")
        producto = self.request.query_params.get("producto")
        if producto:
            qs = qs.filter(producto_id=producto)
        numero_lote = self.request.query_params.get("numero_lote")
        if numero_lote:
            qs = qs.filter(numero_lote=numero_lote.strip())
        return qs

    def create(self, request, *args, **kwargs):
        try:
            lote = registrar_lote(request.data, usuario=request.user)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        ser = LoteSerializer(lote)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class LotesPorVencerView(APIView):
    """
    GET /api/inventory/lotes/por-vencer?dias=60&producto=<id?>
    Devuelve lotes que caducan en <= dias (stock > 0).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            dias = int(request.query_params.get("dias", 60))
        except ValueError:
            dias = 60
        producto_id = request.query_params.get("producto")
        estado = request.query_params.get("estado", "activa") # actia | resuelta

        hoy = timezone.now().date()
        limite = hoy + timedelta(days=dias)

        qs = Lote.objects.select_related("producto").filter(
            producto__usuario=request.user,
            fecha_caducidad__lte=limite
        )
        
        if estado == "activa":
            qs = qs.filter(stock_lote__gt=0)
        elif estado == "resuelta":
            qs = qs.filter(stock_lote=0)
        if producto_id:
            qs = qs.filter(producto_id=producto_id)

        items = []
        for l in qs.order_by("fecha_caducidad", "id"):
            items.append({
                "lote_id": l.id,
                "producto_id": l.producto_id,
                "producto_nombre": getattr(l.producto, "nombre", None),
                "numero_lote": getattr(l, "numero_lote", None),
                "fecha_caducidad": l.fecha_caducidad.isoformat(),
                "days_left": (l.fecha_caducidad - hoy).days,
                "stock_lote": l.stock_lote,
            })

        return Response({"count": len(items), "results": items}, status=status.HTTP_200_OK)
