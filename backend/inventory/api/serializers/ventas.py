from rest_framework import serializers

from inventory.models import Venta, VentaItem


class VentaItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    lote_numero = serializers.CharField(source="lote.numero_lote", read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = VentaItem
        fields = ["id", "producto", "producto_nombre", "lote", "lote_numero","cantidad", "precio_unitario", "subtotal"]

    def get_subtotal(self, obj):
        return float(obj.precio_unitario) * obj.cantidad


class VentaSerializer(serializers.ModelSerializer):
    items = VentaItemSerializer(many=True, read_only=True)
    fecha_hora = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ["id", "fecha", "fecha_hora", "created_at", "total", "anulada", "motivo_anulacion", "items"]

    def get_fecha_hora(self, obj):
        movimiento = obj.movimientos.order_by("fecha_mov", "id").first()
        if movimiento and movimiento.fecha_mov:
            return movimiento.fecha_mov.isoformat()
        if obj.created_at:
            return obj.created_at.isoformat()
        return None
