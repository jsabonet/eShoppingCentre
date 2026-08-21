from django.db import migrations
from django.utils import timezone


def backfill_product_type(apps, schema_editor):
    """Preenche `product_type` dos itens legados a partir do produto associado."""
    OrderItem = apps.get_model('orders', 'OrderItem')
    for item in OrderItem.objects.filter(product_type='').select_related('product').iterator():
        if item.product_id and item.product:
            item.product_type = item.product.product_type
            item.save(update_fields=['product_type'])


def auto_complete_legacy_digital_orders(apps, schema_editor):
    """Corrige encomendas 100% digitais/cursos pagas que ficaram presas em estados físicos."""
    Order = apps.get_model('orders', 'Order')
    OrderItem = apps.get_model('orders', 'OrderItem')

    stuck = Order.objects.filter(
        payment_status='completed',
        status__in=['confirmed', 'processing', 'shipped', 'ready_for_pickup'],
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
        ('orders', '0015_orderitem_product_type'),
    ]

    operations = [
        migrations.RunPython(backfill_product_type, noop),
        migrations.RunPython(auto_complete_legacy_digital_orders, noop),
    ]
