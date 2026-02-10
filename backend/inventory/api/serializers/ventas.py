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

    class Meta:
        model = Venta
        fields = ["id", "fecha", "total", "anulada", "items"]
