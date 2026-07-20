from rest_framework import generics, permissions
from .models import Store
from .serializers import StoreSerializer, StoreDetailSerializer


class StoreListView(generics.ListAPIView):
    queryset = Store.objects.filter(status='active')
    serializer_class = StoreSerializer
    permission_classes = [permissions.AllowAny]


class StoreDetailView(generics.RetrieveAPIView):
    queryset = Store.objects.filter(status='active')
    serializer_class = StoreDetailSerializer
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]


class MyStoreView(generics.RetrieveUpdateAPIView):
    serializer_class = StoreDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.store


class StoreRegisterView(generics.CreateAPIView):
    serializer_class = StoreDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, status='pending')
