# inventory/models.py
from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone  # ✅ OJO: este es el correcto

class Producto(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    categoria = models.CharField(max_length=1, choices=[("A","A"),("B","B"),("C","C")], default="C")
    punto_reorden = models.IntegerField(default=0)
    valor_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    codigo_barras = models.CharField(max_length=32, blank=True, null=True)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

class Lote(models.Model):
    producto = models.ForeignKey(Producto, related_name="lotes", on_delete=models.CASCADE)
    fecha_caducidad = models.DateField()
    stock_lote = models.IntegerField(default=0)
    fecha_ingreso = models.DateField(auto_now_add=True)
    numero_lote = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    codigo_barras = models.CharField(max_length=64, blank=True, null=True)

    def __str__(self):
        return f"Lote #{self.id} ({self.producto.codigo})"

class Movimiento(models.Model):
    TIPO = (("entrada","entrada"), ("salida","salida"), ("ajuste","ajuste"))
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    lote = models.ForeignKey(Lote, null=True, blank=True, on_delete=models.SET_NULL)
    usuario = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    tipo = models.CharField(max_length=10, choices=TIPO)
    cantidad = models.IntegerField()
    fecha_mov = models.DateTimeField(auto_now_add=True)
    # ✅ Nuevo: ligar movimiento a la venta (opcional)
    venta = models.ForeignKey("Venta", null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="movimientos")

    def __str__(self):
        return f"{self.tipo} p{self.producto_id} x{self.cantidad} (lote {self.lote_id or '-'})"

class Alerta(models.Model):
    TIPO = (("stock", "stock"), ("caducidad", "caducidad"))
    ESTADO = (("activa", "activa"), ("resuelta", "resuelta"))

    tipo = models.CharField(max_length=20, choices=TIPO)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="alertas")
    lote = models.ForeignKey(Lote, null=True, blank=True, on_delete=models.SET_NULL)
    mensaje = models.CharField(max_length=255)
    criticidad = models.CharField(max_length=10, default="critico")
    estado = models.CharField(max_length=10, choices=ESTADO, default="activa")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tipo", "estado"]),
            models.Index(fields=["producto", "tipo", "estado"]),
        ]

    def __str__(self):
        return f"[{self.tipo}] {self.producto.codigo} - {self.estado}"

class Venta(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    fecha = models.DateField(default=timezone.localdate)   # ✅ date puro
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    anulada = models.BooleanField(default=False)           # ✅ imprescindible
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="ventas"
    )
class VentaItem(models.Model):
    venta = models.ForeignKey(Venta, related_name="items", on_delete=models.CASCADE)
    producto = models.ForeignKey("Producto", on_delete=models.PROTECT)
    lote = models.ForeignKey("Lote", null=True, blank=True, on_delete=models.SET_NULL)
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"VentaItem v{self.venta_id} p{self.producto_id} x{self.cantidad}"
