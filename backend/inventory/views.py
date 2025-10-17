from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from .services import compute_kpis

class KPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(compute_kpis())
