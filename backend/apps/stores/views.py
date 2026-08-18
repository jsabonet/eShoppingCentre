from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.db import IntegrityError
from django.http import Http404
from .models import Store
from .serializers import StoreSerializer, StoreDetailSerializer
from apps.users.permissions import IsVerified


class StoreListView(generics.ListAPIView):
    queryset = Store.objects.filter(status='active').order_by('-created_at')
    serializer_class = StoreSerializer
    permission_classes = [permissions.AllowAny]


class StoreDetailView(generics.RetrieveAPIView):
    # Public: apenas lojas activas. Owner vê a sua via MyStoreView.
    queryset = Store.objects.filter(status='active')
    serializer_class = StoreDetailSerializer
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]


class MyStoreView(generics.RetrieveUpdateAPIView):
    serializer_class = StoreDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if not hasattr(self.request.user, 'store'):
            raise Http404('Nenhuma loja encontrada para este utilizador.')
        return self.request.user.store


class StoreRegisterView(generics.CreateAPIView):
    serializer_class = StoreDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def create(self, request, *args, **kwargs):
        # Check if user already has a store
        if hasattr(request.user, 'store'):
            store = request.user.store
            return Response({
                'detail': 'Já tem uma loja registada.',
                'store_id': str(store.id),
                'store_name': store.name,
                'store_status': store.status,
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response({
                'detail': 'Já tem uma loja registada neste marketplace. Cada vendedor pode ter apenas uma loja.',
            }, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        product_type = self.request.data.get('product_type', 'physical')
        # Smart defaults based on product type
        defaults = {}
        if product_type == 'physical':
            defaults['default_affiliate_commission'] = 10.00
            defaults['low_stock_threshold'] = 5
        elif product_type == 'digital':
            defaults['default_affiliate_commission'] = 15.00
            defaults['low_stock_threshold'] = 0  # Not applicable
        elif product_type == 'course':
            defaults['default_affiliate_commission'] = 20.00
            defaults['low_stock_threshold'] = 0  # Not applicable

        # Only apply defaults if not explicitly provided
        for k, v in defaults.items():
            if k not in self.request.data:
                setattr(serializer, k, v)  # fallback — will be overridden by validated_data

        store = serializer.save(owner=self.request.user, status='pending',
                                **{k: v for k, v in defaults.items() if k not in serializer.validated_data})

        # ── Sincronizar telefone do vendedor com o da loja ──
        # O formulário de registo captura um telefone que serve para ambos.
        user = self.request.user
        updated = False
        phone = self.request.data.get('phone', '')
        if phone and not user.phone:
            user.phone = phone
            updated = True
        email = self.request.data.get('email', '')
        if email and not user.email:
            user.email = email
            updated = True
        if updated:
            user.save(update_fields=['phone', 'email'])
