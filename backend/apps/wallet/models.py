from django.db import models
from apps.core.models import BaseModel


class Wallet(BaseModel):
    user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_withdrawn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)


class WalletTransaction(BaseModel):
    TYPE_CHOICES = [
        ('sale', 'Venda'),
        ('commission', 'Comissão'),
        ('affiliate_commission', 'Comissão Afiliado'),
        ('withdrawal', 'Saque'),
        ('fee', 'Taxa Plataforma'),
        ('refund', 'Reembolso'),
        ('bonus', 'Bónus'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('completed', 'Concluída'),
        ('failed', 'Falhou'),
    ]

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference_type = models.CharField(max_length=50)
    reference_id = models.UUIDField()
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
