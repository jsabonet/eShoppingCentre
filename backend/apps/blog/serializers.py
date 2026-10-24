from rest_framework import serializers
from django.utils.text import slugify
from .models import BlogPost


class BlogPostListSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(read_only=True, allow_null=True)

    class Meta:
        model = BlogPost
        fields = ('id', 'slug', 'title', 'excerpt', 'image', 'author_name',
                  'category', 'read_time', 'published_at', 'created_at')


class BlogPostDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = '__all__'
        read_only_fields = ('slug', 'read_time', 'published_at')

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
