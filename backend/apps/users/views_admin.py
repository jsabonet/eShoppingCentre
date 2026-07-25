from rest_framework import permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from django.contrib.auth import get_user_model
from apps.users.models import User
from apps.stores.models import Store
from apps.orders.models import Order
from apps.wallet.models import WalletTransaction, Wallet
from apps.affiliates.models import AffiliateProfile
from .serializers import UserProfileSerializer

UserModel = get_user_model()


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        total_revenue = WalletTransaction.objects.filter(
            type='fee', status='completed'
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'total_users': UserModel.objects.count(),
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


class AdminAllStoresView(generics.ListAPIView):
    """Admin: listar TODAS as lojas (qualquer status)"""
    queryset = Store.objects.all().order_by('-created_at')
    serializer_class = None
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        from apps.stores.serializers import StoreDetailSerializer
        return StoreDetailSerializer


class AdminStoreManageView(APIView):
    """Admin: gerir loja (aprovar, rejeitar, suspender, reactivar, actualizar)"""
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        action = request.data.get('action', '')

        try:
            store = Store.objects.get(id=pk)
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)

        if action:
            valid_actions = {
                'approve': 'active', 'reject': 'rejected',
                'suspend': 'suspended', 'reactivate': 'active', 'close': 'closed',
            }
            if action not in valid_actions:
                return Response({'detail': f'Acção inválida. Use: {", ".join(valid_actions.keys())}'}, status=400)
            store.status = valid_actions[action]
            store.save()
            return Response({'status': store.status, 'name': store.name})

        # Update store fields
        editable = ['name', 'description', 'category', 'location', 'phone', 'email', 'shipping_policy', 'return_policy']
        for field in editable:
            if field in request.data:
                setattr(store, field, request.data[field])
        store.save()
        from apps.stores.serializers import StoreDetailSerializer
        return Response(StoreDetailSerializer(store).data)


class AdminAllOrdersView(generics.ListAPIView):
    """Admin: listar TODOS os pedidos de todas as lojas"""
    from apps.orders.serializers import OrderSerializer
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminUserListView(generics.ListAPIView):
    """Admin: listar todos os utilizadores"""
    queryset = UserModel.objects.all().order_by('-date_joined')
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Admin: ver e editar utilizador (roles, status)"""
    queryset = UserModel.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'
