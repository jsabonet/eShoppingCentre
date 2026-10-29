from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from apps.products.models import Product
from apps.stores.featured import invalidate_featured_stores_cache
from apps.stores.models import Store, StoreFollower
from apps.notifications.models import Notification
from apps.notifications import email_service


@receiver(pre_save, sender=Store)
def remember_store_status(sender, instance, using, **kwargs):
    if instance.pk:
        instance._previous_status = (
            sender.objects.using(using)
            .filter(pk=instance.pk)
            .values_list('status', flat=True)
            .first()
        )
    else:
        instance._previous_status = None


@receiver(post_save, sender=Store)
def invalidate_featured_stores_on_save(sender, instance, created, using, **kwargs):
    if created or instance._previous_status != instance.status:
        invalidate_featured_stores_cache(using=using)
    if hasattr(instance, '_previous_status'):
        del instance._previous_status


@receiver(post_delete, sender=Store)
def invalidate_featured_stores_on_delete(sender, using, **kwargs):
    invalidate_featured_stores_cache(using=using)


@receiver(post_save, sender=Product)
def notify_followers_new_product(sender, instance, created, **kwargs):
    """Quando uma loja publica um novo produto, notifica os seguidores."""
    if not created:
        return
    if instance.status != 'active':
        return

    store = instance.store
    followers = StoreFollower.objects.filter(
        store=store,
        notify_new_products=True,
    ).select_related('user')

    notifications = []
    for follower in followers:
        notifications.append(Notification(
            user=follower.user,
            title=f'Novo produto na {store.name}',
            message=f'{store.name} publicou "{instance.name}" — {instance.price:.0f} MZN',
            notification_type='new_product',
            link=f'/product/{instance.slug}',
        ))
        if follower.user.email:
            email_service.dispatch(
                email_service.send_new_product_email,
                follower.user.email, follower.user.first_name, store.name, instance.name,
                f'{instance.price:.0f}', f'/product/{instance.slug}',
            )

    if notifications:
        Notification.objects.bulk_create(notifications)
