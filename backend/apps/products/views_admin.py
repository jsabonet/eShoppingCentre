from rest_framework import generics, permissions, serializers
from .models import Category, Product
from .serializers import CategorySerializer


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
