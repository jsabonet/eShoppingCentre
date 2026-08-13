from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from .models import Category, Product, ProductImage, ProductVariant, Coupon, WishlistItem, StockLog
from .serializers import (
    CategorySerializer, ProductListSerializer, ProductDetailSerializer,
    ProductImageSerializer, ProductVariantSerializer, SellerProductSerializer, WishlistItemSerializer,
)
from .filters import ProductFilter
from apps.stores.permissions import IsStoreOwner


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Category.objects.filter(is_active=True)
        parent = self.request.query_params.get('parent', None)
        root = self.request.query_params.get('root', None)
        product_type = self.request.query_params.get('product_type', None)

        if parent is not None:
            # Filter children of a specific parent (by slug)
            qs = qs.filter(parent__slug=parent)
        elif root == 'true':
            # Only root categories (no parent)
            qs = qs.filter(parent__isnull=True)
        elif parent == '':
            # Empty parent = all categories including children — return all
            pass

        if product_type:
            qs = qs.filter(product_type=product_type)

        return qs.select_related('parent').order_by('sort_order', 'name')


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
        return Product.objects.filter(
            status='active', store__status='active'
        ).select_related('store', 'category')

    def perform_create(self, serializer):
        store = self.request.user.store
        product = serializer.save(store=store)

        # If it's a course product, auto-create the Course object
        if product.product_type == 'course':
            from apps.courses.models import Course
            Course.objects.get_or_create(
                product=product,
                defaults={
                    'instructor': self.request.user,
                    'level': self.request.data.get('course_level', 'beginner'),
                    'duration': self.request.data.get('course_duration', ''),
                    'total_lessons': int(self.request.data.get('total_lessons', 0)),
                    'access_duration_days': self._parse_access_duration(),
                }
            )

    def _parse_access_duration(self):
        """Extrai access_duration_days do request. None = vitalício."""
        val = self.request.data.get('access_duration_days', None)
        if val is None or val == '' or val == 'null':
            return None
        try:
            num = int(val)
            return num if num > 0 else None
        except (ValueError, TypeError):
            return None


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
        qs = Product.objects.filter(
            status='active', store__status='active'
        ).select_related('store', 'category')
        for word in words:
            qs = qs.filter(
                Q(name__icontains=word) |
                Q(description__icontains=word) |
                Q(category__name__icontains=word) |
                Q(tags__icontains=word)
            )
        return qs.distinct()


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(status='active', store__status='active')
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
        qs = store.products.filter(~Q(status='deleted')).select_related('category').order_by('-created_at')
        # Allow filtering by product_type (e.g. ?product_type=course for courses page)
        product_type = self.request.query_params.get('product_type', None)
        if product_type and product_type in ('physical', 'digital', 'course'):
            qs = qs.filter(product_type=product_type)
        return qs


class ProductUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = ProductDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.store.products.all()

    def perform_update(self, serializer):
        product = serializer.save()
        if product.product_type == 'course' and hasattr(product, 'course'):
            course = product.course
            updates = {}
            if 'course_level' in self.request.data:
                updates['level'] = self.request.data['course_level']
            if 'course_duration' in self.request.data:
                updates['duration'] = self.request.data['course_duration']
            if 'total_lessons' in self.request.data:
                updates['total_lessons'] = int(self.request.data['total_lessons'])
            if 'access_duration_days' in self.request.data:
                dur = self._parse_access_duration()
                updates['access_duration_days'] = dur
            if updates:
                for k, v in updates.items():
                    setattr(course, k, v)
                course.save()


class ProductDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.store.products.all()

    def perform_destroy(self, instance):
        instance.status = 'deleted'
        instance.save()


class RestockProductView(APIView):
    """POST /api/v1/products/{pk}/restock/ — Adiciona stock a um produto."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        product = get_object_or_404(Product, pk=pk, store=request.user.store, product_type='physical')
        quantity = int(request.data.get('quantity', 0))
        if quantity <= 0:
            return Response({'detail': 'Quantidade deve ser positiva.'}, status=status.HTTP_400_BAD_REQUEST)

        old_stock = product.stock
        product.stock += quantity
        product.save(update_fields=['stock'])

        StockLog.objects.create(
            product=product, change_type='restock', quantity=quantity,
            stock_before=old_stock, stock_after=product.stock,
            reference=f'Reposição manual',
            changed_by=request.user,
            notes=request.data.get('notes', '') or f'Adicionadas {quantity} unidade(s)',
        )

        return Response(SellerProductSerializer(product, context={'request': request}).data)


class ProductImageView(generics.CreateAPIView):
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        product = Product.objects.get(id=self.kwargs['product_id'])
        serializer.save(product=product)


class ProductImageDeleteView(generics.DestroyAPIView):
    """Vendedor pode remover a imagem do seu próprio produto."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        store = self.request.user.store
        return ProductImage.objects.filter(
            product_id=self.kwargs['product_id'],
            product__store=store,
        )


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


class BulkAffiliateUpdateView(APIView):
    """POST /api/v1/products/bulk-affiliate/ — define afiliação/comissão em vários produtos de uma vez."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        store = getattr(request.user, 'store', None)
        if not store:
            return Response({'detail': 'Não tem uma loja associada.'}, status=403)

        qs = store.products.filter(~Q(status='deleted'))
        product_ids = request.data.get('product_ids')
        if product_ids:
            qs = qs.filter(id__in=product_ids)

        updates = {}
        if 'affiliate_enabled' in request.data:
            updates['affiliate_enabled'] = bool(request.data.get('affiliate_enabled'))

        if 'affiliate_commission' in request.data and request.data.get('affiliate_commission') not in (None, ''):
            from apps.affiliates.models import AffiliateSettings
            settings_obj = AffiliateSettings.get_settings()
            try:
                commission = Decimal(str(request.data.get('affiliate_commission')))
            except (ValueError, InvalidOperation, TypeError):
                return Response({'detail': 'Comissão inválida.'}, status=400)
            if commission < settings_obj.min_commission_rate or commission > settings_obj.max_commission_rate:
                return Response(
                    {'detail': f'A comissão deve estar entre {settings_obj.min_commission_rate}% e {settings_obj.max_commission_rate}%.'},
                    status=400,
                )
            updates['affiliate_commission'] = commission

        if not updates:
            return Response({'detail': 'Nada a actualizar.'}, status=400)

        count = qs.update(**updates)
        return Response({'updated': count})


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


class AdminCouponListView(generics.ListCreateAPIView):
    """Admin: lista todos os cupões e cria cupões globais (ou por loja)."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_serializer_class(self):
        from .serializers import CouponSerializer
        return CouponSerializer

    def get_queryset(self):
        return Coupon.objects.select_related('store').order_by('-created_at')

    def perform_create(self, serializer):
        store_id = self.request.data.get('store')
        store = None
        if store_id:
            from apps.stores.models import Store
            store = get_object_or_404(Store, pk=store_id)
        serializer.save(store=store)


class AdminCouponToggleView(APIView):
    """Admin: ativa/desativa um cupão de qualquer loja."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk):
        coupon = get_object_or_404(Coupon, pk=pk)
        coupon.is_active = not coupon.is_active
        coupon.save(update_fields=['is_active'])
        from .serializers import CouponSerializer
        return Response(CouponSerializer(coupon).data)
