from datetime import date

from django.core.exceptions import ValidationError

from inventory.models import Producto
from inventory.repositories import lotes_de_producto, crear_lote


def obtener_lotes(producto_id: int):
    """Retorna los lotes de un producto."""
    if not Producto.objects.filter(id=producto_id).exists():
        raise ValidationError("Producto no encontrado.")
    return list(lotes_de_producto(producto_id))


def registrar_lote(payload: dict):
    """Registra un nuevo lote para un producto."""
    try:
        producto_id = int(payload.get("producto"))
        stock_lote = int(payload.get("stock_lote"))
        fc = payload.get("fecha_caducidad")
        if isinstance(fc, str):
            fecha_caducidad = date.fromisoformat(fc)
        elif isinstance(fc, date):
            fecha_caducidad = fc
        else:
            raise ValidationError("Formato de fecha inválido.")
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("Datos inválidos.")

    if not Producto.objects.filter(id=producto_id).exists():
        raise ValidationError("Producto no encontrado.")
    if stock_lote < 0:
        raise ValidationError("El stock del lote no puede ser negativo.")
    if not fecha_caducidad:
        raise ValidationError("La fecha de caducidad es obligatoria.")
    if fecha_caducidad < date.today():
        raise ValidationError("La fecha de caducidad debe ser hoy o futura.")

    return crear_lote(
        producto_id, 
        fecha_caducidad, 
        stock_lote, 
        numero_lote=payload.get("numero_lote"),
        codigo_barras=payload.get("codigo_barras")
    )
