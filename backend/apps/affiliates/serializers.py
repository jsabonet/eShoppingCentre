from rest_framework import serializers
from .models import AffiliateProfile, AffiliateLink, AffiliateCommission, AffiliateSettings, AffiliatePayout, AffiliateKYC


class AffiliateProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    available_commission = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = AffiliateProfile
        fields = ('id', 'user_email', 'user_name', 'referral_code', 'total_clicks',
                  'total_sales', 'total_commission', 'total_withdrawn', 'available_commission',
                  'is_active', 'status', 'commission_tier')
        read_only_fields = ('total_clicks', 'total_sales', 'total_commission', 'total_withdrawn',
                           'is_active', 'referral_code', 'commission_tier')

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email


class AffiliateLinkSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    short_url = serializers.SerializerMethodField()

    class Meta:
        model = AffiliateLink
        fields = ('id', 'product', 'product_name', 'code', 'clicks',
                  'conversions', 'short_url')
        read_only_fields = ('code', 'clicks', 'conversions')

    def get_short_url(self, obj):
        from django.conf import settings
        return f'{settings.BACKEND_URL}/r/{obj.code}/'


class AffiliateCommissionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    affiliate_email = serializers.CharField(source='affiliate.user.email', read_only=True)

    class Meta:
        model = AffiliateCommission
        fields = ('id', 'product_name', 'order_number', 'affiliate_email', 'amount',
                  'commission_rate', 'status', 'rejection_reason', 'created_at')
        read_only_fields = ('amount', 'commission_rate', 'status', 'rejection_reason')


class AffiliateSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AffiliateSettings
        fields = ('id', 'cookie_window_days', 'default_commission_rate',
                  'min_payout_amount', 'approve_after_days', 'clawback_days', 'payout_fee_percent',
                  'affiliate_program_active', 'min_commission_rate', 'max_commission_rate', 'terms_of_service')


class AffiliatePayoutSerializer(serializers.ModelSerializer):
    affiliate_email = serializers.CharField(source='affiliate.user.email', read_only=True)

    class Meta:
        model = AffiliatePayout
        fields = ('id', 'affiliate', 'affiliate_email', 'amount', 'method',
                  'account_details', 'status', 'notes', 'created_at', 'paid_at')
        read_only_fields = ('affiliate', 'status', 'created_at', 'paid_at')


class AffiliateKYCSerializer(serializers.ModelSerializer):
    affiliate_email = serializers.CharField(source='affiliate.user.email', read_only=True)
    affiliate_name = serializers.SerializerMethodField()

    class Meta:
        model = AffiliateKYC
        fields = ('id', 'affiliate', 'affiliate_email', 'affiliate_name', 'document_type',
                  'document_number', 'nuit', 'payout_phone', 'bank_name', 'bank_account',
                  'status', 'review_notes', 'created_at')
        read_only_fields = ('affiliate', 'status', 'review_notes', 'created_at')

    def get_affiliate_name(self, obj):
        return obj.affiliate.user.get_full_name() or obj.affiliate.user.email
