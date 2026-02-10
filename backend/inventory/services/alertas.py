from inventory.models import Producto, Alerta
from inventory.repositories import (
    stock_total_producto,
    alerta_stock_activa,
    crear_alerta_stock,
    resolver_alertas_stock,
)


def asegurar_alerta_stock(producto: Producto) -> bool:
    """
    Si stock_total < ROP -> deja alerta 'activa' (crea o actualiza mensaje).
    Si stock_total >= ROP -> resuelve alertas activas.
    Retorna True si queda alerta activa.
    """
    rop = int(producto.punto_reorden or 0)
    stock = stock_total_producto(producto.id)

    if stock < rop:
        msg = f"Stock {stock} < ROP {rop} para {producto.codigo}"
        al = alerta_stock_activa(producto.id)
        if al:
            if al.mensaje != msg:
                al.mensaje = msg
                al.save(update_fields=["mensaje"])
        else:
            crear_alerta_stock(producto.id, msg, "critico")
        return True
    else:
        resolver_alertas_stock(producto.id)
        return False


def asegurar_alerta_caducidad(lote) -> bool:
    """
    Si fecha_caducidad <= hoy + 60 dias -> crea alerta 'caducidad'
    Retorna True si queda alerta activa.
    """
    from datetime import date, timedelta
    hoy = date.today()
    limite = hoy + timedelta(days=60)
    
    if lote.fecha_caducidad <= limite and lote.stock_lote > 0:
        dias = (lote.fecha_caducidad - hoy).days
        msg = f"Lote {lote.numero_lote or lote.id} vence en {dias} días ({lote.fecha_caducidad})"
        
        # Buscar alerta existente
        al = Alerta.objects.filter(
            tipo="caducidad", 
            producto_id=lote.producto_id, 
            lote_id=lote.id,
            estado="activa"
        ).first()

        if al:
            if al.mensaje != msg:
                al.mensaje = msg
                al.save(update_fields=["mensaje"])
        else:
            Alerta.objects.create(
                tipo="caducidad",
                producto_id=lote.producto_id,
                lote_id=lote.id,
                mensaje=msg,
                criticidad="alta",
                estado="activa"
            )
        return True
    else:
        # Resolver si existe
        Alerta.objects.filter(
            tipo="caducidad", 
            producto_id=lote.producto_id, 
            lote_id=lote.id, 
            estado="activa"
        ).update(estado="resuelta")
        return False


def recalcular_alertas_stock_todas(usuario=None):
    """Recalcula alertas de stock y caducidad para todos los productos/lotes del usuario."""
    from inventory.models import Lote  # Importacion local para evitar circular si fuera necesario
    
    total_stock = 0
    total_caducidad = 0
    
    # 1. Alertas de Stock (ROP)
    qs_p = Producto.objects.all().only("id", "punto_reorden", "codigo")
    if usuario:
        qs_p = qs_p.filter(usuario=usuario)
    for p in qs_p:
        if asegurar_alerta_stock(p):
            total_stock += 1

    # 2. Alertas de Caducidad (Lotes)
    qs_l = Lote.objects.select_related("producto").filter(stock_lote__gt=0)
    if usuario:
        qs_l = qs_l.filter(producto__usuario=usuario)
    
    for l in qs_l:
        if asegurar_alerta_caducidad(l):
            total_caducidad += 1
            
    return {"activos_stock": total_stock, "activos_caducidad": total_caducidad}


def asegurar_alerta_sugerencia_stock(
    *, producto_id: int, mensaje: str, criticidad: str = "sugerencia",
    explicacion: dict | None = None
):
    """
    Crea/actualiza UNA alerta 'stock' activa para sugerencia ML del producto.
    """
    al = (
        Alerta.objects
        .filter(tipo="stock", producto_id=producto_id, estado="activa", criticidad=criticidad)
        .first()
    )
    if al:
        changed = False
        if al.mensaje != mensaje:
            al.mensaje = mensaje
            changed = True
        if al.explicacion != explicacion:
            al.explicacion = explicacion
            changed = True
        if changed:
            al.save(update_fields=["mensaje", "explicacion"])
        return al, False

    al = Alerta.objects.create(
        tipo="stock",
        producto_id=producto_id,
        mensaje=mensaje,
        criticidad=criticidad,
        estado="activa",
        explicacion=explicacion,
    )
    return al, True
