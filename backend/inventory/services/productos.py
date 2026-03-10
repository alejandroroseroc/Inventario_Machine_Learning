import math
from decimal import Decimal

from django.db import transaction

from inventory.models import Producto
from inventory.repositories import demanda_media_diaria, ingresos_por_producto

# Constantes para clasificación ABC y cálculo de ROP
ABC_CUTOFF_A = 0.80
ABC_CUTOFF_B = 0.95
ABC_WINDOW_DAYS = 30
ROP_LEAD_TIME = 5
ROP_BUFFER = 0.25


def _calcular_rop(producto):
    """Calcula el punto de reorden basado en demanda media diaria.
    Usa una ventana flexible: si en 30 días no hay datos, busca en 180 días.
    """
    dmd = demanda_media_diaria(producto, dias=ABC_WINDOW_DAYS)
    if dmd <= 0:
        # Fallback para datos de tesis cargados históricamente
        dmd = demanda_media_diaria(producto, dias=180)
        
    rop = math.ceil(dmd * ROP_LEAD_TIME * (1.0 + ROP_BUFFER))
    return max(0, int(rop))


def _clasificacion_abc():
    """Calcula la clasificación ABC basada en ingresos con ventana flexible."""
    ingresos = ingresos_por_producto(dias=ABC_WINDOW_DAYS)
    if not ingresos or sum(float(v or 0) for v in ingresos.values()) <= 0:
        # Fallback a 180 días si los últimos 30 están vacíos
        ingresos = ingresos_por_producto(dias=180)
        
    if not ingresos:
        return {}
    total = sum(float(v or 0) for v in ingresos.values()) or 0.0
    if total <= 0:
        return {}
    orden = sorted(ingresos.items(), key=lambda kv: kv[1], reverse=True)
    cumul = 0.0
    out = {}
    for pid, val in orden:
        cumul += float(val or 0) / total
        if cumul <= ABC_CUTOFF_A:
            out[pid] = "A"
        elif cumul <= ABC_CUTOFF_B:
            out[pid] = "B"
        else:
            out[pid] = "C"
    return out


def obtener_productos(usuario=None):
    """Retorna los productos del usuario ordenados por ID."""
    qs = Producto.objects.all()
    if usuario:
        qs = qs.filter(usuario=usuario)
    return qs.order_by("id")


@transaction.atomic
def registrar_producto(data, usuario):
    """Registra un nuevo producto con cálculo automático de ROP y categoría ABC."""
    codigo = (data.get("codigo") or "").strip()
    nombre = (data.get("nombre") or "").strip()
    categoria = (data.get("categoria") or None) or None
    punto_reorden = data.get("punto_reorden", None)
    valor_unitario = data.get("valor_unitario")
    if valor_unitario is None:
        valor_unitario = Decimal("0")

    p = Producto.objects.create(
        usuario=usuario,
        codigo=codigo,
        nombre=nombre,
        categoria=categoria or "C",
        punto_reorden=punto_reorden or 0,
        valor_unitario=valor_unitario,
    )

    if not data.get("punto_reorden"):
        p.punto_reorden = _calcular_rop(p)

    if not data.get("categoria"):
        mapa = _clasificacion_abc()
        p.categoria = mapa.get(p.id, "C")

    p.save()
    return p


@transaction.atomic
def recalcular_productos():
    """Recalcula ROP y categoría ABC para todos los productos."""
    mapa = _clasificacion_abc()
    updated = 0
    for p in Producto.objects.all():
        new_rop = _calcular_rop(p)
        new_cat = mapa.get(p.id, "C")
        if p.punto_reorden != new_rop or p.categoria != new_cat:
            p.punto_reorden = new_rop
            p.categoria = new_cat
            p.save(update_fields=["punto_reorden", "categoria"])
            updated += 1
    return {"updated": updated}
