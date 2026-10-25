from django.db import models
from apps.core.models import BaseModel


class PaymentTransaction(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('processing', 'Em Processamento'),
        ('completed', 'Concluída'),
        ('refund_pending', 'Reembolso pendente'),
        ('failed', 'Falhou'),
        ('refunded', 'Reembolsada'),
    ]
    PROVIDER_CHOICES = [
        ('vpay', 'VPay'),
        ('paysuite', 'PaySuite (legado)'),
    ]

    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True,
        help_text='Encomenda associada (pode ser nula se o webhook não conseguir mapear a encomenda).',
    )
    orders = models.ManyToManyField(
        'orders.Order',
        related_name='payment_attempts',
        blank=True,
        help_text='Todas as encomendas incluídas nesta tentativa de checkout.',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='vpay')
    gateway_order_id = models.CharField(max_length=255, blank=True, db_index=True)
    provider_transaction_id = models.CharField(max_length=255, blank=True)
    source_id = models.CharField(max_length=255, blank=True, db_index=True)
    idempotency_key = models.CharField(
        max_length=255, unique=True, null=True, blank=True,
        help_text='Chave de idempotência do webhook (ex: vpay:<order_id>).',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='MZN')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    last_checked_at = models.DateTimeField(null=True, blank=True)
    provider_response = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_transaction_id'],
                condition=~models.Q(provider_transaction_id=''),
                name='unique_provider_transaction_id',
            ),
            models.UniqueConstraint(
                fields=['provider', 'gateway_order_id'],
                condition=~models.Q(gateway_order_id=''),
                name='unique_provider_gateway_order_id',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.provider_transaction_id:
            self.provider_transaction_id = self.provider_transaction_id.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        order_ref = self.order.order_number if self.order_id else 'sem encomenda'
        return f'{self.provider} - {order_ref} - {self.status}'
