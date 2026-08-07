from django.db import models
from apps.core.models import BaseModel


class Review(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='reviews')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='reviews')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True)
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=255, blank=True)
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    helpful_count = models.PositiveIntegerField(default=0)

    # Seller reply
    seller_reply = models.TextField(blank=True)
    seller_replied_at = models.DateTimeField(null=True, blank=True)

    # Moderation
    report_count = models.PositiveIntegerField(default=0)
    is_hidden = models.BooleanField(default=False)

    class Meta:
        unique_together = [['user', 'product']]

    def __str__(self):
        return f'{self.user.email} - {self.product.name} ({self.rating}★)'


class StoreReview(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='store_reviews')
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='reviews')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True)

    # Multi-dimension ratings (1-5)
    communication_rating = models.PositiveSmallIntegerField()
    shipping_rating = models.PositiveSmallIntegerField(null=True, blank=True)  # null for digital/courses
    accuracy_rating = models.PositiveSmallIntegerField()
    overall_rating = models.PositiveSmallIntegerField()

    title = models.CharField(max_length=255, blank=True)
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    helpful_count = models.PositiveIntegerField(default=0)

    seller_reply = models.TextField(blank=True)
    seller_replied_at = models.DateTimeField(null=True, blank=True)
    report_count = models.PositiveIntegerField(default=0)
    is_hidden = models.BooleanField(default=False)

    class Meta:
        unique_together = [['user', 'store']]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} - {self.store.name} ({self.overall_rating}★)'


class SellerRating(BaseModel):
    """Cache agregado de ratings do vendedor — actualizado por signals."""
    user = models.OneToOneField(
        'users.User', on_delete=models.CASCADE, related_name='seller_rating'
    )
    avg_communication = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_shipping = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_accuracy = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_overall = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    response_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    avg_response_time_hours = models.DecimalField(max_digits=6, decimal_places=1, default=0)

    def __str__(self):
        return f'SellerRating: {self.user.email}'

