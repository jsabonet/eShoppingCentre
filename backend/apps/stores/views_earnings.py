from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum


class StoreStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        store = request.user.store
        orders = store.orders.all()
        return Response({
            'total_products': store.products.filter(status='active').count(),
            'total_orders': orders.count(),
            'total_revenue': float(orders.filter(payment_status='completed').aggregate(
                total=Sum('total'))['total'] or 0),
            'pending_orders': orders.filter(status='pending').count(),
        })


class StoreEarningsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.wallet.serializers import WalletTransactionSerializer
        wallet = request.user.wallet
        transactions = wallet.transactions.filter(type='sale').order_by('-created_at')[:50]
        serializer = WalletTransactionSerializer(transactions, many=True)
        return Response({'transactions': serializer.data})
