"""
Storage dedicado para ficheiros digitais no Cloudflare R2.
NAO afeta imagens, logos, banners, nem qualquer outro campo FileField/ImageField.
"""
from django.conf import settings
from django.core.files.storage import FileSystemStorage


def get_digital_file_storage():
    """
    Retorna o storage apropriado para Product.digital_file:
    - Cloudflare R2 (S3Boto3Storage) em producao
    - FileSystemStorage local em desenvolvimento
    """
    bucket = getattr(settings, 'R2_BUCKET_NAME', '')
    if bucket:
        from storages.backends.s3boto3 import S3Boto3Storage
        return S3Boto3Storage(
            bucket_name=settings.R2_BUCKET_NAME,
            access_key=getattr(settings, 'R2_ACCESS_KEY_ID', ''),
            secret_key=getattr(settings, 'R2_SECRET_ACCESS_KEY', ''),
            endpoint_url=getattr(settings, 'R2_ENDPOINT_URL', ''),
            region_name=getattr(settings, 'R2_REGION', 'auto'),
            default_acl='private',
            querystring_auth=True,
            querystring_expire=300,
            location='protected/products/digital',
        )

    # Fallback: disco local (desenvolvimento)
    return FileSystemStorage()
