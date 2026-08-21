from django.db import migrations
from django.utils import timezone


def auto_complete_remaining_digital_orders(apps, schema_editor):
    """Conclui encomendas digitais/cursos pagas que ficaram presas em estados não finais."""
    Order = apps.get_model('orders', 'Order')
    OrderItem = apps.get_model('orders', 'OrderItem')

    stuck = Order.objects.filter(payment_status='completed').exclude(
        status__in=['delivered', 'cancelled', 'refunded']
    )
    now = timezone.now()
    for order in stuck.iterator():
        items = list(OrderItem.objects.filter(order=order))
        if not items:
            continue
        if all(i.product_type in ('digital', 'course') for i in items):
            order.status = 'delivered'
            order.confirmed_at = order.confirmed_at or now
            order.delivered_at = order.delivered_at or now
            order.save(update_fields=['status', 'confirmed_at', 'delivered_at'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0016_backfill_orderitem_product_type'),
    ]

    operations = [
        migrations.RunPython(auto_complete_remaining_digital_orders, noop),
    ]
