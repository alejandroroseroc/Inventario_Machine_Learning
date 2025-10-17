from decimal import Decimal
from .repositories import (
    valor_total_inventario, productos_bajo_rop_count,
    lotes_por_vencer_count, movimientos_recientes
)

def compute_kpis():
    valor = valor_total_inventario()
    bajo, total = productos_bajo_rop_count()
    porcentaje = float(bajo / total * 100) if total else 0.0
    por_vencer = lotes_por_vencer_count(meses=2)
    eventos = []
    for m in movimientos_recientes():
        verb = "Recibí" if m.tipo == "entrada" else "Se vendieron" if m.tipo == "salida" else "Ajuste"
        qtxt = f"{m.cantidad} de {m.producto.nombre}"
        eventos.append(f"{verb} {qtxt}.")
    return {
        "valor_total": str(valor if isinstance(valor, Decimal) else valor),
        "porcentaje_criticos": round(porcentaje, 2),
        "por_vencer": por_vencer,
        "transacciones_recientes": eventos
    }
