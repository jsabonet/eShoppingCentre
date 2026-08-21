from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order


@receiver(post_save, sender=Order)
def deliver_digital_products(sender, instance, **kwargs):
    """Quando pagamento é confirmado, liberta downloads digitais"""
    if instance.payment_status != 'completed':
        return
    for item in instance.items.filter(product__product_type='digital'):
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
    for item in instance.items.filter(product__product_type='course'):
        if hasattr(item.product, 'course'):
            from apps.courses.models import Enrollment
            Enrollment.objects.get_or_create(
                user=instance.buyer,
                course=item.product.course,
                order=instance,
            )


@receiver(post_save, sender=Order)
def auto_complete_digital_orders(sender, instance, **kwargs):
    """Pedidos sem produtos físicos são concluídos automaticamente após pagamento confirmado."""
    if instance.payment_status != 'completed' or instance.status == 'delivered':
        return
    if not instance.has_physical_items:
        from django.utils import timezone
        now = timezone.now()
        instance.status = 'delivered'
        instance.confirmed_at = instance.confirmed_at or now
        instance.delivered_at = instance.delivered_at or now
        instance.save(update_fields=['status', 'confirmed_at', 'delivered_at'])
