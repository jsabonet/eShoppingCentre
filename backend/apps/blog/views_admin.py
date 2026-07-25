from rest_framework import generics, permissions
from .models import BlogPost
from .serializers import BlogPostDetailSerializer


class AdminBlogListCreateView(generics.ListCreateAPIView):
    """Admin: listar e criar posts do blog"""
    queryset = BlogPost.objects.all()
    serializer_class = BlogPostDetailSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminBlogDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ver, editar e eliminar post"""
    queryset = BlogPost.objects.all()
    serializer_class = BlogPostDetailSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'
