from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from django.db.models import Sum
from django.utils import timezone

from inventory.models import Alerta, Producto
from inventory.api.serializers import AlertaSerializer
from inventory.services import recalcular_alertas_stock_todas, asegurar_alerta_sugerencia_stock
from ml.linear_daily import forecast_daily


class AlertasStockListView(APIView):
    """GET /api/inventory/alertas/stock?estado=activa|resuelta"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        estado = request.query_params.get("estado", "activa")
        qs = Alerta.objects.select_related("producto").filter(
            # tipo="stock",  <-- REMOVED to include "caducidad"
            producto__usuario=request.user
        )
        if estado in ("activa", "resuelta"):
            qs = qs.filter(estado=estado)
        data = AlertaSerializer(qs.order_by("-created_at", "-id")[:200], many=True).data
        return Response(data)


class AlertasStockRecalcularView(APIView):
    """POST /api/inventory/alertas/stock/recalcular"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = recalcular_alertas_stock_todas(request.user)
        return Response(payload, status=status.HTTP_200_OK)


class AlertasStockRecalcularPredictView(APIView):
    """
    POST /api/inventory/alertas/stock/recalcular_predict?h=14
    Genera/actualiza alertas de stock con sugerencia basada en ML.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            h = int(request.query_params.get("h", 14))
        except ValueError:
            return Response({"detail": "Parámetro h inválido."}, status=status.HTTP_400_BAD_REQUEST)

        creadas = 0
        procesados = 0
        errores = []

        productos = (
            Producto.objects
            .filter(usuario=request.user)
            .annotate(stock_total=Sum("lotes__stock_lote"))
            .values("id", "categoria", "stock_total")
        )

        for p in productos:
            procesados += 1
            pid = p["id"]
            try:
                res = forecast_daily(producto_id=pid, h=h, abc=(p["categoria"] or "C"))
            except Exception as e:
                errores.append(f"p{pid}: {e.__class__.__name__}")
                continue

            disponible = int(p.get("stock_total") or 0)
            sugerido = max(0, int(round(res.yhat_total)) + int(res.safety) - disponible)
            if sugerido <= 0:
                continue

            top1 = (res.top or [{"factor": "tendencia"}])[0]["factor"]
            msg = f"Sugerido {sugerido} uds para {h} días"
            explicacion = {
                "modelo": res.modelo,
                "h": h,
                "r2": round(res.r2, 4),
                "mae": round(res.mae, 2),
                "rmse": round(res.rmse, 2),
                "safety": int(res.safety),
                "top": res.top,
                "razon": top1,
            }
            _, creada = asegurar_alerta_sugerencia_stock(
                producto_id=pid, mensaje=msg, criticidad="sugerencia", explicacion=explicacion
            )
            if creada:
                creadas += 1

        return Response(
            {"ok": True, "procesados": procesados, "sugerencias_creadas": creadas, "errores": errores},
            status=status.HTTP_200_OK
        )


class AlertaResolverView(APIView):
    """PATCH /api/inventory/alertas/<pk>/resolver"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        try:
            al = Alerta.objects.get(
                id=pk, tipo="stock", estado="activa",
                producto__usuario=request.user
            )
        except Alerta.DoesNotExist:
            return Response({"detail": "No encontrada o ya resuelta."}, status=404)
        al.estado = "resuelta"
        al.resolved_at = timezone.now()
        al.save(update_fields=["estado", "resolved_at"])
        return Response(AlertaSerializer(al).data)
