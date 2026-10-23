from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0005_alter_paymenttransaction_idempotency_key_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='paymenttransaction',
            name='provider',
            field=models.CharField(
                choices=[('vpay', 'VPay'), ('paysuite', 'PaySuite (legado)')],
                default='vpay',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='paymenttransaction',
            name='idempotency_key',
            field=models.CharField(
                blank=True,
                help_text='Chave de idempotência do webhook (ex: vpay:<order_id>).',
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]
