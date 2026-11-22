from rest_framework import serializers
from .models import Wallet, WalletTransaction, PayoutRequest


class AdminWalletSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_types = serializers.SerializerMethodField()
    store_name = serializers.CharField(read_only=True)
    available_payout = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = (
            'id', 'user_id', 'user_name', 'user_email', 'user_types', 'store_name',
            'balance', 'payout_balance', 'reserved_balance', 'available_payout',
            'total_earned', 'total_withdrawn', 'is_active',
        )

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_user_types(self, obj):
        user = obj.user
        roles = set(user.roles if isinstance(user.roles, list) else [])
        if getattr(obj, 'user_has_store', False):
            roles.add('seller')
        if getattr(obj, 'user_has_affiliate_profile', False):
            roles.add('affiliate')
        if user.is_staff or user.is_superuser:
            roles.add('admin')
        return sorted(roles or {'buyer'})

    def get_available_payout(self, obj):
        return obj.payout_balance - obj.reserved_balance


class AdminPendingCreditSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    order_number = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    payment_confirmed_at = serializers.DateTimeField(read_only=True)
    store_name = serializers.SerializerMethodField()
    buyer_name = serializers.SerializerMethodField()
    buyer_email = serializers.EmailField(source='buyer.email', read_only=True)
    seller_name = serializers.SerializerMethodField()
    seller_email = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()
    is_physical = serializers.SerializerMethodField()
    credit_state = serializers.SerializerMethodField()
    amount_to_credit = serializers.SerializerMethodField()

    def get_store_name(self, obj):
        return obj.store.name if obj.store else obj.store_name

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def get_seller_name(self, obj):
        if not obj.store or not obj.store.owner:
            return ''
        return obj.store.owner.get_full_name() or obj.store.owner.email

    def get_seller_email(self, obj):
        return obj.store.owner.email if obj.store and obj.store.owner else ''

    def get_products(self, obj):
        return [
            {
                'name': item.product_name,
                'quantity': item.quantity,
                'product_type': item.product_type or (
                    item.product.product_type if item.product_id and item.product else ''
                ),
            }
            for item in obj.items.all()
        ]

    def get_is_physical(self, obj):
        return obj.has_physical_items

    def get_credit_state(self, obj):
        escrow = next(
            (item for item in obj.escrow.all() if item.status == 'held'),
            None,
        )
        return 'escrow_retido' if escrow else 'credito_em_falta'

    def get_amount_to_credit(self, obj):
        escrows = list(obj.escrow.all())
        escrow = next((item for item in escrows if item.status == 'held'), None)
        if not escrow:
            escrow = next((item for item in escrows if item.status == 'released'), None)
        if escrow:
            return escrow.amount
        return max(
            obj.total - (obj.platform_fee or 0) - (obj.affiliate_commission or 0),
            0,
        )

    class Meta:
        fields = (
            'id', 'order_number', 'status', 'payment_confirmed_at', 'store_name',
            'buyer_name', 'buyer_email', 'seller_name', 'seller_email', 'products',
            'is_physical', 'credit_state', 'amount_to_credit',
        )


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
        fields = ('id', 'user', 'user_email', 'user_name', 'role', 'amount',
                  'fee_percent', 'fee', 'net_amount', 'method',
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
