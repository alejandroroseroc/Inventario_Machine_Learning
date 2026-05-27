"""
Vistas para listado por estado de lotes y auto-detección de vencidos.
"""
from datetime import date

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from inventory.models import Lote
from inventory.api.serializers import LoteSerializer


class MarcarVencidosAutoView(APIView):
    """
    POST /api/inventory/lotes/marcar-vencidos
    Detecta lotes con fecha_caducidad < hoy y estado='activo'
    y los marca automáticamente como 'vencido'.
    Solo afecta lotes del usuario autenticado.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        hoy = date.today()
        lotes_vencidos = Lote.objects.filter(
            producto__usuario=request.user,
            fecha_caducidad__lt=hoy,
            estado="activo",
        )
        count = lotes_vencidos.count()
        lotes_vencidos.update(estado="vencido")
        return Response(
            {"marcados_como_vencidos": count},
            status=status.HTTP_200_OK,
        )


class LotesVencidosListView(APIView):
    """
    GET /api/inventory/lotes/vencidos
    Lista lotes con estado='vencido' del usuario.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            Lote.objects.select_related("producto")
            .filter(producto__usuario=request.user, estado="vencido")
            .order_by("-id")
        )
        items = []
        for l in qs:
            items.append({
                "lote_id": l.id,
                "producto_id": l.producto_id,
                "producto_nombre": l.producto.nombre,
                "producto_codigo": l.producto.codigo,
                "numero_lote": l.numero_lote or "-",
                "fecha_caducidad": l.fecha_caducidad.isoformat(),
                "fecha_ingreso": l.fecha_ingreso.isoformat(),
                "stock_retirado": l.stock_lote,
                "precio_costo": float(l.producto.precio_costo or 0),
                "perdida_total": float(l.producto.precio_costo or 0) * l.stock_lote,
                "estado": l.estado,
            })
        return Response({"count": len(items), "results": items})


class LotesDevolucionListView(APIView):
    """
    GET /api/inventory/lotes/devoluciones
    Lista lotes con estado='devolucion' del usuario.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            Lote.objects.select_related("producto")
            .filter(producto__usuario=request.user, estado="devolucion")
            .order_by("-id")
        )
        items = []
        for l in qs:
            costo = float(l.producto.precio_costo or 0)
            items.append({
                "lote_id": l.id,
                "producto_id": l.producto_id,
                "producto_nombre": l.producto.nombre,
                "producto_codigo": l.producto.codigo,
                "numero_lote": l.numero_lote or "-",
                "fecha_caducidad": l.fecha_caducidad.isoformat(),
                "fecha_ingreso": l.fecha_ingreso.isoformat(),
                "stock_devuelto": l.stock_lote,
                "precio_costo": costo,
                "perdida_50": costo * l.stock_lote * 0.5,
                "estado": l.estado,
            })
        return Response({"count": len(items), "results": items})
