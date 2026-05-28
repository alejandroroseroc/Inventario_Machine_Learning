from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from inventory.models import Venta, VentaItem, Movimiento, GastoDia


def _calcular_cierre(usuario, fecha):
    """
    Calcula el cierre de un día en tiempo real.
    Retorna un dict con todos los valores del cierre.
    """
    # 1. Ventas no anuladas del día
    ventas_qs = Venta.objects.filter(
        usuario=usuario, fecha=fecha, anulada=False
    )
    total_ventas = float(
        ventas_qs.aggregate(t=Coalesce(Sum("total"), Decimal("0")))["t"]
    )

    # 2. Costo de lo vendido
    costo_expr = ExpressionWrapper(
        F("cantidad") * F("producto__precio_costo"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    items_qs = VentaItem.objects.filter(
        venta__usuario=usuario,
        venta__fecha=fecha,
        venta__anulada=False,
    )
    costo_vendido = float(
        items_qs.aggregate(
            t=Coalesce(Sum(costo_expr), Decimal("0"))
        )["t"]
    )

    ganancia_bruta = total_ventas - costo_vendido

    # 3. Gastos del día
    gastos_qs = GastoDia.objects.filter(
        usuario=usuario, fecha=fecha
    ).order_by("created_at")
    gastos_lista = [
        {
            "id": g.id,
            "monto": float(g.monto),
            "observacion": g.observacion,
        }
        for g in gastos_qs
    ]
    total_gastos = sum(g["monto"] for g in gastos_lista)
    ganancia_neta = ganancia_bruta - total_gastos

    # 4. Pérdidas por vencidos del día
    perdida_venc_expr = ExpressionWrapper(
        F("cantidad") * F("producto__precio_costo"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    perdida_vencidos = float(
        Movimiento.objects.filter(
            producto__usuario=usuario,
            tipo="baja_vencimiento",
            fecha_mov__date=fecha,
        ).aggregate(
            t=Coalesce(Sum(perdida_venc_expr), Decimal("0"))
        )["t"]
    )

    # 5. Pérdidas por devoluciones del día (50%)
    perdida_devol_expr = ExpressionWrapper(
        F("cantidad") * F("producto__precio_costo"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    perdida_devolucion_raw = float(
        Movimiento.objects.filter(
            producto__usuario=usuario,
            tipo="devolucion_proveedor",
            fecha_mov__date=fecha,
        ).aggregate(
            t=Coalesce(Sum(perdida_devol_expr), Decimal("0"))
        )["t"]
    )
    perdida_devoluciones = perdida_devolucion_raw * 0.5

    total_perdidas = perdida_vencidos + perdida_devoluciones
    resultado_final = ganancia_neta - total_perdidas

    # 6. Conteo de ventas
    total_ventas_count = Venta.objects.filter(
        usuario=usuario, fecha=fecha
    ).count()
    ventas_anuladas_count = Venta.objects.filter(
        usuario=usuario, fecha=fecha, anulada=True
    ).count()

    return {
        "fecha": fecha.isoformat(),
        "total_ventas": round(total_ventas, 2),
        "costo_vendido": round(costo_vendido, 2),
        "ganancia_bruta": round(ganancia_bruta, 2),
        "gastos": gastos_lista,
        "total_gastos": round(total_gastos, 2),
        "ganancia_neta": round(ganancia_neta, 2),
        "perdida_vencidos": round(perdida_vencidos, 2),
        "perdida_devoluciones": round(perdida_devoluciones, 2),
        "total_perdidas": round(total_perdidas, 2),
        "resultado_final": round(resultado_final, 2),
        "ventas_registradas": total_ventas_count,
        "ventas_anuladas": ventas_anuladas_count,
    }


class ReporteDiarioView(APIView):
    """
    GET /api/inventory/reportes/diario?fecha=YYYY-MM-DD
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            try:
                fecha = date.fromisoformat(fecha_str)
            except ValueError:
                return Response(
                    {"detail": "Fecha inválida."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            fecha = timezone.localdate()

        data = _calcular_cierre(request.user, fecha)
        return Response(data)


class ReporteSemanalView(APIView):
    """
    GET /api/inventory/reportes/semanal?fecha=YYYY-MM-DD
    Retorna el reporte de la semana (lunes a domingo)
    que contiene la fecha dada.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            try:
                fecha_ref = date.fromisoformat(fecha_str)
            except ValueError:
                return Response(
                    {"detail": "Fecha inválida."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            fecha_ref = timezone.localdate()

        # Lunes de la semana
        lunes = fecha_ref - timedelta(days=fecha_ref.weekday())

        dias = []
        totales = {
            "total_ventas": 0,
            "costo_vendido": 0,
            "ganancia_bruta": 0,
            "total_gastos": 0,
            "ganancia_neta": 0,
            "perdida_vencidos": 0,
            "perdida_devoluciones": 0,
            "total_perdidas": 0,
            "resultado_final": 0,
        }

        nombres_dias = [
            "Lunes", "Martes", "Miércoles",
            "Jueves", "Viernes", "Sábado", "Domingo"
        ]

        for i in range(7):
            d = lunes + timedelta(days=i)
            cierre = _calcular_cierre(request.user, d)
            cierre["nombre_dia"] = nombres_dias[i]
            dias.append(cierre)
            for k in totales:
                totales[k] = round(totales[k] + cierre[k], 2)

        return Response({
            "semana_inicio": lunes.isoformat(),
            "semana_fin": (lunes + timedelta(days=6)).isoformat(),
            "dias": dias,
            "totales": totales,
        })


class ReporteMensualView(APIView):
    """
    GET /api/inventory/reportes/mensual?year=YYYY&month=MM
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            year = int(request.query_params.get(
                "year", timezone.localdate().year
            ))
            month = int(request.query_params.get(
                "month", timezone.localdate().month
            ))
        except ValueError:
            return Response(
                {"detail": "Parámetros inválidos."},
                status=status.HTTP_400_BAD_REQUEST
            )

        import calendar
        _, dias_mes = calendar.monthrange(year, month)

        totales = {
            "total_ventas": 0,
            "costo_vendido": 0,
            "ganancia_bruta": 0,
            "total_gastos": 0,
            "ganancia_neta": 0,
            "perdida_vencidos": 0,
            "perdida_devoluciones": 0,
            "total_perdidas": 0,
            "resultado_final": 0,
        }

        # Lista de gastos del mes para el detalle
        todos_gastos = list(
            GastoDia.objects.filter(
                usuario=request.user,
                fecha__year=year,
                fecha__month=month,
            ).order_by("fecha", "created_at")
            .values("id", "fecha", "monto", "observacion")
        )
        gastos_formateados = [
            {
                "id": g["id"],
                "fecha": g["fecha"].isoformat(),
                "monto": float(g["monto"]),
                "observacion": g["observacion"],
            }
            for g in todos_gastos
        ]

        # Calcular por día y acumular totales
        for dia in range(1, dias_mes + 1):
            try:
                d = date(year, month, dia)
            except ValueError:
                continue
            cierre = _calcular_cierre(request.user, d)
            for k in totales:
                totales[k] = round(totales[k] + cierre[k], 2)

        return Response({
            "year": year,
            "month": month,
            "totales": totales,
            "gastos_detalle": gastos_formateados,
        })
