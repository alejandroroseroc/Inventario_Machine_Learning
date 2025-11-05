from django.db import models
from django.contrib.auth.models import User

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
    numero_lote = models.CharField(max_length=64, blank=True, null=True, db_index=True)  # ← NUEVO
    codigo_barras = models.CharField(max_length=64, blank=True, null=True)

class Movimiento(models.Model):
    TIPO = (("entrada","entrada"), ("salida","salida"), ("ajuste","ajuste"))
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    lote = models.ForeignKey(Lote, null=True, blank=True, on_delete=models.SET_NULL)
    usuario = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    tipo = models.CharField(max_length=10, choices=TIPO)
    cantidad = models.IntegerField()
    fecha_mov = models.DateTimeField(auto_now_add=True)

# ====== NUEVO: modelo de alertas ======
class Alerta(models.Model):
    TIPO = (("stock", "stock"), ("caducidad", "caducidad"))
    ESTADO = (("activa", "activa"), ("resuelta", "resuelta"))

    tipo = models.CharField(max_length=20, choices=TIPO)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="alertas")
    lote = models.ForeignKey(Lote, null=True, blank=True, on_delete=models.SET_NULL)
    mensaje = models.CharField(max_length=255)
    criticidad = models.CharField(max_length=10, default="critico")  # "critico" | "warning"
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
