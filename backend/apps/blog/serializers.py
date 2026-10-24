from urllib.parse import urlsplit

from django.utils.text import slugify
from rest_framework import serializers

from .models import BlogComment, BlogInlineImage, BlogLike, BlogPost, NewsletterSubscription

MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}
ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}


class BlogPostListSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = ('id', 'slug', 'title', 'excerpt', 'image', 'author_name',
                  'category', 'read_time', 'published_at', 'created_at')

    def get_image(self, obj):
        if obj.image:
            return obj.image.url
        return obj.image_url or None


class BlogPostDetailSerializer(serializers.ModelSerializer):
    seo = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    image_url = serializers.URLField(required=False, allow_blank=True, max_length=1000)

    class Meta:
        model = BlogPost
        fields = '__all__'
        read_only_fields = ('slug', 'read_time', 'published_at')

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_liked_by_me(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        return obj.likes.filter(user=user).exists()

    def get_seo(self, obj):
        return {
            'title': obj.seo_title,
            'description': obj.seo_description,
            'og_title': obj.seo_og_title,
            'og_description': obj.seo_og_description,
            'robots': obj.seo_robots,
            'twitter_card': obj.twitter_card,
            'canonical_url': obj.canonical_url,
            'focus_keyword': obj.focus_keyword,
        }

    def validate_image_url(self, value):
        if not value:
            return value
        parsed = urlsplit(value)
        if parsed.scheme.lower() not in {'http', 'https'} or not parsed.hostname:
            raise serializers.ValidationError('A ligação da imagem deve começar por http:// ou https://.')
        if parsed.username or parsed.password:
            raise serializers.ValidationError('A ligação da imagem não pode conter credenciais.')
        return value

    def validate(self, attrs):
        if attrs.get('image') and attrs.get('image_url'):
            raise serializers.ValidationError({
                'image_url': 'Escolha uma imagem carregada ou uma ligação, não ambas.'
            })
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.image and instance.image_url:
            data['image'] = instance.image_url
        return data

    def create(self, validated_data):
        base_slug = (slugify(validated_data['title']) or 'artigo')[:255]
        slug = base_slug
        suffix = 2
        while BlogPost.objects.filter(slug=slug).exists():
            suffix_text = f'-{suffix}'
            slug = f'{base_slug[:255 - len(suffix_text)]}{suffix_text}'
            suffix += 1
        validated_data['slug'] = slug
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get('image_url'):
            validated_data['image'] = ''
        elif 'image' in validated_data:
            validated_data['image_url'] = ''
        return super().update(instance, validated_data)


class BlogInlineImageSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True)
    url = serializers.SerializerMethodField()
    name = serializers.CharField(source='original_name', read_only=True)
    size = serializers.SerializerMethodField()

    class Meta:
        model = BlogInlineImage
        fields = ('id', 'url', 'image', 'name', 'size', 'created_at')
        read_only_fields = ('id', 'created_at')

    def get_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def get_size(self, obj):
        try:
            return obj.image.size
        except (OSError, ValueError):
            return None

    def validate_image(self, value):
        if value.size > MAX_INLINE_IMAGE_SIZE:
            limit_mb = MAX_INLINE_IMAGE_SIZE // (1024 * 1024)
            raise serializers.ValidationError(f'A imagem deve ter no máximo {limit_mb} MB.')
        image_format = getattr(getattr(value, 'image', None), 'format', None)
        content_type = getattr(value, 'content_type', '')
        if image_format not in ALLOWED_IMAGE_FORMATS and content_type not in ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError('Formato não suportado. Use JPG, PNG, WebP ou GIF.')
        return value

    def create(self, validated_data):
        image = validated_data['image']
        validated_data['original_name'] = (image.name or '')[:255]
        return super().create(validated_data)


def _display_name(user):
    name = (user.first_name or '').strip()
    if name:
        return name
    if user.username:
        return user.username
    return (user.email or '').split('@')[0]


class BlogCommentSerializer(serializers.ModelSerializer):
    """Comentário público: leitura de aprovados e criação por utilizadores autenticados."""

    class Meta:
        model = BlogComment
        fields = ('id', 'content', 'author_name', 'status', 'created_at')
        read_only_fields = ('author_name', 'status', 'created_at')
        extra_kwargs = {
            'content': {'max_length': 5000},
        }

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['author'] = user
        validated_data['author_name'] = _display_name(user)
        validated_data['status'] = BlogComment.Status.PENDING
        return super().create(validated_data)


class BlogCommentAdminSerializer(serializers.ModelSerializer):
    post_title = serializers.CharField(source='post.title', read_only=True)
    post_slug = serializers.CharField(source='post.slug', read_only=True)
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = BlogComment
        fields = (
            'id', 'post', 'post_title', 'post_slug', 'content',
            'author_name', 'status', 'created_at',
        )
        read_only_fields = ('post', 'author_name', 'created_at')

    def get_author_name(self, obj):
        if obj.author:
            return _display_name(obj.author)
        return obj.author_name or 'Anónimo'


class NewsletterSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscription
        fields = ('id', 'email', 'is_active', 'source', 'consented_at', 'created_at')
        read_only_fields = ('id', 'is_active', 'consented_at', 'created_at')
        extra_kwargs = {'email': {'validators': []}}

    def validate_email(self, value):
        return (value or '').strip().lower()


class BlogCommentBulkSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=('approve', 'reject', 'delete'))
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=100,
    )
