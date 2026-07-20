from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order


@receiver(post_save, sender=Order)
def deliver_digital_products(sender, instance, **kwargs):
    """Quando pagamento é confirmado, liberta downloads digitais"""
    if instance.payment_status == 'completed' and instance.status in ('confirmed', 'processing'):
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
    if instance.payment_status == 'completed':
        for item in instance.items.filter(product__product_type='course'):
            if hasattr(item.product, 'course'):
                from apps.courses.models import Enrollment
                Enrollment.objects.get_or_create(
                    user=instance.buyer,
                    course=item.product.course,
                    order=instance,
                )
