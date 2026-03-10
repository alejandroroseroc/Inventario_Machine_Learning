from decimal import Decimal

from inventory.repositories import (
    valor_total_inventario,
    productos_bajo_rop_count,
    lotes_por_vencer_count,
    movimientos_recientes,
    ventas_reales_ultimos_7_dias,
)


def compute_kpis(usuario=None):
    """Calcula los KPIs del panel principal para un usuario."""
    valor = valor_total_inventario(usuario)
    bajo, total = productos_bajo_rop_count(usuario)
    porcentaje = float(bajo / total * 100) if total else 0.0
    por_vencer = lotes_por_vencer_count(meses=2, usuario=usuario)

    eventos = []
    for m in movimientos_recientes(usuario=usuario):
        if m.tipo == "entrada":
            verb = "Recibí"
        elif m.tipo == "salida":
            verb = "Se vendieron"
        else:
            verb = "Ajuste"
        qtxt = f"{m.cantidad} de {m.producto.nombre}"
        eventos.append(f"{verb} {qtxt}.")

    valor_str = str(valor) if isinstance(valor, Decimal) else str(valor or 0)
    return {
        "valor_total": valor_str,
        "porcentaje_criticos": round(porcentaje, 2),
        "por_vencer": int(por_vencer or 0),
        "transacciones_recientes": eventos,
        "ventas_semana": ventas_reales_ultimos_7_dias(usuario),
    }
