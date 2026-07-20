from rest_framework import serializers
from .models import Store


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ('id', 'name', 'slug', 'description', 'logo', 'banner',
                  'category', 'rating', 'total_sales', 'total_products',
                  'location', 'status')
        read_only_fields = ('id', 'rating', 'total_sales', 'total_products', 'status')


class StoreDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = '__all__'
        read_only_fields = ('id', 'rating', 'total_sales', 'total_products', 'status')
