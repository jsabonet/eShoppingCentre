from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Review, StoreReview, SellerRating
from .serializers import ReviewSerializer, StoreReviewSerializer


class ReviewCreateView(generics.CreateAPIView):
    """POST /api/v1/reviews/ — Criar review de produto (ou devolver existente)."""
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        product_id = request.data.get('product')
        if product_id:
            existing = Review.objects.filter(user=request.user, product_id=product_id).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data)
        return super().create(request, *args, **kwargs)


class ProductReviewsView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        product_id = self.request.query_params.get('product')
        if product_id:
            return Review.objects.filter(
                product_id=product_id, is_hidden=False,
            ).order_by('-created_at')
        return Review.objects.none()


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/v1/reviews/{id}/"""
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.method in ('PATCH', 'DELETE'):
            return Review.objects.filter(user=self.request.user)
        return Review.objects.filter(is_hidden=False)


class ReviewReplyView(APIView):
    """POST /api/v1/reviews/{id}/reply/ — Seller replies to a review."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        # Must be the seller of the product's store
        if review.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        reply = request.data.get('reply', '').strip()
        if not reply:
            return Response({'detail': 'Resposta vazia.'}, status=400)

        review.seller_reply = reply
        review.seller_replied_at = timezone.now()
        review.save(update_fields=['seller_reply', 'seller_replied_at'])
        return Response(ReviewSerializer(review, context={'request': request}).data)


class ReviewReportView(APIView):
    """POST /api/v1/reviews/{id}/report/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        review.report_count += 1
        if review.report_count >= 3:
            review.is_hidden = True
        review.save(update_fields=['report_count', 'is_hidden'])
        return Response({'reported': True})


class ReviewHelpfulView(APIView):
    """POST /api/v1/reviews/{id}/helpful/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        review.helpful_count += 1
        review.save(update_fields=['helpful_count'])
        return Response({'helpful_count': review.helpful_count})


# ─── Store Reviews ───

class StoreReviewListView(generics.ListCreateAPIView):
    """GET /api/v1/stores/{slug}/reviews/ — Listar. POST — Criar (ou devolver existente)."""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    serializer_class = StoreReviewSerializer

    def get_queryset(self):
        from apps.stores.models import Store
        store = get_object_or_404(Store, slug=self.kwargs['slug'])
        return StoreReview.objects.filter(
            store=store, is_hidden=False,
        ).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        from apps.stores.models import Store
        store = get_object_or_404(Store, slug=self.kwargs['slug'])
        # Permite multiplas reviews — diferentes experiencias = diferentes reviews
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from apps.stores.models import Store
        store = get_object_or_404(Store, slug=self.kwargs['slug'])
        serializer.context['store'] = store
        serializer.save(store=store)


class StoreReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = StoreReview.objects.all()
    serializer_class = StoreReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.method in ('PATCH', 'DELETE'):
            return StoreReview.objects.filter(user=self.request.user)
        return StoreReview.objects.filter(is_hidden=False)


class StoreReviewReplyView(APIView):
    """POST /api/v1/stores/reviews/{id}/reply/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(StoreReview, id=review_id)
        if review.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)
        reply = request.data.get('reply', '').strip()
        if not reply:
            return Response({'detail': 'Resposta vazia.'}, status=400)
        review.seller_reply = reply
        review.seller_replied_at = timezone.now()
        review.save(update_fields=['seller_reply', 'seller_replied_at'])
        return Response(StoreReviewSerializer(review, context={'request': request}).data)


class SellerRatingView(APIView):
    """GET /api/v1/sellers/{id}/rating/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, user_id):
        try:
            rating = SellerRating.objects.get(user_id=user_id)
            return Response({
                'avg_communication': float(rating.avg_communication),
                'avg_shipping': float(rating.avg_shipping),
                'avg_accuracy': float(rating.avg_accuracy),
                'avg_overall': float(rating.avg_overall),
                'total_reviews': rating.total_reviews,
                'response_rate': float(rating.response_rate),
            })
        except SellerRating.DoesNotExist:
            return Response({
                'avg_communication': 0, 'avg_shipping': 0,
                'avg_accuracy': 0, 'avg_overall': 0,
                'total_reviews': 0, 'response_rate': 0,
            })

