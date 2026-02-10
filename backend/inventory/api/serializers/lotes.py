from rest_framework import serializers

from inventory.models import Lote


class LoteSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = Lote
        fields = ("id", "producto", "producto_nombre", "numero_lote", "fecha_caducidad", "stock_lote", "fecha_ingreso", "codigo_barras", "days_left")

    def get_days_left(self, obj):
        from django.utils import timezone
        hoy = timezone.localdate()
        if obj.fecha_caducidad:
            return (obj.fecha_caducidad - hoy).days
        return None

    def validate_stock_lote(self, v):
        if v < 0:
            raise serializers.ValidationError("El stock del lote no puede ser negativo.")
        return v
