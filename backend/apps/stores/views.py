from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.db import IntegrityError
from django.http import Http404
from .models import Store
from .serializers import StoreSerializer, StoreDetailSerializer


class StoreListView(generics.ListAPIView):
    queryset = Store.objects.filter(status='active')
    serializer_class = StoreSerializer
    permission_classes = [permissions.AllowAny]


class StoreDetailView(generics.RetrieveAPIView):
    queryset = Store.objects.all()
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
    permission_classes = [permissions.IsAuthenticated]

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
        serializer.save(owner=self.request.user, status='pending')
