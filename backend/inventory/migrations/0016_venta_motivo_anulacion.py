from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0015_alerta_decision"),
    ]

    operations = [
        migrations.AddField(
            model_name="venta",
            name="motivo_anulacion",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
