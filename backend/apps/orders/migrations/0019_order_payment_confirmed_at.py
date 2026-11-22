from django.db import migrations, models


def backfill_payment_confirmation_time(apps, schema_editor):
    from django.db.models import F

    Order = apps.get_model('orders', 'Order')
    Order.objects.filter(
        payment_status='completed',
        payment_confirmed_at__isnull=True,
    ).update(payment_confirmed_at=F('created_at'))


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0018_order_reserved_until'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_confirmed_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Data em que o pagamento da encomenda foi confirmado.',
                null=True,
            ),
        ),
        migrations.RunPython(backfill_payment_confirmation_time, noop),
    ]
