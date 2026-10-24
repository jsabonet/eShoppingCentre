from rest_framework import serializers
from django.utils.text import slugify
from .models import BlogInlineImage, BlogPost

MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}
ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}


class BlogPostListSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(read_only=True, allow_null=True)

    class Meta:
        model = BlogPost
        fields = ('id', 'slug', 'title', 'excerpt', 'image', 'author_name',
                  'category', 'read_time', 'published_at', 'created_at')


class BlogPostDetailSerializer(serializers.ModelSerializer):
    seo = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = '__all__'
        read_only_fields = ('slug', 'read_time', 'published_at')

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
