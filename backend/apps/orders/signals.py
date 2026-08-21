from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order


@receiver(post_save, sender=Order)
def deliver_digital_products(sender, instance, **kwargs):
    """Quando pagamento é confirmado, liberta downloads digitais"""
    if instance.payment_status != 'completed':
        return
    for item in instance.items.filter(product_type='digital'):
        if item.product_id is None:
            continue
        from apps.products.models import DigitalDownload
        DigitalDownload.objects.get_or_create(
            user=instance.buyer,
            product=item.product,
            order=instance,
        )


@receiver(post_save, sender=Order)
def enroll_in_courses(sender, instance, **kwargs):
    """Quando pagamento é confirmado, matricula em cursos"""
    if instance.payment_status != 'completed':
        return
    for item in instance.items.filter(product_type='course'):
        if item.product_id is None or not hasattr(item.product, 'course'):
            continue
        from apps.courses.models import Enrollment
        Enrollment.objects.get_or_create(
            user=instance.buyer,
            course=item.product.course,
            order=instance,
        )


@receiver(post_save, sender=Order)
def auto_complete_digital_orders(sender, instance, **kwargs):
    """Pedidos 100% digitais/cursos (com itens) são concluídos automaticamente após pagamento."""
    if instance.payment_status != 'completed' or instance.status == 'delivered':
        return
    if instance.is_digital_only:
        from django.utils import timezone
        now = timezone.now()
        instance.status = 'delivered'
        instance.confirmed_at = instance.confirmed_at or now
        instance.delivered_at = instance.delivered_at or now
        instance.save(update_fields=['status', 'confirmed_at', 'delivered_at'])
