from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0012_fix_orphan_lotes_make_lote_required"),
    ]

    operations = [
        migrations.AlterField(
            model_name="movimiento",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("entrada", "entrada"),
                    ("salida", "salida"),
                    ("ajuste", "ajuste"),
                    ("devolucion_proveedor", "devolucion_proveedor"),
                    ("baja_vencimiento", "baja_vencimiento"),
                ],
                max_length=25,
            ),
        ),
    ]
