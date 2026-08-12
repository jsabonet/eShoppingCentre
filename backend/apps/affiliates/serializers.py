from rest_framework import serializers
from .models import AffiliateProfile, AffiliateLink, AffiliateCommission


class AffiliateProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = AffiliateProfile
        fields = ('id', 'user_email', 'referral_code', 'total_clicks',
                  'total_sales', 'total_commission', 'is_active', 'commission_tier')
        read_only_fields = ('total_clicks', 'total_sales', 'total_commission',
                           'is_active', 'referral_code', 'commission_tier')


class AffiliateLinkSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    short_url = serializers.SerializerMethodField()

    class Meta:
        model = AffiliateLink
        fields = ('id', 'product', 'product_name', 'code', 'clicks',
                  'conversions', 'short_url')
        read_only_fields = ('code', 'clicks', 'conversions')

    def get_short_url(self, obj):
        return f'https://eshoppingcentre.co.mz/?ref={obj.code}'


class AffiliateCommissionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = AffiliateCommission
        fields = ('id', 'product_name', 'order_number', 'amount',
                  'commission_rate', 'status', 'rejection_reason', 'created_at')
        read_only_fields = ('amount', 'commission_rate', 'status', 'rejection_reason')
