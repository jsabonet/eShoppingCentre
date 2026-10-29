from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps
from rest_framework import serializers

from .models import BannerCampaign, CampaignAudit

MAX_BANNER_IMAGE_SIZE = 10 * 1024 * 1024
MAX_BANNER_IMAGE_PIXELS = 40_000_000
MAX_BANNER_DIMENSIONS = (1920, 1600)
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP'}


class BannerCampaignSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(
        source='state',
        choices=BannerCampaign.State.choices,
        required=False,
    )
    image = serializers.ImageField(required=False)
    mobile_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = BannerCampaign
        fields = (
            'id', 'internal_name', 'image', 'mobile_image', 'alt_text',
            'title', 'subtitle', 'cta', 'target_url', 'starts_at', 'ends_at',
            'priority', 'position', 'status', 'view_count', 'click_count',
            'display_status', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'view_count', 'click_count', 'display_status',
            'created_at', 'updated_at',
        )

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['status'] = instance.state
        representation['display_status'] = instance.display_status
        return representation

    def validate_image_field(self, value):
        if value is None:
            return value
        if value.size > MAX_BANNER_IMAGE_SIZE:
            raise serializers.ValidationError(
                'Cada imagem do banner deve ter no máximo 10 MB.'
            )
        value.seek(0)
        with Image.open(value) as source_image:
            if source_image.format not in ALLOWED_IMAGE_FORMATS:
                raise serializers.ValidationError(
                    'Formato não suportado. Use JPG, PNG ou WebP.'
                )
            if source_image.width * source_image.height > MAX_BANNER_IMAGE_PIXELS:
                raise serializers.ValidationError(
                    'A imagem tem dimensões excessivas. Reduza-a antes de carregar.'
                )
            image = ImageOps.exif_transpose(source_image)
            image.thumbnail(MAX_BANNER_DIMENSIONS, Image.Resampling.LANCZOS)
        if image.mode not in {'RGB', 'RGBA'}:
            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
        output = BytesIO()
        image.save(output, format='WEBP', quality=82, method=6)
        output.seek(0)
        filename = f'{Path(value.name or "banner").stem}.webp'
        return InMemoryUploadedFile(
            output,
            field_name='image',
            name=filename,
            content_type='image/webp',
            size=output.getbuffer().nbytes,
            charset=None,
        )

    def validate_image(self, value):
        return self.validate_image_field(value)

    def validate_mobile_image(self, value):
        return self.validate_image_field(value)

    def validate_target_url(self, value):
        value = value.strip()
        parsed = urlsplit(value)
        if (
            value.startswith('/')
            and not value.startswith('//')
            and '\\' not in value
            and not any(ord(character) < 32 for character in value)
        ):
            return value
        if (
            parsed.scheme.lower() in {'http', 'https'}
            and parsed.hostname
            and not parsed.username
            and not parsed.password
        ):
            return value
        raise serializers.ValidationError(
            'Indique um caminho interno iniciado por / ou um endereço HTTPS/HTTP válido.'
        )

    def validate(self, attrs):
        if not self.instance and not attrs.get('image'):
            raise serializers.ValidationError({'image': 'A imagem principal é obrigatória.'})
        starts_at = attrs.get(
            'starts_at', getattr(self.instance, 'starts_at', None)
        )
        ends_at = attrs.get(
            'ends_at', getattr(self.instance, 'ends_at', None)
        )
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({
                'ends_at': 'O fim da campanha deve ser posterior ao início.'
            })
        if attrs.get('state', getattr(self.instance, 'state', None)) == BannerCampaign.State.ACTIVE:
            if not starts_at or not ends_at:
                raise serializers.ValidationError(
                    'Defina o início e o fim antes de ativar a campanha.'
                )
            if not attrs.get('alt_text', getattr(self.instance, 'alt_text', '')).strip():
                raise serializers.ValidationError({
                    'alt_text': 'O texto alternativo é obrigatório para ativar a campanha.'
                })
            if not attrs.get('target_url', getattr(self.instance, 'target_url', '')).strip():
                raise serializers.ValidationError({
                    'target_url': 'O destino é obrigatório para ativar a campanha.'
                })
        return attrs


class CampaignAuditSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = CampaignAudit
        fields = (
            'id', 'campaign_id', 'campaign_name', 'action', 'changes',
            'actor_name', 'created_at',
        )

    def get_actor_name(self, obj):
        if not obj.actor:
            return 'Utilizador removido'
        return obj.actor.get_full_name() or obj.actor.email
