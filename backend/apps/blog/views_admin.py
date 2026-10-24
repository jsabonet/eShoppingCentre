from django.db.models import Count, Q
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import BlogCategory, BlogComment, BlogPost, NewsletterCampaign, NewsletterSubscription
from .newsletter import queue_blog_post_newsletter
from .serializers import (
    BlogCategorySerializer,
    BlogCommentAdminSerializer,
    BlogCommentBulkSerializer,
    BlogInlineImageSerializer,
    BlogPostDetailSerializer,
    NewsletterSubscriptionSerializer,
)


class AdminBlogCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = BlogCategorySerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = BlogCategory.objects.annotate(post_count=Count('posts'))


class AdminBlogCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BlogCategorySerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = BlogCategory.objects.annotate(post_count=Count('posts'))
    lookup_field = 'pk'

    def perform_destroy(self, instance):
        if instance.posts.exists():
            raise ValidationError({'detail': 'Não é possível eliminar uma categoria que está associada a artigos.'})
        try:
            instance.delete()
        except ProtectedError as error:
            raise ValidationError({
                'detail': 'Não é possível eliminar uma categoria que está associada a artigos.'
            }) from error


class AdminBlogListCreateView(generics.ListCreateAPIView):
    """Admin: listar e criar posts do blog"""
    queryset = BlogPost.objects.select_related('blog_category')
    serializer_class = BlogPostDetailSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_create(self, serializer):
        post = serializer.save()
        if post.is_published:
            queue_blog_post_newsletter(
                post,
                self.request.user,
                trigger='publication',
            )


class AdminBlogDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ver, editar e eliminar post"""
    queryset = BlogPost.objects.select_related('blog_category')
    serializer_class = BlogPostDetailSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'

    def perform_update(self, serializer):
        was_published = serializer.instance.is_published
        post = serializer.save()
        if post.is_published and not was_published:
            queue_blog_post_newsletter(
                post,
                self.request.user,
                trigger='publication',
            )


class AdminBlogNewsletterSendView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        post = get_object_or_404(BlogPost, pk=pk, is_published=True)
        campaign, _ = queue_blog_post_newsletter(
            post,
            request.user,
            trigger='manual',
        )
        campaign.refresh_from_db()
        if not campaign.recipient_count:
            detail = 'Não existem subscritores ativos para notificar.'
        elif campaign.status == NewsletterCampaign.Status.QUEUED:
            detail = f'Campanha colocada na fila para {campaign.recipient_count} subscritor(es).'
        elif campaign.status == NewsletterCampaign.Status.SENDING:
            detail = 'O envio da newsletter está em curso.'
        elif campaign.status == NewsletterCampaign.Status.PARTIAL:
            detail = (
                f'Envio concluído: {campaign.sent_count} enviado(s), '
                f'{campaign.failed_count} falhou/falharam.'
            )
        elif campaign.status == NewsletterCampaign.Status.FAILED:
            detail = 'O envio falhou. Verifique a configuração do email e tente novamente.'
        else:
            detail = f'{campaign.sent_count} email(s) enviado(s) com sucesso.'
        return Response(
            {
                'campaign_id': str(campaign.id),
                'status': campaign.status,
                'recipient_count': campaign.recipient_count,
                'sent_count': campaign.sent_count,
                'failed_count': campaign.failed_count,
                'detail': detail,
            },
            status=(
                status.HTTP_202_ACCEPTED
                if campaign.status in {
                    NewsletterCampaign.Status.QUEUED,
                    NewsletterCampaign.Status.SENDING,
                }
                else status.HTTP_200_OK
            ),
        )


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
