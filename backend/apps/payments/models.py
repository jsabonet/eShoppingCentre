from django.db import models
from apps.core.models import BaseModel


class PaymentTransaction(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('processing', 'Em Processamento'),
        ('completed', 'Concluída'),
        ('failed', 'Falhou'),
        ('refunded', 'Reembolsada'),
    ]
    PROVIDER_CHOICES = [
        ('mpesa', 'M-Pesa'),
        ('emola', 'e-Mola'),
        ('stripe', 'Stripe'),
        ('paypal', 'PayPal'),
    ]

    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='transactions')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_transaction_id = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='MZN')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    provider_response = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.provider} - {self.order.order_number} - {self.status}'
