from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0014_alter_movimiento_fecha_mov"),
    ]

    operations = [
        migrations.AddField(
            model_name="alerta",
            name="decision",
            field=models.CharField(
                blank=True,
                choices=[
                    ("aprobada", "aprobada"),
                    ("rechazada", "rechazada"),
                    ("revisada", "revisada"),
                ],
                max_length=10,
                null=True,
            ),
        ),
    ]
