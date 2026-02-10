from rest_framework import serializers

from inventory.models import Alerta


class AlertaSerializer(serializers.ModelSerializer):
    producto_codigo = serializers.CharField(source="producto.codigo", read_only=True)
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = Alerta
        fields = (
            "id", "tipo", "estado", "criticidad", "mensaje",
            "producto", "producto_codigo", "producto_nombre",
            "lote", "created_at", "resolved_at",
            "explicacion",
        )
