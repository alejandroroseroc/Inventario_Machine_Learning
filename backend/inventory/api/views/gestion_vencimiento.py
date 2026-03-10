"""
Vista para gestionar lotes próximos a vencer o caducados.
POST /api/inventory/lotes/<id>/gestionar_vencimiento/
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import Lote
from inventory.services.gestion_vencimiento import (
    gestionar_vencimiento,
    GestionVencimientoError,
)


class GestionarVencimientoView(APIView):
    """
    POST /api/inventory/lotes/<id>/gestionar_vencimiento/

    Aplica la regla de 30 días:
      - >30 días: devolucion_proveedor
      - ≤30 días: baja_vencimiento

    El stock del lote se reduce a 0 y se crea un Movimiento trazable.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        # Verificar que el lote pertenece a un producto del usuario
        try:
            lote = Lote.objects.select_related("producto").get(id=pk)
        except Lote.DoesNotExist:
            return Response(
                {"detail": "Lote no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if lote.producto.usuario != request.user:
            return Response(
                {"detail": "No tienes permiso para gestionar este lote."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            resultado = gestionar_vencimiento(
                usuario=request.user,
                lote_id=pk,
            )
        except GestionVencimientoError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(resultado, status=status.HTTP_200_OK)
