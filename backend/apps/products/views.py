from rest_framework import generics, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from .models import Category, Product, ProductImage, ProductVariant, Coupon, WishlistItem
from .serializers import (
    CategorySerializer, ProductListSerializer, ProductDetailSerializer,
    ProductImageSerializer, ProductVariantSerializer, SellerProductSerializer, WishlistItemSerializer,
)
from .filters import ProductFilter
from apps.stores.permissions import IsStoreOwner


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class CategoryDetailView(generics.RetrieveAPIView):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]


class ProductListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ['name', 'description', 'tags']
    ordering_fields = ['price', 'created_at', 'rating', 'sales_count', 'name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ProductListSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        return Product.objects.filter(status='active').select_related('store', 'category')

    def perform_create(self, serializer):
        store = self.request.user.store
        serializer.save(store=store)


class ProductSearchView(generics.ListAPIView):
    serializer_class = ProductListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['price', 'created_at', 'rating', 'sales_count']

    def get_queryset(self):
        query = self.request.query_params.get('q', '').strip()
        if not query:
            return Product.objects.none()
        normalized = query.lower()
        words = normalized.split()
        qs = Product.objects.filter(status='active').select_related('store', 'category')
        for word in words:
            qs = qs.filter(
                Q(name__icontains=word) |
                Q(description__icontains=word) |
                Q(category__name__icontains=word) |
                Q(tags__icontains=word)
            )
        return qs.distinct()


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(status='active')
    serializer_class = ProductDetailSerializer
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]


class MyProductListView(generics.ListAPIView):
    serializer_class = SellerProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        store = getattr(self.request.user, 'store', None)
        if not store:
            return Product.objects.none()
        return store.products.filter(~Q(status='deleted')).select_related('category').order_by('-created_at')


class ProductUpdateView(generics.UpdateAPIView):
    serializer_class = ProductDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.store.products.all()


class ProductDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.store.products.all()

    def perform_destroy(self, instance):
        instance.status = 'deleted'
        instance.save()


class ProductImageView(generics.CreateAPIView):
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        product = Product.objects.get(id=self.kwargs['product_id'])
        serializer.save(product=product)


class WishlistListView(generics.ListCreateAPIView):
    serializer_class = WishlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.wishlist.all()

    def get_serializer_context(self):
        return {'request': self.request}


class WishlistDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.wishlist.all()


# ─── Variant Management ───

class ProductVariantListView(generics.ListCreateAPIView):
    """List or create variants for a product (vendor only)."""
    serializer_class = ProductVariantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        product = Product.objects.get(id=self.kwargs['product_id'])
        return product.variants.all()

    def perform_create(self, serializer):
        product = Product.objects.get(id=self.kwargs['product_id'])
        serializer.save(product=product)


class ProductVariantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single variant."""
    serializer_class = ProductVariantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProductVariant.objects.filter(
            product__store=self.request.user.store
        )


# ─── Coupon Management ───

class CouponListView(generics.ListCreateAPIView):
    serializer_class = None  # set below
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        from .serializers import CouponSerializer
        return CouponSerializer

    def get_queryset(self):
        return Coupon.objects.filter(store=self.request.user.store)

    def perform_create(self, serializer):
        serializer.save(store=self.request.user.store)


class CouponDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        from .serializers import CouponSerializer
        return CouponSerializer

    def get_queryset(self):
        return Coupon.objects.filter(store=self.request.user.store)


class ValidateCouponView(APIView):
    """Validate a coupon code (public)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get('code', '').strip().upper()
        try:
            coupon = Coupon.objects.get(code=code, is_active=True)
            if not coupon.is_valid:
                return Response({'valid': False, 'detail': 'Cupão expirado ou esgotado.'}, status=400)
            return Response({
                'valid': True,
                'code': coupon.code,
                'discount_type': coupon.discount_type,
                'discount_value': float(coupon.discount_value),
                'min_purchase': float(coupon.min_purchase),
                'discount_description': (
                    f'{coupon.discount_value}% de desconto' if coupon.discount_type == 'percentage'
                    else f'{float(coupon.discount_value):.2f} MZN de desconto'
                ),
            })
        except Coupon.DoesNotExist:
            return Response({'valid': False, 'detail': 'Cupão inválido.'}, status=404)
