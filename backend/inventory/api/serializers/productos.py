from rest_framework import serializers

from inventory.models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ("id", "codigo", "nombre", "categoria", "punto_reorden", "valor_unitario", "codigo_barras")

    def validate_punto_reorden(self, value):
        if value < 0:
            raise serializers.ValidationError("El punto de reorden no puede ser negativo.")
        return value

    def validate_valor_unitario(self, value):
        if value < 500:
            raise serializers.ValidationError("El valor unitario debe ser al menos 500 COP.")
        return value
