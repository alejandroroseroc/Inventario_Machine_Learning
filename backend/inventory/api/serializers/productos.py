from decimal import Decimal

from rest_framework import serializers

from inventory.models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    precio_venta = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Producto
        fields = (
            "id", "codigo", "nombre", "categoria", "punto_reorden",
            "valor_unitario", "precio_costo", "margen_ganancia",
            "precio_venta", "codigo_barras",
        )

    def get_precio_venta(self, obj):
        return obj.valor_unitario

    def validate_punto_reorden(self, value):
        if value < 0:
            raise serializers.ValidationError("El punto de reorden no puede ser negativo.")
        return value

    def validate_valor_unitario(self, value):
        if value < 0:
            raise serializers.ValidationError("El valor unitario no puede ser negativo.")
        return value

    def validate(self, attrs):
        pc = attrs.get("precio_costo")
        mg = attrs.get("margen_ganancia")

        pc_float = float(pc) if pc is not None else 0.0
        mg_float = float(mg) if mg is not None else 0.0

        if pc_float > 0 and mg_float > 0:
            computed = round(pc_float * (1 + mg_float / 100), 2)
            attrs["valor_unitario"] = Decimal(str(computed))

        vu = attrs.get("valor_unitario")
        if vu is not None and not (pc_float > 0 and mg_float > 0):
            if float(vu) < 500:
                raise serializers.ValidationError(
                    {"valor_unitario": "El valor unitario debe ser al menos 500 COP."}
                )

        return attrs
