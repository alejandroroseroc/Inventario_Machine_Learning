# Generated data migration: Assign orphan "Sin Lote" movements to oldest lote (FEFO retroactiva)
# Then make Movimiento.lote non-nullable.

from django.db import migrations, models
import django.db.models.deletion


def assign_orphan_movimientos(apps, schema_editor):
    """
    Migración FEFO retroactiva:
    Para cada Movimiento que tenga lote=NULL, le asigna el lote más antiguo
    (por fecha_caducidad) del producto correspondiente.
    Si el producto no tiene ningún lote, crea uno genérico para no perder datos.
    """
    Movimiento = apps.get_model("inventory", "Movimiento")
    Lote = apps.get_model("inventory", "Lote")
    from datetime import date, timedelta

    orphans = Movimiento.objects.filter(lote__isnull=True)
    productos_vistos = {}

    for mov in orphans.iterator():
        pid = mov.producto_id

        if pid not in productos_vistos:
            # Buscar el lote más antiguo (FEFO) del producto
            lote = (
                Lote.objects
                .filter(producto_id=pid)
                .order_by("fecha_caducidad", "id")
                .first()
            )
            if not lote:
                # Crear un lote genérico para no perder integridad
                lote = Lote.objects.create(
                    producto_id=pid,
                    stock_lote=0,
                    fecha_caducidad=date.today() + timedelta(days=730),  # 2 años
                    numero_lote="MIGRADO-AUTO",
                )
            productos_vistos[pid] = lote

        mov.lote = productos_vistos[pid]
        mov.save(update_fields=["lote_id"])


def noop(apps, schema_editor):
    """Reverse: no-op (no se puede desasignar lotes sin romper la constraint)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0011_producto_usuario_alter_producto_codigo_and_more"),
    ]

    operations = [
        # Step 1: Assign all orphan movimientos to their product's oldest lote
        migrations.RunPython(assign_orphan_movimientos, noop),

        # Step 2: Make lote non-nullable
        migrations.AlterField(
            model_name="movimiento",
            name="lote",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                to="inventory.lote",
            ),
        ),
    ]
