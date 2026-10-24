from rest_framework import generics, permissions
from rest_framework.parsers import FormParser, MultiPartParser
from .models import BlogPost
from .serializers import BlogInlineImageSerializer, BlogPostDetailSerializer


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


class AdminBlogImageUploadView(generics.CreateAPIView):
    """Admin: carregar imagens locais para o corpo de um artigo"""
    serializer_class = BlogInlineImageSerializer
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
