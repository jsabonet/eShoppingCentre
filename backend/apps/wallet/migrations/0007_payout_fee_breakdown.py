from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet', '0006_alter_wallettransaction_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='payoutrequest',
            name='fee_percent',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name='payoutrequest',
            name='fee',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
