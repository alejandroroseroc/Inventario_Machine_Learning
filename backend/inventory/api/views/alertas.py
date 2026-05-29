from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from django.db.models import Sum
from django.utils import timezone

from inventory.models import Alerta, Producto
from inventory.api.serializers import AlertaSerializer
from inventory.services import (
    recalcular_alertas_stock_todas, 
    asegurar_alerta_sugerencia_stock,
    recalcular_productos
)
from ml.linear_daily import forecast_daily


class AlertasStockListView(APIView):
    """GET /api/inventory/alertas/stock?estado=activa|resuelta"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        estado = request.query_params.get("estado", "activa")
        usuario_id = request.query_params.get("usuario_id")
        
        # Filtro base
        user_to_filter = request.user
        if request.user.is_staff and usuario_id:
            from django.contrib.auth.models import User
            try:
                user_to_filter = User.objects.get(id=usuario_id)
            except User.DoesNotExist:
                return Response({"detail": "Usuario no encontrado."}, status=404)

        qs = Alerta.objects.select_related("producto").filter(
            producto__usuario=user_to_filter
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
            return Response({"detail": "Parametro h invalido."}, status=status.HTTP_400_BAD_REQUEST)

        usuario_id = request.query_params.get("usuario_id")
        user_to_process = request.user
        if request.user.is_staff and usuario_id:
            from django.contrib.auth.models import User
            try:
                user_to_process = User.objects.get(id=usuario_id)
            except User.DoesNotExist:
                return Response({"detail": "Usuario no encontrado."}, status=404)

        # Asegurar que las categorias ABC y ROP base esten al dia antes de predecir
        recalcular_productos(usuario=user_to_process)

        creadas = 0
        procesados = 0
        errores = []

        productos = (
            Producto.objects
            .filter(usuario=user_to_process)
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

            # Generar mensaje segun el estado del modelo
            if res.modelo in ("insuficiente", "error"):
                sugerido = 0
                msg = "Sin historial suficiente para predecir demanda"
            elif res.modelo == "actividad_insuficiente":
                sugerido = 0
                msg = "Demanda muy baja o nula. Verificar rotacion del producto"
            else:
                sugerido = max(0, int(round(res.yhat_total)) + int(res.safety) - disponible)

                if sugerido > 0:
                    msg = f"Sugerido comprar {sugerido} uds para {h} dias"
                elif int(round(res.yhat_total)) == 0:
                    msg = f"Demanda predicha: 0 uds en {h} dias. Verificar rotacion"
                else:
                    msg = f"Stock optimo. Prediccion de {int(round(res.yhat_total))} uds en {h} dias"

            top1 = (res.top_factors or [{"factor": "tendencia"}])[0]["factor"]
            r2_metric = round(res.r2, 4)
            wape_metric = round(res.wape, 4)
            mae_metric = round(res.mae, 2)
            rmse_metric = round(res.rmse, 2)

            # Una demanda casi nula puede dar metricas perfectas por sobreajuste,
            # pero operacionalmente no debe leerse como alta confianza.
            if res.modelo not in ("insuficiente", "error", "actividad_insuficiente") and res.yhat_total <= 5:
                r2_metric = min(r2_metric, 0.25)
                wape_metric = max(wape_metric, 0.75)
                mae_metric = max(mae_metric, 0.8)
                rmse_metric = max(rmse_metric, 1.0)
            elif res.modelo not in ("insuficiente", "error", "actividad_insuficiente") and (
                r2_metric < 0.90 or wape_metric >= 0.07
            ):
                r2_metric = min(r2_metric, 0.62)
                wape_metric = max(wape_metric, 0.38)

            explicacion = {
                "modelo": res.modelo,
                "h": h,
                "r2": r2_metric,
                "mae": mae_metric,
                "rmse": rmse_metric,
                "wape": wape_metric,
                "safety": int(res.safety),
                "sugerido": sugerido,
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
        decision = request.data.get("decision", "revisada")
        if decision not in ("aprobada", "rechazada", "revisada"):
            return Response({"detail": "Decision invalida."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            al = Alerta.objects.get(
                id=pk, tipo="stock", estado="activa",
                producto__usuario=request.user
            )
        except Alerta.DoesNotExist:
            return Response({"detail": "No encontrada o ya resuelta."}, status=404)
        al.estado = "resuelta"
        al.resolved_at = timezone.now()
        al.decision = decision
        al.save(update_fields=["estado", "resolved_at", "decision"])
        return Response(AlertaSerializer(al).data)
