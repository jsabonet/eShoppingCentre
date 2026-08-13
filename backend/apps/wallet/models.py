from django.db import models
from apps.core.models import BaseModel


class Wallet(BaseModel):
    user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text='Saldo comprável (buyer)')
    payout_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text='Saldo virtual disponível para saque (vendedor/afiliado)')
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


class WalletEntry(BaseModel):
    """Linha do ledger (double-entry) — registo imutável de cada movimento de saldo."""
    DIRECTION_CHOICES = [
        ('debit', 'Débito'),
        ('credit', 'Crédito'),
    ]
    KIND_CHOICES = [
        ('buyer', 'Saldo comprável'),
        ('payout', 'Saldo para saque'),
        ('platform', 'Plataforma'),
    ]

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='entries')
    transaction = models.ForeignKey(WalletTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='entries')
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='buyer')

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['wallet', '-created_at'])]

    def __str__(self):
        return f'{self.direction} {self.amount} MZN ({self.kind})'


class EscrowHolding(BaseModel):
    """Retenção virtual (escrow) do valor de uma encomenda física até entrega + janela de devolução."""
    STATUS_CHOICES = [
        ('held', 'Retido'),
        ('released', 'Libertado'),
        ('reversed', 'Revertido'),
    ]

    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='escrow')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='held')
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Escrow {self.order.order_number} — {self.amount} MZN ({self.status})'
