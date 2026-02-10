import pandas as pd
from django.db import transaction
from django.utils import timezone
from inventory.models import Producto, Lote, Movimiento, Venta, VentaItem
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
            df = pd.read_csv(file, sep=None, engine='python')
        except Exception as e:
            return 0, [f"Error al leer el archivo: {str(e)}"]

        cleaner = CSVCleaner(df)
        clean_df, errors = cleaner.clean()

        if errors:
            return 0, errors

        count = 0
        with transaction.atomic():
            # Crear una venta general para esta importación? 
            # O mejor registrar movimientos individuales. 
            # El usuario pidió "limpieza de los csv de los farmacéuticos".
            # Asumiremos que son ventas pasadas para alimentar el modelo de demanda.
            
            for _, row in clean_df.iterrows():
                # 1. Obtener o crear producto
                producto, _ = Producto.objects.get_or_create(
                    usuario=user,
                    codigo=row['codigo'],
                    defaults={'nombre': row.get('nombre', f"Producto {row['codigo']}")}
                )

                # 2. Obtener o crear lote (genérico si no hay)
                lote_val = row.get('lote', 'IMPORTADO')
                lote, _ = Lote.objects.get_or_create(
                    producto=producto,
                    numero_lote=lote_val,
                    defaults={'fecha_caducidad': timezone.now().date() + timezone.timedelta(days=365)}
                )

                # 3. Registrar movimiento (salida de venta)
                cantidad = int(row['cantidad'])
                fecha = row['fecha']
                
                # Crear la venta para que el modelo de demanda la detecte
                venta = Venta.objects.create(
                    usuario=user,
                    fecha=fecha.date(),
                    total=cantidad * float(row.get('precio', 0))
                )
                
                VentaItem.objects.create(
                    venta=venta,
                    producto=producto,
                    lote=lote,
                    cantidad=cantidad,
                    precio_unitario=float(row.get('precio', 0))
                )

                # El movimiento se suele crear vía señal o manualmente
                Movimiento.objects.create(
                    producto=producto,
                    lote=lote,
                    usuario=user,
                    tipo='salida',
                    cantidad=cantidad,
                    venta=venta
                )
                
                count += 1

        return count, []
