from django.core.cache import cache
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import generics, permissions, serializers
from .models import Category, Product, ProductImage, StockLog
from .serializers import (
    AdminStoreProductSerializer, CategorySerializer, ProductImageSerializer,
)
from apps.stores.models import Store


class AdminProductReportSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default='')

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'product_type', 'status', 'price', 'stock',
            'sales_count', 'store_name', 'category_name', 'created_at',
        )


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


class AdminProductListView(generics.ListAPIView):
    """Admin: listar produtos de qualquer estado com filtros para relatórios."""
    serializer_class = AdminProductReportSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        from django.db.models import Q
        from django.utils.dateparse import parse_date
        from rest_framework.exceptions import ValidationError

        queryset = Product.objects.select_related('store', 'category').order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        status_filter = self.request.query_params.get('status', '').strip()
        product_type = self.request.query_params.get('product_type', '').strip()
        date_from_value = self.request.query_params.get('date_from')
        date_to_value = self.request.query_params.get('date_to')

        if bool(date_from_value) != bool(date_to_value):
            raise ValidationError({'date': 'Indique as datas inicial e final.'})
        date_from = parse_date(date_from_value) if date_from_value else None
        date_to = parse_date(date_to_value) if date_to_value else None
        if date_from_value and date_from is None:
            raise ValidationError({'date_from': 'Use uma data válida no formato AAAA-MM-DD.'})
        if date_to_value and date_to is None:
            raise ValidationError({'date_to': 'Use uma data válida no formato AAAA-MM-DD.'})
        if date_from and date_to and date_from > date_to:
            raise ValidationError({'date_to': 'A data final deve ser igual ou posterior à inicial.'})

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(store__name__icontains=search) |
                Q(category__name__icontains=search)
            )
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if product_type:
            queryset = queryset.filter(product_type=product_type)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)
        return queryset


class AdminStoreProductListCreateView(generics.ListCreateAPIView):
    """Admin: listar e criar produtos dentro de uma loja específica."""
    serializer_class = AdminStoreProductSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_store(self):
        return get_object_or_404(Store, pk=self.kwargs['store_id'])

    def get_queryset(self):
        self.get_store()
        return Product.objects.filter(store_id=self.kwargs['store_id']).select_related(
            'store', 'category', 'course'
        ).prefetch_related('images').order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        store = self.get_store()
        product_slug = slugify(serializer.validated_data.get('slug') or serializer.validated_data['name'])
        base_slug = product_slug or 'produto'
        product_slug = base_slug
        suffix = 2
        while Product.objects.filter(store=store, slug=product_slug).exists():
            product_slug = f'{base_slug}-{suffix}'
            suffix += 1
        serializer.save(store=store, product_type=store.product_type, slug=product_slug)
        cache.delete('home_sections')


class AdminStoreProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ler, editar ou remover (soft delete) produto da loja indicada."""
    serializer_class = AdminStoreProductSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = Product.objects.select_related('store', 'category', 'course').prefetch_related('images')

    def get_queryset(self):
        return super().get_queryset().filter(store_id=self.kwargs['store_id'])

    @transaction.atomic
    def perform_update(self, serializer):
        old_stock = serializer.instance.stock
        product = serializer.save()
        if product.stock != old_stock:
            StockLog.objects.create(
                product=product,
                change_type='adjustment',
                quantity=product.stock - old_stock,
                stock_before=old_stock,
                stock_after=product.stock,
                reference='Ajuste de inventário pelo administrador',
                changed_by=self.request.user,
                notes='Stock actualizado através da gestão de produtos da loja.',
            )
        cache.delete('home_sections')

    @transaction.atomic
    def perform_destroy(self, instance):
        instance.status = 'deleted'
        instance.save(update_fields=['status', 'updated_at'])
        cache.delete('home_sections')


class AdminStoreProductImageListCreateView(generics.ListCreateAPIView):
    """Admin: consultar/adicionar imagens aos produtos da loja."""
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return ProductImage.objects.filter(
            product_id=self.kwargs['product_id'],
            product__store_id=self.kwargs['store_id'],
        )

    def perform_create(self, serializer):
        product = get_object_or_404(
            Product, pk=self.kwargs['product_id'], store_id=self.kwargs['store_id']
        )
        with transaction.atomic():
            if serializer.validated_data.get('is_primary'):
                ProductImage.objects.filter(product=product, is_primary=True).update(is_primary=False)
            serializer.save(product=product)
        cache.delete('home_sections')


class AdminStoreProductImageDeleteView(generics.DestroyAPIView):
    """Admin: remover imagem apenas de produtos da loja indicada."""
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return ProductImage.objects.filter(
            product_id=self.kwargs['product_id'],
            product__store_id=self.kwargs['store_id'],
        )

    def perform_destroy(self, instance):
        instance.delete()
        cache.delete('home_sections')
