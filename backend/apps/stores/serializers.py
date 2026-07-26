from rest_framework import serializers
from django.utils.text import slugify
from .models import Store


class StoreSerializer(serializers.ModelSerializer):
    tier = serializers.CharField(read_only=True)
    tier_display = serializers.CharField(read_only=True)

    class Meta:
        model = Store
        fields = ('id', 'name', 'slug', 'description', 'tagline', 'logo', 'banner',
                  'theme_color', 'category', 'rating', 'total_sales', 'total_products',
                  'location', 'status', 'tier', 'tier_display')
        read_only_fields = ('id', 'rating', 'total_sales', 'total_products', 'status', 'tier', 'tier_display')


class StoreDetailSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Store
        fields = '__all__'
        read_only_fields = ('id', 'rating', 'total_sales', 'total_products', 'status')

    def validate(self, data):
        if not data.get('slug'):
            data['slug'] = slugify(data.get('name', ''))
        return data

    def create(self, validated_data):
        return super().create(validated_data)
