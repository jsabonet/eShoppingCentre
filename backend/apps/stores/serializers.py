from rest_framework import serializers
from django.db import models
from django.utils.text import slugify
from .models import Store, StoreModerationLog


class StoreSerializer(serializers.ModelSerializer):
    tier = serializers.CharField(read_only=True)
    tier_display = serializers.CharField(read_only=True)
    total_products = serializers.SerializerMethodField()
    clear_logo = serializers.BooleanField(default=False, write_only=True)
    clear_banner = serializers.BooleanField(default=False, write_only=True)

    class Meta:
        model = Store
        fields = ('id', 'name', 'slug', 'description', 'tagline', 'logo', 'banner',
                  'theme_color', 'category', 'rating', 'total_sales', 'total_products',
                  'location', 'status', 'product_type', 'tier', 'tier_display',
                  'clear_logo', 'clear_banner')
        read_only_fields = ('id', 'rating', 'total_sales', 'status', 'product_type', 'tier', 'tier_display')

    def get_total_products(self, obj):
        return obj.products.exclude(status='deleted').count()

    def update(self, instance, validated_data):
        # Handle clear_* flags before saving
        if validated_data.pop('clear_logo', False):
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = None
        if validated_data.pop('clear_banner', False):
            if instance.banner:
                instance.banner.delete(save=False)
            instance.banner = None

        return super().update(instance, validated_data)


class StoreModerationLogSerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source='admin.get_full_name', read_only=True)
    admin_email = serializers.CharField(source='admin.email', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = StoreModerationLog
        fields = ('id', 'admin_name', 'admin_email', 'action', 'action_display',
                  'reason', 'previous_status', 'new_status', 'created_at')


class StoreDetailSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    theme_color = serializers.RegexField(
        regex=r'^#[0-9A-Fa-f]{6}$',
        required=False,
        allow_blank=True,
    )
    logo = serializers.ImageField(required=False, allow_null=True)
    banner = serializers.ImageField(required=False, allow_null=True)
    identity_document = serializers.ImageField(required=False, allow_null=True)
    tax_document = serializers.ImageField(required=False, allow_null=True)
    address_proof = serializers.ImageField(required=False, allow_null=True)
    additional_documents = serializers.ImageField(required=False, allow_null=True)
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    owner_phone = serializers.SerializerMethodField()
    owner_verified = serializers.BooleanField(source='owner.is_verified', read_only=True)
    owner_date_joined = serializers.DateTimeField(source='owner.date_joined', read_only=True)
    total_revenue = serializers.SerializerMethodField()
    total_orders = serializers.SerializerMethodField()
    total_products = serializers.SerializerMethodField()
    moderation_logs = StoreModerationLogSerializer(many=True, read_only=True)
    has_documents = serializers.SerializerMethodField()
    store_products = serializers.SerializerMethodField()
    recent_orders = serializers.SerializerMethodField()
    monthly_sales = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    clear_logo = serializers.BooleanField(default=False, write_only=True)
    clear_banner = serializers.BooleanField(default=False, write_only=True)

    class Meta:
        model = Store
        fields = ('id', 'name', 'slug', 'description', 'about', 'tagline',
                  'logo', 'banner', 'theme_color', 'category', 'phone', 'email',
                  'location', 'website', 'status', 'product_type', 'rating', 'total_sales',
                  'default_affiliate_commission', 'low_stock_threshold',
                  'shipping_policy', 'return_policy',
                  'identity_document', 'tax_document', 'address_proof', 'additional_documents',
                  'admin_notes', 'rejection_reason',
                  'owner', 'owner_name', 'owner_email', 'owner_phone',
                  'owner_verified', 'owner_date_joined',
                  'total_revenue', 'total_orders', 'total_products',
                  'moderation_logs', 'has_documents',
                  'store_products', 'recent_orders', 'monthly_sales',
                  'followers_count', 'review_count', 'clear_logo', 'clear_banner')
        read_only_fields = ('id', 'rating', 'total_sales', 'status',
                           'admin_notes', 'rejection_reason',
                           'owner', 'owner_name', 'owner_email', 'owner_verified',
                           'owner_date_joined', 'total_revenue', 'total_orders',
                           'total_products', 'moderation_logs', 'has_documents',
                           'store_products', 'recent_orders', 'monthly_sales')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Bloquear alteração do product_type após criação da loja
        if self.instance is not None:
            self.fields['product_type'].read_only = True

    def get_total_revenue(self, obj):
        from .financials import paid_order_revenue
        return float(paid_order_revenue(obj.orders.filter(payment_status='completed')))

    @staticmethod
    def _validate_upload(upload, max_size, field_label):
        if upload.size > max_size:
            raise serializers.ValidationError(
                f'{field_label} não pode ultrapassar {max_size // (1024 * 1024)} MB.'
            )
        from PIL import Image
        try:
            image = Image.open(upload)
            if image.width * image.height > 40_000_000:
                raise serializers.ValidationError(
                    f'{field_label} excede as dimensões máximas permitidas.'
                )
            image.verify()
        except (OSError, ValueError, Image.DecompressionBombError):
            raise serializers.ValidationError(f'{field_label} deve ser uma imagem válida.')
        finally:
            upload.seek(0)
        return upload

    def validate_logo(self, value):
        if value:
            self._validate_upload(value, 5 * 1024 * 1024, 'O logótipo')
        return value

    def validate_banner(self, value):
        if value:
            self._validate_upload(value, 10 * 1024 * 1024, 'O banner')
        return value

    def validate_identity_document(self, value):
        if value:
            self._validate_upload(value, 10 * 1024 * 1024, 'O documento de identidade')
        return value

    def validate_tax_document(self, value):
        if value:
            self._validate_upload(value, 10 * 1024 * 1024, 'O documento fiscal')
        return value

    def validate_address_proof(self, value):
        if value:
            self._validate_upload(value, 10 * 1024 * 1024, 'O comprovativo de morada')
        return value

    def validate_additional_documents(self, value):
        if value:
            self._validate_upload(value, 10 * 1024 * 1024, 'O documento adicional')
        return value

    def validate_slug(self, value):
        slug = value.strip()
        if slug and Store.objects.filter(slug=slug).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError('Este endereço de loja já está em uso.')
        return slug

    def validate_default_affiliate_commission(self, value):
        from apps.affiliates.models import AffiliateSettings

        settings_obj = AffiliateSettings.get_settings()
        if value < settings_obj.min_commission_rate or value > settings_obj.max_commission_rate:
            raise serializers.ValidationError(
                f'A comissão deve estar entre {settings_obj.min_commission_rate}% '
                f'e {settings_obj.max_commission_rate}%.'
            )
        return value

    def get_total_orders(self, obj):
        return obj.orders.count()

    def get_total_products(self, obj):
        return obj.products.exclude(status='deleted').count()

    def get_owner_phone(self, obj):
        """Fallback: usa telefone do dono, senão o da loja."""
        return obj.owner.phone or obj.phone

    def get_has_documents(self, obj):
        return {
            'identity': bool(obj.identity_document),
            'tax': bool(obj.tax_document),
            'address': bool(obj.address_proof),
            'additional': bool(obj.additional_documents),
        }

    def update(self, instance, validated_data):
        # Handle clear_* flags before saving
        if validated_data.pop('clear_logo', False):
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = None
        if validated_data.pop('clear_banner', False):
            if instance.banner:
                instance.banner.delete(save=False)
            instance.banner = None

        return super().update(instance, validated_data)

    def create(self, validated_data):
        # Remove write_only fields not present on the model
        validated_data.pop('clear_logo', None)
        validated_data.pop('clear_banner', None)
        return super().create(validated_data)

    def get_store_products(self, obj):
        """Últimos 20 produtos da loja (admin view)."""
        products = obj.products.filter(~models.Q(status='deleted')).order_by('-created_at')[:20]
        return [{
            'id': str(p.id),
            'name': p.name,
            'slug': p.slug,
            'price': float(p.price),
            'stock': p.stock,
            'status': p.status,
            'product_type': p.product_type,
            'sales_count': p.sales_count,
            'primary_image': p.images.filter(is_primary=True).first().image.url if p.images.filter(is_primary=True).exists() else None,
        } for p in products]

    def get_recent_orders(self, obj):
        """Últimas 10 encomendas da loja."""
        orders = obj.orders.select_related('buyer').order_by('-created_at')[:10]
        return [{
            'id': str(o.id),
            'order_number': o.order_number,
            'customer': o.buyer.get_full_name() or o.buyer.email,
            'total': float(o.total),
            'status': o.status,
            'status_display': o.get_status_display(),
            'payment_method': o.payment_method,
            'items_count': o.items.count(),
            'created_at': o.created_at.isoformat(),
        } for o in orders]

    def get_monthly_sales(self, obj):
        """Vendas mensais dos últimos 6 meses para gráfico."""
        from django.utils import timezone
        from datetime import timedelta
        from .financials import paid_order_revenue

        today = timezone.now().date()
        result = []
        for i in range(5, -1, -1):
            month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1) if i > 0 else today.replace(day=1)
            # Calculate the correct month
            d = today.replace(day=1) - timedelta(days=i * 32)
            month_start = d.replace(day=1)
            if i == 0:
                month_end = today
            else:
                if month_start.month == 12:
                    month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
                else:
                    month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)

            monthly_orders = obj.orders.filter(
                payment_status='completed',
                created_at__date__gte=month_start,
                created_at__date__lte=month_end,
            )
            total = paid_order_revenue(monthly_orders)

            months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            result.append({
                'month': months[month_start.month - 1],
                'year': month_start.year,
                'total': float(total),
                'orders': monthly_orders.count(),
            })
        return result

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_review_count(self, obj):
        return obj.reviews.filter(is_hidden=False).count()

    def validate(self, data):
        if not data.get('slug'):
            data['slug'] = slugify(data.get('name', ''))
        return data


class PublicStoreDetailSerializer(serializers.ModelSerializer):
    total_products = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    tier = serializers.CharField(read_only=True)
    tier_display = serializers.CharField(read_only=True)

    class Meta:
        model = Store
        fields = (
            'id', 'name', 'slug', 'description', 'about', 'tagline', 'logo',
            'banner', 'theme_color', 'category', 'phone', 'email', 'location',
            'website', 'status', 'product_type', 'rating', 'total_sales',
            'total_products', 'followers_count', 'review_count', 'tier',
            'tier_display', 'shipping_policy', 'return_policy', 'created_at',
        )

    def get_total_products(self, obj):
        return obj.products.exclude(status='deleted').count()

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_review_count(self, obj):
        return obj.reviews.filter(is_hidden=False).count()
