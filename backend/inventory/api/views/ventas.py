from datetime import datetime
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from inventory.models import Venta
from inventory.api.serializers import VentaSerializer
from inventory.services import crear_venta, anular_venta


class VentaListCreateView(APIView):
    """
    GET  /api/inventory/ventas?fecha=YYYY-MM-DD
    POST /api/inventory/ventas
    """
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

        qs = Venta.objects.filter(fecha=fecha, usuario=request.user).order_by("-id")
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
    """
    GET    /api/inventory/ventas/<pk>
    DELETE /api/inventory/ventas/<pk> (anula)
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VentaSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return Venta.objects.filter(usuario=self.request.user)

    def delete(self, request, *args, **kwargs):
        try:
            venta = anular_venta(kwargs["pk"], user=request.user)
            return Response(VentaSerializer(venta).data, status=200)
        except (ValidationError, ValueError) as e:
            msg = getattr(e, "message", None) or str(e)
            return Response({"detail": msg}, status=400)
        except Exception as e:
            return Response({"detail": f"Error interno: {str(e)}"}, status=400)


class VentaCierreDiaView(APIView):
    """GET /api/inventory/ventas/cierre?fecha=YYYY-MM-DD"""
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

        qs = Venta.objects.filter(fecha=fecha, usuario=request.user).order_by("id")
        total_ventas = sum(v.total for v in qs if not v.anulada)
        data = {
            "fecha": fecha.isoformat(),
            "ventas_registradas": qs.count(),
            "ventas_anuladas": sum(1 for v in qs if v.anulada),
            "total_dia": float(total_ventas),
            "items": VentaSerializer(qs, many=True).data
        }
        return Response(data, status=200)


class VentaMonthlyHistoryView(APIView):
    """
    GET /api/inventory/ventas/historial-mensual
    Retorna el total de ventas por mes para el usuario actual en el año actual.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        año_actual = timezone.localdate().year
        
        # Agrupar por mes, sumar total de ventas no anuladas
        historial = (
            Venta.objects.filter(
                usuario=request.user,
                anulada=False,
                fecha__year=año_actual
            )
            .annotate(mes=TruncMonth('fecha'))
            .values('mes')
            .annotate(total=Sum('total'))
            .order_by('mes')
        )
        
        data = []
        meses_nombres = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ]
        
        for entry in historial:
            # entry['mes'] es un datetime.date o datetime.datetime (inicio de mes)
            mes_num = entry['mes'].month
            data.append({
                "mes": meses_nombres[mes_num - 1],
                "mes_num": mes_num,
                "total": float(entry['total'])
            })
            
        return Response(data, status=200)
