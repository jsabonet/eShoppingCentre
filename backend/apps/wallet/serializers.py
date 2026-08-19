from rest_framework import serializers
from .models import Wallet, WalletTransaction, PayoutRequest


class WalletSerializer(serializers.ModelSerializer):
    available_payout = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = ('id', 'balance', 'payout_balance', 'reserved_balance', 'available_payout',
                  'total_spent', 'total_earned', 'total_withdrawn', 'is_active')

    def get_available_payout(self, obj):
        return obj.payout_balance - obj.reserved_balance

    def get_total_spent(self, obj):
        from django.db.models import Sum
        from apps.orders.models import Order
        return Order.objects.filter(buyer=obj.user, payment_status='completed').aggregate(s=Sum('total'))['s'] or 0


class PayoutRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PayoutRequest
        fields = ('id', 'user', 'user_email', 'user_name', 'role', 'amount', 'method',
                  'method_display', 'account_details', 'status', 'status_display',
                  'admin_reference', 'approved_at', 'paid_at', 'rejection_reason', 'notes', 'created_at')
        read_only_fields = ('status', 'approved_by', 'paid_by', 'approved_at', 'paid_at',
                            'admin_reference', 'rejection_reason')

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ('id', 'type', 'amount', 'balance_before', 'balance_after',
                  'reference_type', 'reference_id', 'description', 'status', 'created_at')
