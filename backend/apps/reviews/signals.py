from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Avg, Count, Q
from django.utils import timezone
from .models import Review, StoreReview, SellerRating


@receiver(post_save, sender=Review)
@receiver(post_delete, sender=Review)
def update_product_rating(sender, instance, **kwargs):
    """Recalcula rating do produto quando uma review é criada/actualizada/removida."""
    product = instance.product
    stats = Review.objects.filter(
        product=product, is_hidden=False
    ).aggregate(
        avg=Avg('rating'),
        count=Count('id'),
    )
    product.rating = round(stats['avg'] or 0, 2)
    product.review_count = stats['count'] or 0
    product.save(update_fields=['rating', 'review_count'])


@receiver(post_save, sender=StoreReview)
@receiver(post_delete, sender=StoreReview)
def update_store_and_seller_rating(sender, instance, **kwargs):
    """Recalcula rating da loja e do vendedor."""
    store = instance.store
    stats = StoreReview.objects.filter(
        store=store, is_hidden=False
    ).aggregate(
        avg_comm=Avg('communication_rating'),
        avg_ship=Avg('shipping_rating'),
        avg_acc=Avg('accuracy_rating'),
        avg_overall=Avg('overall_rating'),
        count=Count('id'),
    )

    # Update store rating (overall average)
    store.rating = round(stats['avg_overall'] or 0, 2)
    store.save(update_fields=['rating'])

    # Update seller rating cache
    seller = store.owner
    seller_stats = StoreReview.objects.filter(
        store__owner=seller, is_hidden=False
    ).aggregate(
        avg_comm=Avg('communication_rating'),
        avg_ship=Avg('shipping_rating'),
        avg_acc=Avg('accuracy_rating'),
        avg_overall=Avg('overall_rating'),
        count=Count('id'),
    )

    # Response rate
    total = seller_stats['count'] or 0
    replied = StoreReview.objects.filter(
        store__owner=seller, is_hidden=False,
        seller_replied_at__isnull=False,
    ).count()
    response_rate = (replied / total * 100) if total > 0 else 0

    seller_rating, _ = SellerRating.objects.get_or_create(user=seller)
    seller_rating.avg_communication = round(seller_stats['avg_comm'] or 0, 2)
    seller_rating.avg_shipping = round(seller_stats['avg_ship'] or 0, 2)
    seller_rating.avg_accuracy = round(seller_stats['avg_acc'] or 0, 2)
    seller_rating.avg_overall = round(seller_stats['avg_overall'] or 0, 2)
    seller_rating.total_reviews = seller_stats['count'] or 0
    seller_rating.response_rate = round(response_rate, 2)
    seller_rating.save()
