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
                nombre = str(
                    row.get("nombre") or f"Producto {codigo}"
                ).strip()

                # Separar precio_costo y precio_venta
                pc = Decimal(str(
                    row.get("precio_costo", row.get("precio", 0)) or 0
                ))
                pv = Decimal(str(row.get("precio_venta", 0) or 0))
                mg = Decimal(str(row.get("margen_ganancia", 0) or 0))

                # Si solo viene un precio, úsalo para ambos
                if mg == 0 and pc > 0 and pv > 0 and pv >= pc:
                    mg = ((pv - pc) / pc) * Decimal("100")

                if pc > 0 and pv == 0 and mg > 0:
                    pv = pc * (Decimal("1") + (mg / Decimal("100")))
                elif pc > 0 and pv == 0:
                    pv = pc
                elif pv > 0 and pc == 0:
                    pc = pv

                if mg > 0:
                    mg = mg.quantize(Decimal("0.01"))
                if pv > 0:
                    pv = pv.quantize(Decimal("0.01"))

                if codigo not in product_map \
                        and codigo not in products_to_create:
                    products_to_create[codigo] = Producto(
                        usuario=user,
                        codigo=codigo,
                        nombre=nombre,
                        precio_costo=pc,
                        valor_unitario=pv,
                        margen_ganancia=mg,
                        activo=True,
                    )
                elif codigo in product_map:
                    producto = product_map[codigo]
                    changed = False
                    if Decimal(producto.precio_costo) == 0 and pc > 0:
                        producto.precio_costo = pc
                        changed = True
                    if Decimal(producto.valor_unitario) == 0 and pv > 0:
                        producto.valor_unitario = pv
                        changed = True
                    if mg > 0 and Decimal(producto.margen_ganancia) != mg:
                        producto.margen_ganancia = mg
                        changed = True
                    if changed:
                        products_to_update[codigo] = producto

            if products_to_create:
                Producto.objects.bulk_create(list(products_to_create.values()))
                for producto in Producto.objects.filter(
                    usuario=user,
                    codigo__in=list(products_to_create.keys()),
                ):
                    product_map[producto.codigo] = producto

            if products_to_update:
                Producto.objects.bulk_update(
                    list(products_to_update.values()),
                    ["precio_costo", "valor_unitario", "margen_ganancia"],
                )

            lot_info = {}
            for row in rows:
                product_id = product_map[str(row["codigo"]).strip()].id
                numero_lote = str(row.get("lote") or "IMPORTADO").strip()
                key = (product_id, numero_lote)
                if key not in lot_info:
                    raw_fv = row.get("fecha_vencimiento")
                    if pd.isna(raw_fv) or str(raw_fv).strip().lower() in {"", "nan", "nat", "none"}:
                        fv = None
                    else:
                        parsed_fv = pd.to_datetime(raw_fv, errors="coerce")
                        fv = None if pd.isna(parsed_fv) else parsed_fv.date()
                    lot_info[key] = fv

            lot_keys = set(lot_info.keys())
            product_ids = [product_id for product_id, _ in lot_keys]
            lot_numbers = [numero_lote for _, numero_lote in lot_keys]

            lot_map = {
                (lote.producto_id, lote.numero_lote or "IMPORTADO"): lote
                for lote in Lote.objects.filter(
                    producto_id__in=product_ids,
                    numero_lote__in=lot_numbers,
                )
            }

            hoy = timezone.now().date()
            lotes_to_create = []
            for (product_id, numero_lote), fv in lot_info.items():
                if (product_id, numero_lote) not in lot_map:
                    fecha_cad = fv if fv else hoy + timezone.timedelta(days=365)
                    estado_lote = "vencido" if fv and fv < hoy else "activo"
                    lotes_to_create.append(
                        Lote(
                            producto_id=product_id,
                            numero_lote=numero_lote,
                            fecha_caducidad=fecha_cad,
                            estado=estado_lote,
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
                    fecha = pd.to_datetime(row["fecha"]).to_pydatetime()
                    if timezone.is_naive(fecha):
                        fecha = timezone.make_aware(fecha)
                    pc_fila = Decimal(str(row.get("precio_costo", row.get("precio", 0)) or 0))
                    pv_fila = Decimal(str(row.get("precio_venta", 0) or 0))

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
                        precio_venta = (
                            pv_fila if pv_fila > 0
                            else (pc_fila if pc_fila > 0 else Decimal(producto.valor_unitario))
                        )
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
