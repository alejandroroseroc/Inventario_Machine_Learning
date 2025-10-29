from decimal import Decimal

from .repositories import (
    valor_total_inventario,
    productos_bajo_rop_count,
    lotes_por_vencer_count,
    movimientos_recientes,
)


def compute_kpis():
    """
    Ensambla los KPIs del panel con valores seguros (sin romper si hay vacíos).
    """
    valor = valor_total_inventario()

    bajo, total = productos_bajo_rop_count()
    porcentaje = float(bajo / total * 100) if total else 0.0

    por_vencer = lotes_por_vencer_count(meses=2)

    eventos = []
    for m in movimientos_recientes():
        if m.tipo == "entrada":
            verb = "Recibí"
        elif m.tipo == "salida":
            verb = "Se vendieron"
        else:
            verb = "Ajuste"
        qtxt = f"{m.cantidad} de {m.producto.nombre}"
        eventos.append(f"{verb} {qtxt}.")

    # Serialización segura del valor (Decimal -> str) para JSON
    valor_str = str(valor) if isinstance(valor, Decimal) else str(valor or 0)

    return {
        "valor_total": valor_str,            # (string) evita problemas de JSON con Decimal
        "porcentaje_criticos": round(porcentaje, 2),
        "por_vencer": int(por_vencer or 0),
        "transacciones_recientes": eventos,
    }
