from django.contrib import admin
from .models import AffiliateProfile, AffiliateLink, AffiliateCommission

@admin.register(AffiliateProfile)
class AffiliateProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'referral_code', 'total_clicks', 'total_sales', 'total_commission')

@admin.register(AffiliateLink)
class AffiliateLinkAdmin(admin.ModelAdmin):
    list_display = ('affiliate', 'product', 'code', 'clicks', 'conversions')

@admin.register(AffiliateCommission)
class AffiliateCommissionAdmin(admin.ModelAdmin):
    list_display = ('affiliate', 'amount', 'status', 'created_at')
    list_filter = ('status',)
