import re
from html import escape
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urlsplit

from django.utils.text import slugify
from django.utils.html import strip_tags
from rest_framework import serializers

from .models import BlogComment, BlogInlineImage, BlogLike, BlogPost, NewsletterSubscription

MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024
MAX_COVER_IMAGE_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}
ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
BLOG_CONTENT_MAX_LENGTH = 100_000


class _BlogHtmlSanitizer(HTMLParser):
    allowed_tags = {
        'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption',
        'figure', 'font', 'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol',
        'p', 'pre', 's', 'span', 'strike', 'strong', 'sub', 'sup', 'table',
        'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
    }
    void_tags = {'br', 'hr', 'img'}
    blocked_tags = {'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'}
    allowed_styles = {'color', 'background-color', 'text-align', 'font-size'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.open_tags = []
        self.blocked_stack = []

    @staticmethod
    def _safe_url(value, image=False):
        value = value.strip()
        parsed = urlsplit(value)
        if parsed.scheme.lower() in {'http', 'https', 'mailto'} and parsed.netloc or parsed.scheme.lower() == 'mailto':
            return not parsed.username and not parsed.password
        return image and bool(value) and not value.startswith('//') and value.startswith(('/', './', '../'))

    @classmethod
    def _safe_style(cls, value):
        declarations = []
        for declaration in value.split(';'):
            key, separator, style_value = declaration.partition(':')
            key = key.strip().lower()
            style_value = style_value.strip()
            if not separator or key not in cls.allowed_styles:
                continue
            if re.search(r'url\s*\(|expression|[<>]', style_value, re.IGNORECASE):
                continue
            if key == 'text-align' and not re.fullmatch(r'(left|right|center|justify)', style_value, re.IGNORECASE):
                continue
            if key == 'font-size' and not re.fullmatch(r'\d+(?:\.\d+)?(?:px|em|rem|%)', style_value, re.IGNORECASE):
                continue
            if key in {'color', 'background-color'} and not re.fullmatch(
                r'(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})', style_value, re.IGNORECASE
            ):
                continue
            declarations.append(f'{key}: {style_value}')
        return '; '.join(declarations)

    def handle_starttag(self, tag, attrs):
        if self.blocked_stack:
            if tag not in self.void_tags:
                self.blocked_stack.append(tag)
            return
        if tag in self.blocked_tags:
            if tag not in self.void_tags:
                self.blocked_stack.append(tag)
            return
        if tag not in self.allowed_tags:
            return

        attributes = dict(attrs)
        safe_attributes = {}
        if tag == 'a' and self._safe_url(attributes.get('href', '')):
            safe_attributes['href'] = attributes['href'].strip()
        if tag == 'img':
            source = attributes.get('src', '')
            if self._safe_url(source, image=True):
                safe_attributes['src'] = source.strip()
            for name in ('alt', 'title'):
                if name in attributes:
                    safe_attributes[name] = attributes[name][:300]
            for name in ('width', 'height'):
                if re.fullmatch(r'\d{1,4}', attributes.get(name, '')):
                    safe_attributes[name] = attributes[name]
        if tag in {'a', 'img'} and 'title' in attributes:
            safe_attributes['title'] = attributes['title'][:300]
        if tag == 'font':
            color = attributes.get('color', '')
            size = attributes.get('size', '')
            if re.fullmatch(r'#[\da-f]{3,8}|[a-z]{3,20}', color, re.IGNORECASE):
                safe_attributes['color'] = color
            if re.fullmatch(r'[1-7]', size):
                safe_attributes['size'] = size
        style = self._safe_style(attributes.get('style', ''))
        if style:
            safe_attributes['style'] = style
        if tag == 'a':
            if attributes.get('target') == '_blank':
                safe_attributes['target'] = '_blank'
            safe_attributes['rel'] = 'noopener noreferrer'

        rendered_attrs = ''.join(
            f' {name}="{escape(value, quote=True)}"' for name, value in safe_attributes.items()
        )
        self.output.append(f'<{tag}{rendered_attrs}>')
        if tag not in self.void_tags:
            self.open_tags.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.void_tags:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.blocked_stack:
            if tag in self.blocked_stack:
                index = len(self.blocked_stack) - 1 - self.blocked_stack[::-1].index(tag)
                del self.blocked_stack[index:]
            return
        if tag not in self.allowed_tags or tag in self.void_tags or tag not in self.open_tags:
            return
        while self.open_tags:
            open_tag = self.open_tags.pop()
            self.output.append(f'</{open_tag}>')
            if open_tag == tag:
                break

    def handle_data(self, data):
        if not self.blocked_stack:
            self.output.append(escape(data, quote=False))

    def finish(self):
        self.close()
        while self.open_tags:
            self.output.append(f'</{self.open_tags.pop()}>')
        return ''.join(self.output)


def sanitize_blog_content(value):
    sanitizer = _BlogHtmlSanitizer()
    sanitizer.feed(value)
    return sanitizer.finish()


def _is_safe_http_url(value):
    try:
        parsed = urlsplit(value)
        parsed.port
        return (
            parsed.scheme.lower() in {'http', 'https'}
            and bool(parsed.hostname)
            and not parsed.username
            and not parsed.password
        )
    except ValueError:
        return False


class BlogCoverImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if getattr(data, 'size', 0) > MAX_COVER_IMAGE_SIZE:
            raise serializers.ValidationError('A imagem de capa deve ter no máximo 10 MB.')
        image = super().to_internal_value(data)
        image_format = getattr(getattr(image, 'image', None), 'format', None)
        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError('Formato de imagem não suportado. Use JPG, PNG, WebP ou GIF.')
        return image


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
    image = BlogCoverImageField(required=False)
    image_url = serializers.URLField(required=False, allow_blank=True, max_length=1000)
    title = serializers.CharField(max_length=200, allow_blank=False, trim_whitespace=True)
    excerpt = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)
    content = serializers.CharField(max_length=BLOG_CONTENT_MAX_LENGTH, allow_blank=False, trim_whitespace=True)
    category = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
    author_name = serializers.CharField(max_length=255, allow_blank=False, trim_whitespace=True)
    meta_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    meta_description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    focus_keyword = serializers.CharField(max_length=120, required=False, allow_blank=True)
    og_title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    og_description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    image_caption = serializers.CharField(max_length=255, required=False, allow_blank=True)
    image_credit = serializers.CharField(max_length=255, required=False, allow_blank=True)

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
        if not _is_safe_http_url(value):
            raise serializers.ValidationError('A ligação da imagem deve começar por http:// ou https://.')
        return value

    def validate_canonical_url(self, value):
        if not value:
            return value
        if not _is_safe_http_url(value):
            raise serializers.ValidationError('A URL canónica deve começar por http:// ou https://.')
        return value

    def validate_image_source_url(self, value):
        if not value:
            return value
        if not _is_safe_http_url(value):
            raise serializers.ValidationError('A fonte da imagem deve ser uma ligação http:// ou https:// válida.')
        return value

    def validate(self, attrs):
        if attrs.get('image') and attrs.get('image_url'):
            raise serializers.ValidationError({
                'image_url': 'Escolha uma imagem carregada ou uma ligação, não ambas.'
            })
        if 'content' in attrs:
            clean_content = sanitize_blog_content(attrs['content'])
            visible_text = unescape(strip_tags(clean_content)).replace('\xa0', ' ').strip()
            if not visible_text:
                raise serializers.ValidationError({'content': 'O conteúdo deve incluir texto visível.'})
            attrs['content'] = clean_content
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
