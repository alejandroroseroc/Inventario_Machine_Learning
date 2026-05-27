"""
Vistas para listado por estado de lotes y auto-detección de vencidos.
"""
from datetime import date

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from inventory.models import Lote, Movimiento
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
    La cantidad real se obtiene del Movimiento de baja asociado.
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
            mov = (
                Movimiento.objects
                .filter(lote=l, tipo="baja_vencimiento")
                .order_by("-fecha_mov")
                .first()
            )
            cantidad_real = mov.cantidad if mov else 0
            costo = float(l.producto.precio_costo or 0)
            items.append({
                "lote_id": l.id,
                "producto_id": l.producto_id,
                "producto_nombre": l.producto.nombre,
                "producto_codigo": l.producto.codigo,
                "numero_lote": l.numero_lote or "-",
                "fecha_caducidad": l.fecha_caducidad.isoformat(),
                "fecha_ingreso": l.fecha_ingreso.isoformat(),
                "stock_retirado": cantidad_real,
                "precio_costo": costo,
                "perdida_total": costo * cantidad_real,
                "estado": l.estado,
            })
        return Response({"count": len(items), "results": items})


class LotesDevolucionListView(APIView):
    """
    GET /api/inventory/lotes/devoluciones
    Lista lotes con estado='devolucion' del usuario.
    La cantidad real se obtiene del Movimiento de devolución asociado.
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
            mov = (
                Movimiento.objects
                .filter(lote=l, tipo="devolucion_proveedor")
                .order_by("-fecha_mov")
                .first()
            )
            cantidad_real = mov.cantidad if mov else 0
            costo = float(l.producto.precio_costo or 0)
            items.append({
                "lote_id": l.id,
                "producto_id": l.producto_id,
                "producto_nombre": l.producto.nombre,
                "producto_codigo": l.producto.codigo,
                "numero_lote": l.numero_lote or "-",
                "fecha_caducidad": l.fecha_caducidad.isoformat(),
                "fecha_ingreso": l.fecha_ingreso.isoformat(),
                "stock_devuelto": cantidad_real,
                "precio_costo": costo,
                "perdida_50": costo * cantidad_real * 0.5,
                "estado": l.estado,
            })
        return Response({"count": len(items), "results": items})
