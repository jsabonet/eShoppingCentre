"""
Serializers para listagem de downloads digitais do utilizador.
"""
from rest_framework import serializers
from django.utils import timezone
from .models_digital import DigitalDownload


class MyDownloadSerializer(serializers.ModelSerializer):
    """Download listado na página 'Meus Downloads' do cliente."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    digital_format = serializers.CharField(source='product.digital_format', read_only=True)
    digital_file_size = serializers.CharField(source='product.digital_file_size', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    download_limit = serializers.IntegerField(source='product.download_limit', read_only=True)
    downloads_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    is_exhausted = serializers.SerializerMethodField()
    purchased_at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = DigitalDownload
        fields = (
            'id',
            'product_name',
            'product_slug',
            'digital_format',
            'digital_file_size',
            'download_count',
            'download_limit',
            'downloads_remaining',
            'is_expired',
            'is_exhausted',
            'expires_at',
            'order_number',
            'purchased_at',
        )

    def get_downloads_remaining(self, obj):
        limit = obj.product.download_limit
        return max(0, limit - obj.download_count)

    def get_is_expired(self, obj):
        return obj.expires_at is not None and timezone.now() > obj.expires_at

    def get_is_exhausted(self, obj):
        return obj.download_count >= obj.product.download_limit
