from rest_framework import serializers

from inventory.models import Lote


class LoteSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    producto_valor_unitario = serializers.DecimalField(
        source="producto.valor_unitario",
        max_digits=12, decimal_places=2,
        read_only=True,
    )
    producto_precio_costo = serializers.DecimalField(
        source="producto.precio_costo",
        max_digits=12, decimal_places=2,
        read_only=True,
    )
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = Lote
        fields = (
            "id", "producto", "producto_nombre",
            "producto_valor_unitario", "producto_precio_costo",
            "numero_lote", "fecha_caducidad", "stock_lote",
            "fecha_ingreso", "codigo_barras", "days_left", "estado",
        )

    def get_days_left(self, obj):
        from datetime import date
        from django.utils import timezone
        hoy = timezone.localdate()
        fecha = obj.fecha_caducidad
        if fecha:
            if isinstance(fecha, str):
                fecha = date.fromisoformat(fecha)
            return (fecha - hoy).days
        return None

    def validate_stock_lote(self, v):
        if v < 0:
            raise serializers.ValidationError("El stock del lote no puede ser negativo.")
        return v
