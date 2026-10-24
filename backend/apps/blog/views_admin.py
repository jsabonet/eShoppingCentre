from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import BlogComment, BlogPost, NewsletterSubscription
from .serializers import (
    BlogCommentAdminSerializer,
    BlogCommentBulkSerializer,
    BlogInlineImageSerializer,
    BlogPostDetailSerializer,
    NewsletterSubscriptionSerializer,
)


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


class AdminBlogCommentListView(generics.ListAPIView):
    """Admin: listar comentários do blog, com filtro por estado/artigo."""
    serializer_class = BlogCommentAdminSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = BlogComment.objects.select_related('post', 'author').order_by('-created_at')
        comment_status = self.request.query_params.get('status', '').strip()
        post_id = self.request.query_params.get('post', '').strip()
        search = self.request.query_params.get('search', '').strip()
        if comment_status:
            queryset = queryset.filter(status=comment_status)
        if post_id:
            queryset = queryset.filter(post_id=post_id)
        if search:
            queryset = queryset.filter(
                Q(content__icontains=search)
                | Q(author__email__icontains=search)
                | Q(author__username__icontains=search)
                | Q(author_name__icontains=search)
                | Q(post__title__icontains=search)
            )
        return queryset


class AdminBlogCommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: moderar (aprovar/rejeitar) ou eliminar um comentário."""
    queryset = BlogComment.objects.all()
    serializer_class = BlogCommentAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'


class AdminBlogCommentBulkView(APIView):
    """Admin: ação em lote sobre comentários (approve/reject/delete)."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = BlogCommentBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data['action']
        ids = serializer.validated_data['ids']
        queryset = BlogComment.objects.filter(id__in=ids)
        if action == 'delete':
            count = queryset.count()
            queryset.delete()
            return Response({'updated': count, 'action': action})
        new_status = BlogComment.Status.APPROVED if action == 'approve' else BlogComment.Status.REJECTED
        count = queryset.update(status=new_status)
        return Response({'updated': count, 'action': action})


class AdminNewsletterListView(generics.ListAPIView):
    """Admin: listar subscritores da newsletter."""
    serializer_class = NewsletterSubscriptionSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = NewsletterSubscription.objects.all().order_by('-created_at')
        only_active = self.request.query_params.get('active', '').strip()
        search = self.request.query_params.get('search', '').strip()
        if only_active == 'true':
            queryset = queryset.filter(is_active=True)
        elif only_active == 'false':
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(email__icontains=search)
        return queryset


class AdminNewsletterDetailView(generics.DestroyAPIView):
    """Admin: remover (ou desativar) um subscritor da newsletter."""
    queryset = NewsletterSubscription.objects.all()
    serializer_class = NewsletterSubscriptionSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'
