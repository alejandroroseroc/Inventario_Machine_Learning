from rest_framework import serializers
from .models import Producto, Lote
from .models import Movimiento
from .models import Alerta

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ("id", "codigo", "nombre", "categoria", "punto_reorden", "valor_unitario","codigo_barras")

    def validate_punto_reorden(self, value):
        if value < 0:
            raise serializers.ValidationError("El punto de reorden no puede ser negativo.")
        return value

    def validate_valor_unitario(self, value):
        if value < 0:
            raise serializers.ValidationError("El valor unitario no puede ser negativo.")
        return value


class LoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lote
        fields = ("id", "producto", "fecha_caducidad", "stock_lote", "fecha_ingreso","codigo_barras")

    def validate_stock_lote(self, v):
        if v < 0:
            raise serializers.ValidationError("El stock del lote no puede ser negativo.")
        return v

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
    tipo = serializers.ChoiceField(choices=("entrada","salida","ajuste"))
    cantidad = serializers.IntegerField()
    lote = serializers.IntegerField(required=False, allow_null=True)
    fecha_caducidad = serializers.DateField(required=False, allow_null=True)
    motivo = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def create(self, validated_data):
        req = self.context["request"]
        from .services import registrar_movimiento, MovimientoValidationError, StockError
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
        
class AlertaSerializer(serializers.ModelSerializer):
    producto_codigo = serializers.CharField(source="producto.codigo", read_only=True)
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = Alerta
        fields = (
            "id", "tipo", "estado", "criticidad", "mensaje",
            "producto", "producto_codigo", "producto_nombre",
            "lote", "created_at", "resolved_at",
        )