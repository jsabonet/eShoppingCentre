from rest_framework import serializers
from .models import Wallet, WalletTransaction


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ('id', 'balance', 'total_earned', 'total_withdrawn', 'is_active')


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ('id', 'type', 'amount', 'balance_before', 'balance_after',
                  'reference_type', 'reference_id', 'description', 'status', 'created_at')
