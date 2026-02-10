from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from inventory.models import Movimiento
from inventory.api.serializers import MovimientoSerializer, MovimientoCreateSerializer


class MovimientoListCreateView(APIView):
    """
    GET  /api/inventory/movimientos?producto=ID&tipo=entrada|salida|ajuste&limit=50
    POST /api/inventory/movimientos
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Movimiento.objects.select_related("producto", "lote", "usuario").filter(
            producto__usuario=request.user
        ).order_by("-fecha_mov", "-id")
        producto_id = request.query_params.get("producto")
        tipo = request.query_params.get("tipo")
        if producto_id:
            qs = qs.filter(producto_id=producto_id)
        if tipo in ("entrada", "salida", "ajuste"):
            qs = qs.filter(tipo=tipo)
        limit = min(int(request.query_params.get("limit", "50")), 200)
        data = MovimientoSerializer(qs[:limit], many=True).data
        return Response(data)

    def post(self, request):
        ser = MovimientoCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        movimientos = ser.save()
        out = MovimientoSerializer(movimientos, many=True).data
        return Response(out, status=status.HTTP_201_CREATED)
