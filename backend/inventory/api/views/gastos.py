from datetime import date as date_type
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework import serializers
from inventory.models import GastoDia


class GastoDiaSerializer(serializers.ModelSerializer):
    class Meta:
        model = GastoDia
        fields = ("id", "fecha", "monto", "observacion", "created_at")
        read_only_fields = ("id", "created_at")


class GastoDiaListCreateView(APIView):
    """
    GET  /api/inventory/gastos?fecha=YYYY-MM-DD
    POST /api/inventory/gastos
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            try:
                from datetime import date
                fecha = date.fromisoformat(fecha_str)
            except ValueError:
                return Response(
                    {"detail": "Fecha inválida."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            from django.utils import timezone
            fecha = timezone.localdate()

        gastos = GastoDia.objects.filter(
            usuario=request.user, fecha=fecha
        )
        ser = GastoDiaSerializer(gastos, many=True)
        return Response(ser.data)

    def post(self, request):
        data = request.data
        observacion = str(data.get("observacion", "")).strip()
        if not observacion:
            return Response(
                {"detail": "La observación del gasto es obligatoria."},
                status=status.HTTP_400_BAD_REQUEST
            )
        monto = data.get("monto")
        if not monto or float(monto) <= 0:
            return Response(
                {"detail": "El monto debe ser mayor a 0."},
                status=status.HTTP_400_BAD_REQUEST
            )
        fecha_str = data.get("fecha")
        if fecha_str:
            try:
                from datetime import date
                fecha = date.fromisoformat(str(fecha_str))
            except ValueError:
                return Response(
                    {"detail": "Fecha inválida."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            from django.utils import timezone
            fecha = timezone.localdate()

        gasto = GastoDia.objects.create(
            usuario=request.user,
            fecha=fecha,
            monto=monto,
            observacion=observacion,
        )
        return Response(
            GastoDiaSerializer(gasto).data,
            status=status.HTTP_201_CREATED
        )


class GastoDiaDeleteView(APIView):
    """
    DELETE /api/inventory/gastos/<pk>
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            gasto = GastoDia.objects.get(
                id=pk, usuario=request.user
            )
        except GastoDia.DoesNotExist:
            return Response(
                {"detail": "Gasto no encontrado."},
                status=status.HTTP_404_NOT_FOUND
            )
        gasto.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
