from rest_framework import serializers
from .models import Producto

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ("id", "codigo", "nombre", "categoria", "punto_reorden", "valor_unitario")

    def validate_punto_reorden(self, value):
        if value < 0:
            raise serializers.ValidationError("El punto de reorden no puede ser negativo.")
        return value

    def validate_valor_unitario(self, value):
        if value < 0:
            raise serializers.ValidationError("El valor unitario no puede ser negativo.")
        return value
