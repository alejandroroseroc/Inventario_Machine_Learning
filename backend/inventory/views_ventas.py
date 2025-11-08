# inventory/views_ventas.py
from datetime import datetime
from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Venta
from .serializers_ventas import VentaSerializer
from .services_ventas import crear_venta, anular_venta

class VentaListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            try:
                fecha = datetime.fromisoformat(fecha_str).date()
            except Exception:
                return Response({"detail": "Fecha inválida"}, status=400)
        else:
            fecha = timezone.localdate()

        qs = Venta.objects.filter(fecha=fecha).order_by("-id")  # ✅ DateField
        return Response(VentaSerializer(qs, many=True).data, status=200)

    def post(self, request):
        try:
            items = request.data.get("items", [])
            venta = crear_venta(items, user=request.user)
            return Response(VentaSerializer(venta).data, status=201)
        except (ValidationError, ValueError) as e:
            msg = getattr(e, "message", None) or str(e)
            return Response({"detail": msg}, status=400)

class VentaDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    lookup_field = "pk"

    def delete(self, request, *args, **kwargs):
        try:
            venta = anular_venta(kwargs["pk"], user=request.user)
            return Response(VentaSerializer(venta).data, status=200)
        except (ValidationError, ValueError) as e:
            msg = getattr(e, "message", None) or str(e)
            return Response({"detail": msg}, status=400)

class VentaCierreDiaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            try:
                fecha = datetime.fromisoformat(fecha_str).date()
            except Exception:
                return Response({"detail": "Fecha inválida"}, status=400)
        else:
            fecha = timezone.localdate()

        qs = Venta.objects.filter(fecha=fecha).order_by("id")
        total_ventas = sum(v.total for v in qs if not v.anulada)
        data = {
            "fecha": fecha.isoformat(),
            "ventas_registradas": qs.count(),
            "ventas_anuladas": sum(1 for v in qs if v.anulada),
            "total_dia": float(total_ventas),
            "items": VentaSerializer(qs, many=True).data
        }
        return Response(data, status=200)
