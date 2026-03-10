import pandas as pd
from django.db import transaction
from django.utils import timezone
from inventory.models import Producto, Lote, Movimiento, Venta, VentaItem
from .productos import recalcular_productos
from ml.cleaning import CSVCleaner
from typing import List, Tuple

class ImportService:
    @staticmethod
    def import_from_csv(file, user) -> Tuple[int, List[str]]:
        """
        Procesa un CSV, lo limpia y guarda los datos en la BD.
        Retorna (cantidad_registros, errores).
        """
        try:
            import io
            content = file.read().decode('utf-8', errors='replace')
            df = pd.read_csv(io.StringIO(content), sep=None, engine='python')
        except Exception as e:
            return 0, [f"Error al leer el archivo: {str(e)}"]

        cleaner = CSVCleaner(df)
        clean_df, errors = cleaner.clean()

        if errors:
            return 0, errors

        count = 0
        with transaction.atomic():
            for _, row in clean_df.iterrows():
                precio_fila = float(row.get('precio_costo', row.get('precio', 0)))
                # 1. Obtener o crear producto
                producto, created = Producto.objects.get_or_create(
                    usuario=user,
                    codigo=row['codigo'],
                    defaults={
                        'nombre': row.get('nombre', f"Producto {row['codigo']}"),
                        'valor_unitario': precio_fila
                    }
                )
                
                # Actualizar el precio si es una entrada inicial y el precio base estaba en cero
                if not created and producto.valor_unitario == 0 and precio_fila > 0:
                    producto.valor_unitario = precio_fila
                    producto.save(update_fields=['valor_unitario'])

                # 2. Obtener o crear lote
                lote_val = row.get('lote', 'IMPORTADO')
                lote, _ = Lote.objects.get_or_create(
                    producto=producto,
                    numero_lote=lote_val,
                    defaults={'fecha_caducidad': timezone.now().date() + timezone.timedelta(days=365)}
                )

                # 3. Determinar tipo de movimiento
                # Si el CSV tiene columna 'tipo_movimiento' y dice 'entrada', es un inventario inicial/compra.
                # Si no, asumimos que es 'salida' (venta histórica).
                tipo_movimiento = str(row.get('tipo_movimiento', 'salida')).lower().strip()
                es_entrada = (tipo_movimiento == 'entrada')

                cantidad = int(row['cantidad'])
                fecha = row['fecha']
                
                venta = None
                
                # Solo crear Venta y VentaItem si NO es una entrada
                if not es_entrada:
                    # Usar el precio de la fila, o el del producto si la fila dice 0
                    precio_venta = precio_fila if precio_fila > 0 else float(producto.valor_unitario)
                    
                    # Crear la venta para que el modelo de demanda la detecte
                    venta = Venta.objects.create(
                        usuario=user,
                        fecha=fecha.date(),
                        total=cantidad * precio_venta
                    )
                
                    VentaItem.objects.create(
                        venta=venta,
                        producto=producto,
                        lote=lote,
                        cantidad=cantidad,
                        precio_unitario=precio_venta
                    )

                # Registrar el movimiento (entrada o salida)
                Movimiento.objects.create(
                    producto=producto,
                    lote=lote,
                    usuario=user,
                    tipo=tipo_movimiento, # 'entrada' o 'salida'
                    cantidad=cantidad,
                    venta=venta, # Será None si fue una entrada
                    fecha_mov=fecha # Preservar fecha histórica
                )
                
                # ACTUALIZAR STOCK DEL LOTE REAL (¡Importante!)
                if es_entrada:
                    lote.stock_lote += cantidad
                else:
                    lote.stock_lote -= cantidad
                
                lote.save(update_fields=['stock_lote'])
                
                count += 1
                
        # Al finalizar la carga masiva (especialmente útil si hubo entradas), recalcular categorías ABC y ROP base
        try:
            recalcular_productos()
        except BaseException as e:
            # No detener el retorno de éxito por el recalcular
            print("Warning: Falla al recalcular productos tras importación:", str(e))

        return count, []
