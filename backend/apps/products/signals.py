from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Product, ProductVariant, StockLog
from apps.notifications.models import Notification


def check_low_stock(store, product, variant_name=None, stock=None):
    """Create a low-stock notification if stock is at or below the store threshold."""
    threshold = store.low_stock_threshold
    current_stock = stock if stock is not None else product.stock
    if current_stock <= threshold:
        label = f'{product.name}'
        if variant_name:
            label += f' ({variant_name})'
        link = f'/seller/products/{product.id}/edit'

        # Avoid duplicate notifications for the same product today
        already = Notification.objects.filter(
            user=store.owner,
            notification_type='low_stock',
            link=link,
            created_at__date=product.created_at.today() if hasattr(product.created_at, 'today') else None,
        ).exists()
        if not already:
            # Simple duplicate check: don't notify again if one already exists for this product
            existing = Notification.objects.filter(
                user=store.owner,
                notification_type='low_stock',
                link=link,
            ).exists()
            if not existing:
                Notification.objects.create(
                    user=store.owner,
                    title='⚠️ Stock Baixo',
                    message=f'{label} está com apenas {current_stock} unidade(s) em stock. Reponha o stock para evitar perder vendas.',
                    notification_type='low_stock',
                    link=link,
                )


@receiver(post_save, sender=Product)
def product_low_stock_alert(sender, instance, created, **kwargs):
    if instance.product_type == 'physical':
        check_low_stock(instance.store, instance)


@receiver(post_save, sender=ProductVariant)
def variant_low_stock_alert(sender, instance, created, **kwargs):
    check_low_stock(instance.product.store, instance.product, variant_name=instance.name, stock=instance.stock)


# ─── Stock Log Signals ───

_stock_before: dict = {}


@receiver(pre_save, sender=Product)
def capture_old_stock(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = Product.objects.get(pk=instance.pk)
            _stock_before[instance.pk] = old.stock
        except Product.DoesNotExist:
            pass


@receiver(post_save, sender=Product)
def log_stock_adjustment(sender, instance, created, **kwargs):
    """Log quando stock alterado manualmente (painel do vendedor)."""
    if created:
        return
    old_stock = _stock_before.pop(instance.pk, None)
    if old_stock is not None and old_stock != instance.stock:
        diff = instance.stock - old_stock
        if diff != 0:
            StockLog.objects.create(
                product=instance,
                change_type='adjustment',
                quantity=diff,
                stock_before=old_stock,
                stock_after=instance.stock,
                reference='Ajuste manual',
                notes=f'Stock alterado de {old_stock} para {instance.stock}',
            )
