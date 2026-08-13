from django.db import models
from apps.core.models import BaseModel


class AffiliateProfile(BaseModel):
    TIER_CHOICES = [
        ('basic', 'Básico'),
        ('silver', 'Prata'),
        ('gold', 'Ouro'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('active', 'Activo'),
        ('suspended', 'Suspenso'),
    ]
    user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='affiliate_profile')
    referral_code = models.CharField(max_length=50, unique=True)
    total_clicks = models.PositiveIntegerField(default=0)
    total_sales = models.PositiveIntegerField(default=0)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_withdrawn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    commission_tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='basic')

    def __str__(self):
        return f'Affiliate: {self.user.email}'

    @property
    def available_commission(self):
        return self.total_commission - self.total_withdrawn


class AffiliateLink(BaseModel):
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='links')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='affiliate_links')
    code = models.CharField(max_length=50, unique=True)
    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'{self.affiliate.user.email} - {self.product.name}'


class AffiliateCommission(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('approved', 'Aprovada'),
        ('paid', 'Paga'),
        ('rejected', 'Rejeitada'),
    ]

    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='commissions')
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE)
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f'{self.affiliate.user.email} - {self.amount} MZN'


class AffiliateSettings(BaseModel):
    """Configurações globais do programa de afiliados (singleton, gerido pelo admin)."""
    cookie_window_days = models.PositiveIntegerField(default=30)
    default_commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    min_payout_amount = models.DecimalField(max_digits=12, decimal_places=2, default=500)
    approve_after_days = models.PositiveIntegerField(default=7)
    clawback_days = models.PositiveIntegerField(default=30, help_text='Dias para reverter comissões após aprovação')
    payout_fee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='Taxa da plataforma sobre cada saque (%)')

    class Meta:
        verbose_name = 'Configuração de Afiliados'
        verbose_name_plural = 'Configurações de Afiliados'

    def __str__(self):
        return 'Configurações de Afiliados'

    @classmethod
    def get_settings(cls):
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create()
        return obj


class AffiliatePayout(BaseModel):
    """Pedido de saque de comissões por um afiliado."""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('approved', 'Aprovado'),
        ('paid', 'Pago'),
        ('rejected', 'Rejeitado'),
    ]
    METHOD_CHOICES = [
        ('mpesa', 'M-Pesa'),
        ('emola', 'e-Mola'),
        ('bank', 'Transferência Bancária'),
    ]

    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='mpesa')
    account_details = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_payouts')
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Payout {self.affiliate.user.email} - {self.amount} MZN ({self.status})'


class AffiliateKYC(BaseModel):
    """Verificação de identidade (KYC) do afiliado — obrigatória antes do 1º saque."""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('approved', 'Aprovado'),
        ('rejected', 'Rejeitado'),
    ]
    DOCUMENT_CHOICES = [
        ('bi', 'Bilhete de Identidade'),
        ('passport', 'Passaporte'),
    ]

    affiliate = models.OneToOneField(AffiliateProfile, on_delete=models.CASCADE, related_name='kyc')
    document_type = models.CharField(max_length=20, choices=DOCUMENT_CHOICES, default='bi')
    document_number = models.CharField(max_length=100)
    nuit = models.CharField(max_length=50, blank=True)
    payout_phone = models.CharField(max_length=30)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_kycs')
    review_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'KYC de {self.affiliate.user.email} ({self.status})'

    @property
    def is_verified(self):
        return self.status == 'approved'
