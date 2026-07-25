from rest_framework import generics, permissions
from .models import Category
from .serializers import CategorySerializer


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    """Admin: listar e criar categorias"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAdminUser]


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ver, editar e eliminar categoria"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'
