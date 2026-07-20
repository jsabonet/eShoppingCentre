from django.db import models
from apps.core.models import BaseModel


class AffiliateProfile(BaseModel):
    user = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='affiliate_profile')
    referral_code = models.CharField(max_length=50, unique=True)
    total_clicks = models.PositiveIntegerField(default=0)
    total_sales = models.PositiveIntegerField(default=0)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'Affiliate: {self.user.email}'


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

    def __str__(self):
        return f'{self.affiliate.user.email} - {self.amount} MZN'
