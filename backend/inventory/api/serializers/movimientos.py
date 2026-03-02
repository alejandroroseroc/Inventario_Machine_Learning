from rest_framework import serializers

from inventory.models import Movimiento


class MovimientoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    producto_codigo = serializers.CharField(source="producto.codigo", read_only=True)
    lote_fecha_caducidad = serializers.DateField(source="lote.fecha_caducidad", read_only=True)

    class Meta:
        model = Movimiento
        fields = (
            "id", "tipo", "cantidad", "fecha_mov",
            "producto", "producto_codigo", "producto_nombre",
            "lote", "lote_fecha_caducidad",
        )


class MovimientoCreateSerializer(serializers.Serializer):
    producto = serializers.IntegerField()
    tipo = serializers.ChoiceField(choices=("entrada", "salida", "ajuste"))
    cantidad = serializers.IntegerField()
    lote = serializers.IntegerField(required=False, allow_null=True)
    fecha_caducidad = serializers.DateField(required=False, allow_null=True)
    motivo = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        tipo = attrs.get("tipo")
        lote_id = attrs.get("lote")
        fecha_cad = attrs.get("fecha_caducidad")

        # Salidas y ajustes negativos requieren lote (FEFO automático lo asigna internamente)
        # Entradas requieren lote_id O fecha_caducidad (para crear lote nuevo)
        if tipo == "entrada" and not lote_id and not fecha_cad:
            raise serializers.ValidationError(
                {"lote": "Para ENTRADA envía 'lote' o 'fecha_caducidad' para crear lote."}
            )
        return attrs

    def create(self, validated_data):
        req = self.context["request"]
        from inventory.services import registrar_movimiento, MovimientoValidationError, StockError
        try:
            movimientos = registrar_movimiento(
                usuario=req.user,
                producto_id=validated_data["producto"],
                tipo=validated_data["tipo"],
                cantidad=validated_data["cantidad"],
                lote_id=validated_data.get("lote"),
                fecha_caducidad=validated_data.get("fecha_caducidad"),
                motivo=validated_data.get("motivo"),
            )
            return movimientos
        except MovimientoValidationError as e:
            raise serializers.ValidationError({"detail": str(e)})
        except StockError as e:
            raise serializers.ValidationError({"detail": str(e)})
