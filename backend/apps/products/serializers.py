from rest_framework import serializers
from .models import Category, Product, ProductImage, ProductVariant, ProductVariation, Coupon, WishlistItem, StockLog


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'image', 'alt_text', 'is_primary', 'sort_order')


class StockLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockLog
        fields = ('id', 'change_type', 'quantity', 'stock_before', 'stock_after',
                  'reference', 'changed_by_name', 'notes', 'created_at')

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.email
        return 'Sistema'


class ProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ('id', 'name', 'sku', 'price', 'effective_price', 'stock',
                  'image', 'image_url', 'attributes', 'is_active', 'sort_order')
        read_only_fields = ('id',)

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


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


class SellerProductSerializer(serializers.ModelSerializer):
    """Richer serializer for seller product management (includes status, stock, etc.)"""
    primary_image = serializers.SerializerMethodField()
    variant_count = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    digital_downloads = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    stock_logs = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'name', 'slug', 'price', 'compare_price', 'discount_percentage',
                  'primary_image', 'product_type', 'status', 'stock', 'sku',
                  'sales_count', 'rating', 'review_count', 'is_on_sale',
                  'is_featured', 'variant_count', 'created_at',
                  'digital_format', 'digital_license', 'digital_version',
                  'download_limit', 'download_expiry_days', 'digital_downloads',
                  'course', 'stock_logs')

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else img.image.url
        return None

    def get_variant_count(self, obj):
        return obj.variants.filter(is_active=True).count()

    def get_discount_percentage(self, obj):
        if obj.compare_price and obj.compare_price > 0:
            return round((1 - obj.price / obj.compare_price) * 100)
        return None

    def get_stock_logs(self, obj):
        logs = obj.stock_logs.order_by('-created_at')[:20]
        return StockLogSerializer(logs, many=True).data

    def get_digital_downloads(self, obj):
        if obj.product_type != 'digital':
            return None
        from .models_digital import DigitalDownload
        return DigitalDownload.objects.filter(product=obj).count()

    def get_course(self, obj):
        if obj.product_type != 'course':
            return None
        try:
            from apps.courses.models import Course
            course, _created = Course.objects.get_or_create(
                product=obj,
                defaults={
                    'instructor': obj.store.owner,
                    'level': 'beginner',
                    'duration': '',
                    'total_lessons': 0,
                }
            )
            return {
                'course_id': str(course.id),
                'level': course.level,
                'duration': course.duration,
                'total_lessons': course.total_lessons,
                'certificate_enabled': course.certificate_enabled,
                'preview_video_url': course.preview_video_url,
                'modules_count': course.modules.count(),
            }
        except Exception:
            return None


class ProductDetailSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    store = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    category = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Category.objects.filter(is_active=True),
        help_text='Slug da categoria (ex: "moda", "eletronicos")'
    )
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)

    class Meta:
        model = Product
        fields = '__all__'
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

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

    def get_course(self, obj):
        if obj.product_type != 'course':
            return None
        try:
            from apps.courses.models import Course
            course, _created = Course.objects.get_or_create(
                product=obj,
                defaults={
                    'instructor': obj.store.owner,
                    'level': 'beginner',
                    'duration': '',
                    'total_lessons': 0,
                }
            )
            instructor = course.instructor
            return {
                'course_id': str(course.id),
                'instructor_name': instructor.get_full_name() or instructor.email,
                'level': course.level,
                'level_display': course.get_level_display() if hasattr(course, 'get_level_display') else course.level,
                'duration': course.duration,
                'total_lessons': course.total_lessons,
                'certificate_enabled': course.certificate_enabled,
                'preview_video_url': course.preview_video_url,
                'modules_count': course.modules.count(),
                'access_duration_days': course.access_duration_days,
            }
        except Exception:
            return None


from django.utils.text import slugify

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    parent_slug = serializers.CharField(source='parent.slug', read_only=True, allow_null=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'image', 'parent_slug',
                  'product_count', 'children', 'product_type', 'sort_order')
        read_only_fields = ('slug',)

    def get_product_count(self, obj):
        return obj.products.filter(status='active').count()

    def get_children(self, obj):
        # Only include children in root-level listing, not recursive
        if hasattr(obj, '_prefetched_children'):
            children = obj._prefetched_children
        else:
            children = obj.children.filter(is_active=True)
        return [{'name': c.name, 'slug': c.slug} for c in children[:20]]

    def create(self, validated_data):
        validated_data['slug'] = slugify(validated_data['name'])
        return super().create(validated_data)


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


class CouponSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = Coupon
        fields = ('id', 'code', 'discount_type', 'discount_value', 'min_purchase',
                  'max_uses', 'used_count', 'max_per_user', 'starts_at', 'ends_at',
                  'is_active', 'is_valid', 'product', 'category', 'store_name', 'created_at')
        read_only_fields = ('id', 'used_count', 'store', 'created_at')
