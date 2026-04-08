from collections import defaultdict
from decimal import Decimal
from typing import List, Tuple
import io

import pandas as pd
from django.db import transaction
from django.utils import timezone

from inventory.models import Lote, Movimiento, Producto, Venta, VentaItem
from ml.cleaning import CSVCleaner

from .productos import recalcular_productos


class ImportService:
    @staticmethod
    def import_from_csv(file, user) -> Tuple[int, List[str]]:
        """
        Procesa un CSV, lo limpia y guarda los datos en la BD.
        Retorna (cantidad_registros, errores).
        """
        try:
            content = file.read().decode("utf-8", errors="replace")
            df = pd.read_csv(io.StringIO(content), sep=None, engine="python")
        except Exception as e:
            return 0, [f"Error al leer el archivo: {str(e)}"]

        cleaner = CSVCleaner(df)
        clean_df, errors = cleaner.clean()

        if errors:
            return 0, errors
        if clean_df.empty:
            return 0, ["El archivo no contiene filas validas para importar."]

        rows = clean_df.to_dict("records")

        try:
            product_codes = sorted({str(row["codigo"]).strip() for row in rows})
            product_map = {
                producto.codigo: producto
                for producto in Producto.objects.filter(usuario=user, codigo__in=product_codes)
            }

            products_to_create = {}
            products_to_update = {}

            for row in rows:
                codigo = str(row["codigo"]).strip()
                nombre = str(row.get("nombre") or f"Producto {codigo}").strip()
                precio_fila = Decimal(str(row.get("precio_costo", row.get("precio", 0)) or 0))

                if codigo not in product_map and codigo not in products_to_create:
                    products_to_create[codigo] = Producto(
                        usuario=user,
                        codigo=codigo,
                        nombre=nombre,
                        valor_unitario=precio_fila,
                    )
                elif codigo in product_map:
                    producto = product_map[codigo]
                    if Decimal(producto.valor_unitario) == 0 and precio_fila > 0:
                        producto.valor_unitario = precio_fila
                        products_to_update[codigo] = producto

            if products_to_create:
                Producto.objects.bulk_create(list(products_to_create.values()))
                for producto in Producto.objects.filter(
                    usuario=user,
                    codigo__in=list(products_to_create.keys()),
                ):
                    product_map[producto.codigo] = producto

            if products_to_update:
                Producto.objects.bulk_update(list(products_to_update.values()), ["valor_unitario"])

            lot_keys = {
                (
                    product_map[str(row["codigo"]).strip()].id,
                    str(row.get("lote") or "IMPORTADO").strip(),
                )
                for row in rows
            }
            product_ids = [product_id for product_id, _ in lot_keys]
            lot_numbers = [numero_lote for _, numero_lote in lot_keys]

            lot_map = {
                (lote.producto_id, lote.numero_lote or "IMPORTADO"): lote
                for lote in Lote.objects.filter(
                    producto_id__in=product_ids,
                    numero_lote__in=lot_numbers,
                )
            }

            lotes_to_create = []
            for product_id, numero_lote in lot_keys:
                if (product_id, numero_lote) not in lot_map:
                    lotes_to_create.append(
                        Lote(
                            producto_id=product_id,
                            numero_lote=numero_lote,
                            fecha_caducidad=timezone.now().date() + timezone.timedelta(days=365),
                        )
                    )

            if lotes_to_create:
                Lote.objects.bulk_create(lotes_to_create)
                lot_map = {
                    (lote.producto_id, lote.numero_lote or "IMPORTADO"): lote
                    for lote in Lote.objects.filter(
                        producto_id__in=product_ids,
                        numero_lote__in=lot_numbers,
                    )
                }

            count = 0
            lot_stock_delta = defaultdict(int)
            ventas_to_create = []
            sales_rows = []
            movimientos_to_create = []

            with transaction.atomic():
                for row in rows:
                    codigo = str(row["codigo"]).strip()
                    producto = product_map[codigo]
                    lote_val = str(row.get("lote") or "IMPORTADO").strip()
                    lote = lot_map[(producto.id, lote_val)]

                    tipo_movimiento = str(row.get("tipo_movimiento", "salida")).lower().strip()
                    es_entrada = tipo_movimiento == "entrada"
                    cantidad = int(row["cantidad"])
                    fecha = pd.to_datetime(row["fecha"])
                    precio_fila = Decimal(str(row.get("precio_costo", row.get("precio", 0)) or 0))

                    if es_entrada:
                        movimientos_to_create.append(
                            Movimiento(
                                producto=producto,
                                lote=lote,
                                usuario=user,
                                tipo=tipo_movimiento,
                                cantidad=cantidad,
                                fecha_mov=fecha,
                            )
                        )
                        lot_stock_delta[lote.id] += cantidad
                    else:
                        precio_venta = precio_fila if precio_fila > 0 else Decimal(producto.valor_unitario)
                        venta = Venta(
                            usuario=user,
                            fecha=fecha.date(),
                            total=Decimal(cantidad) * precio_venta,
                        )
                        ventas_to_create.append(venta)
                        sales_rows.append((venta, producto, lote, cantidad, precio_venta, fecha, tipo_movimiento))
                        lot_stock_delta[lote.id] -= cantidad

                    count += 1

                if ventas_to_create:
                    Venta.objects.bulk_create(ventas_to_create, batch_size=500)

                venta_items_to_create = []
                for venta, producto, lote, cantidad, precio_venta, fecha, tipo_movimiento in sales_rows:
                    venta_items_to_create.append(
                        VentaItem(
                            venta=venta,
                            producto=producto,
                            lote=lote,
                            cantidad=cantidad,
                            precio_unitario=precio_venta,
                        )
                    )
                    movimientos_to_create.append(
                        Movimiento(
                            producto=producto,
                            lote=lote,
                            usuario=user,
                            tipo=tipo_movimiento,
                            cantidad=cantidad,
                            venta=venta,
                            fecha_mov=fecha,
                        )
                    )

                if venta_items_to_create:
                    VentaItem.objects.bulk_create(venta_items_to_create, batch_size=500)
                if movimientos_to_create:
                    Movimiento.objects.bulk_create(movimientos_to_create, batch_size=500)

                lotes_a_actualizar = []
                for lote in lot_map.values():
                    delta = lot_stock_delta.get(lote.id, 0)
                    if delta:
                        lote.stock_lote += delta
                        lotes_a_actualizar.append(lote)

                if lotes_a_actualizar:
                    Lote.objects.bulk_update(lotes_a_actualizar, ["stock_lote"], batch_size=500)

            try:
                recalcular_productos(usuario=user)
            except BaseException as e:
                print("Warning: Falla al recalcular productos tras importacion:", str(e))

            return count, []
        except Exception as e:
            return 0, [f"Error al procesar la importacion: {str(e)}"]
