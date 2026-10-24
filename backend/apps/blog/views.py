import uuid

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from django.db import transaction
from django.db.models import Q
from .models import BlogComment, BlogLike, BlogPost, NewsletterSubscription
from .serializers import (
    BlogCommentSerializer,
    BlogPostDetailSerializer,
    BlogPostListSerializer,
    NewsletterSubscriptionSerializer,
)


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


class BlogCommentListCreateView(generics.ListCreateAPIView):
    """GET /blog/<slug>/comments/ — aprovados. POST — criar (autenticado)."""
    serializer_class = BlogCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        post = get_object_or_404(BlogPost, slug=self.kwargs['slug'], is_published=True)
        return post.comments.filter(status=BlogComment.Status.APPROVED).order_by('-created_at')

    def perform_create(self, serializer):
        post = get_object_or_404(BlogPost, slug=self.kwargs['slug'], is_published=True)
        serializer.save(post=post)


class BlogLikeToggleView(APIView):
    """POST /blog/<slug>/like/ — alterna o gosto do utilizador autenticado."""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get(self, request, slug):
        post = get_object_or_404(BlogPost, slug=slug, is_published=True)
        user = request.user
        liked = bool(user.is_authenticated and post.likes.filter(user=user).exists())
        return Response({'liked': liked, 'likes_count': post.likes.count()})

    def post(self, request, slug):
        with transaction.atomic():
            post = get_object_or_404(
                BlogPost.objects.select_for_update(),
                slug=slug,
                is_published=True,
            )
            like = BlogLike.objects.filter(post=post, user=request.user).first()
            if like:
                like.delete()
                liked = False
            else:
                BlogLike.objects.create(post=post, user=request.user)
                liked = True
        return Response(
            {'liked': liked, 'likes_count': post.likes.count()},
            status=status.HTTP_200_OK,
        )


class NewsletterSubscribeView(generics.CreateAPIView):
    """POST /newsletter/subscribe/ — regista o email na newsletter (público)."""
    serializer_class = NewsletterSubscriptionSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'newsletter'

    def create(self, request, *args, **kwargs):
        raw_email = request.data.get('email')
        email = raw_email.strip().lower() if isinstance(raw_email, str) else ''
        if request.data.get('consent') is not True:
            return Response(
                {'consent': ['O consentimento é necessário para subscrever a newsletter.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not email:
            return Response(
                {'email': ['Indique um email válido.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data={'email': email})
        serializer.is_valid(raise_exception=True)
        source = request.data.get('source') or ''
        source = source[:40] if isinstance(source, str) else ''
        subscription, created = NewsletterSubscription.objects.get_or_create(
            email=email,
            defaults={
                'source': source,
                'consented_at': timezone.now(),
            },
        )
        should_send_email = created or not subscription.is_active
        if not created and not subscription.is_active:
            subscription.is_active = True
            subscription.consented_at = timezone.now()
            subscription.unsubscribe_token = uuid.uuid4()
            subscription.save(update_fields=[
                'is_active', 'consented_at', 'unsubscribe_token', 'updated_at'
            ])
        if should_send_email:
            from apps.notifications import email_service
            email_service.dispatch(email_service.send_newsletter_subscription_email, str(subscription.id))
        return Response(
            {'detail': 'Subscrição confirmada. Obrigado!'},
            status=status.HTTP_200_OK,
        )


class NewsletterUnsubscribeView(APIView):
    """POST /newsletter/unsubscribe/ — remove o email da newsletter (público)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_token = request.data.get('token')
        token = raw_token.strip() if isinstance(raw_token, str) else ''
        try:
            token = str(uuid.UUID(token))
        except (ValueError, AttributeError):
            token = ''
        if token:
            NewsletterSubscription.objects.filter(
                unsubscribe_token=token,
                is_active=True,
            ).update(is_active=False)
        return Response({'detail': 'Subscrição removida.'})
