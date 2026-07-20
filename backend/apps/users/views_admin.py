from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from apps.users.models import User
from apps.stores.models import Store
from apps.orders.models import Order
from apps.wallet.models import WalletTransaction, Wallet
from apps.affiliates.models import AffiliateProfile


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        total_revenue = WalletTransaction.objects.filter(
            type='fee', status='completed'
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'total_users': User.objects.count(),
            'total_stores': Store.objects.count(),
            'total_orders': Order.objects.count(),
            'total_revenue': float(total_revenue),
            'pending_stores': Store.objects.filter(status='pending').count(),
            'pending_payouts': 0,
        })


class PendingStoresView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from apps.stores.serializers import StoreSerializer
        stores = Store.objects.filter(status='pending')
        return Response(StoreSerializer(stores, many=True).data)


class ApproveStoreView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            store = Store.objects.get(id=pk, status='pending')
            store.status = 'active'
            store.save()
            return Response({'status': 'active'})
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)


class PendingPayoutsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        payouts = []
        return Response(payouts)


class ApprovePayoutView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        return Response({'status': 'approved'})
