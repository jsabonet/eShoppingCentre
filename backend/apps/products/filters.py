import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    category = django_filters.CharFilter(field_name='category__slug')
    store = django_filters.CharFilter(field_name='store__slug')
    is_on_sale = django_filters.BooleanFilter()
    is_featured = django_filters.BooleanFilter()
    min_rating = django_filters.NumberFilter(field_name='rating', lookup_expr='gte')
    status = django_filters.CharFilter(field_name='status', lookup_expr='exact')

    class Meta:
        model = Product
        fields = ['product_type', 'category', 'store', 'min_price', 'max_price',
                  'is_on_sale', 'is_featured', 'min_rating', 'status']
