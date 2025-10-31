from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.core.exceptions import ValidationError

from .serializers import LoteSerializer
from .services import obtener_lotes, registrar_lote

class LoteListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pid = request.query_params.get("producto")
        if not pid:
            return Response({"detail": "Falta parámetro 'producto'."}, status=400)
        try:
            lotes = obtener_lotes(int(pid))
        except ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        ser = LoteSerializer(lotes, many=True)
        return Response(ser.data, status=200)

    def post(self, request):
        try:
            lote = registrar_lote(request.data)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        ser = LoteSerializer(lote)
        return Response(ser.data, status=201)
