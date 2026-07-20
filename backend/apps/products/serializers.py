from rest_framework import serializers
from .models import Category, Product, ProductImage, ProductVariation, WishlistItem


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'image', 'alt_text', 'is_primary', 'sort_order')


class ProductVariationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariation
        fields = ('id', 'name', 'sku', 'price_modifier', 'stock', 'is_active')


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'name', 'slug', 'price', 'compare_price',
                  'discount_percentage', 'primary_image', 'product_type',
                  'rating', 'review_count', 'sales_count', 'is_on_sale',
                  'stock', 'store_name', 'store_slug', 'created_at')

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else img.image.url
        return None

    def get_discount_percentage(self, obj):
        if obj.compare_price and obj.compare_price > 0:
            return round((1 - obj.price / obj.compare_price) * 100)
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variations = ProductVariationSerializer(many=True, read_only=True)
    store = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def get_store(self, obj):
        logo_url = None
        if obj.store.logo:
            request = self.context.get('request')
            logo_url = request.build_absolute_uri(obj.store.logo.url) if request else obj.store.logo.url
        return {
            'id': str(obj.store.id),
            'name': obj.store.name,
            'slug': obj.store.slug,
            'logo': logo_url,
            'rating': str(obj.store.rating),
            'total_sales': obj.store.total_sales,
        }


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'image', 'product_count', 'sort_order')

    def get_product_count(self, obj):
        return obj.products.filter(status='active').count()


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = WishlistItem
        fields = ('id', 'product', 'product_id', 'added_at')
        read_only_fields = ('product',)

    def create(self, validated_data):
        product_id = validated_data.pop('product_id')
        product = Product.objects.get(id=product_id)
        wishlist_item, _ = WishlistItem.objects.get_or_create(
            user=self.context['request'].user,
            product=product,
        )
        return wishlist_item
