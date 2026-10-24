from rest_framework import generics, permissions
from django.db.models import Q
from .models import BlogPost
from .serializers import BlogPostListSerializer, BlogPostDetailSerializer


class BlogPostListView(generics.ListAPIView):
    serializer_class = BlogPostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = BlogPost.objects.filter(is_published=True).order_by('-published_at', '-created_at')
        category = self.request.query_params.get('category', '').strip()
        search = self.request.query_params.get('search', '').strip()
        if category:
            queryset = queryset.filter(category__iexact=category)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(excerpt__icontains=search)
                | Q(content__icontains=search)
                | Q(category__icontains=search)
            )
        return queryset


class BlogPostDetailView(generics.RetrieveAPIView):
    queryset = BlogPost.objects.filter(is_published=True)
    serializer_class = BlogPostDetailSerializer
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]
