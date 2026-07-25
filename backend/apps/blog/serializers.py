from rest_framework import serializers
from django.utils.text import slugify
from .models import BlogPost


class BlogPostListSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = ('id', 'slug', 'title', 'excerpt', 'image', 'author_name',
                  'category', 'read_time', 'published_at')


class BlogPostDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = '__all__'
        read_only_fields = ('slug', 'read_time', 'published_at')

    def create(self, validated_data):
        validated_data['slug'] = slugify(validated_data['title'])
        return super().create(validated_data)
