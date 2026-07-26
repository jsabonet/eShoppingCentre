from django.db import models
from apps.core.models import BaseModel
import uuid


class Order(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmada'),
        ('processing', 'Em Processamento'),
        ('shipped', 'Enviada'),
        ('delivered', 'Entregue'),
        ('cancelled', 'Cancelada'),
        ('refunded', 'Reembolsada'),
    ]

    buyer = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='orders')
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    affiliate = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='affiliate_orders')
    affiliate_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=50)
    payment_status = models.CharField(max_length=20, default='pending')
    payment_id = models.CharField(max_length=255, blank=True)
    shipping_address = models.JSONField()
    shipping_method = models.CharField(max_length=100, blank=True)
    tracking_code = models.CharField(max_length=100, blank=True)
    estimated_delivery = models.DateField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    buyer_notes = models.TextField(blank=True)
    seller_notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['buyer', 'status']),
            models.Index(fields=['store', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f'PED-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, related_name='order_items')
    product_name = models.CharField(max_length=500)
    product_image = models.URLField(blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    variation_data = models.JSONField(default=dict)

    def __str__(self):
        return f'{self.product_name} x{self.quantity}'


class ReturnRequest(BaseModel):
    STATUS_CHOICES = [
        ('requested', 'Solicitada'),
        ('approved', 'Aprovada'),
        ('rejected', 'Rejeitada'),
        ('shipped', 'Devolução Enviada'),
        ('received', 'Recebida'),
        ('refunded', 'Reembolsada'),
    ]
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='returns')
    buyer = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='returns')
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='returns')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    vendor_notes = models.TextField(blank=True)
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Return #{self.id} - {self.order.order_number}'
