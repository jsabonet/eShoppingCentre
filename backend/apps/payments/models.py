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
        ('paysuite', 'PaySuite'),
    ]

    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True,
        help_text='Encomenda associada (pode ser nula se o webhook não conseguir mapear a encomenda).',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='paysuite')
    provider_transaction_id = models.CharField(max_length=255, blank=True)
    idempotency_key = models.CharField(
        max_length=255, unique=True, null=True, blank=True,
        help_text='Chave de idempotência do webhook (ex: paysuite:<gateway_id>).',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='MZN')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    provider_response = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        order_ref = self.order.order_number if self.order_id else 'sem encomenda'
        return f'{self.provider} - {order_ref} - {self.status}'
