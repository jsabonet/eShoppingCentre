"""
Views para download seguro de produtos digitais.

Fluxo:
  1. GET  /api/v1/products/downloads/              → Lista downloads do utilizador
  2. GET  /api/v1/products/downloads/{id}/token/    → Gera JWT de 5 minutos
  3. GET  /api/v1/products/downloads/{id}/file/?token=... → Valida JWT, serve ficheiro

Seguranca:
  - Rate limiting: maximo 5 tokens/min e 10 downloads/min por utilizador
  - Tokens single-use: cada token so pode ser usado 1 vez (Redis cache)
  - Audit log: cada download registado com IP, user-agent e timestamp
  - Anti-abuso: maximo 50 downloads/dia por utilizador (alerta)
"""

import uuid
import logging
from datetime import timedelta

import jwt
from django.conf import settings
from django.core.cache import cache
from django.http import FileResponse, HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models_digital import DigitalDownload, DownloadAuditLog
from .serializers_downloads import MyDownloadSerializer

logger = logging.getLogger(__name__)


# ─── Constantes ───

DOWNLOAD_TOKEN_EXPIRY_MINUTES = 5       # JWT expira em 5 minutos
PRESIGNED_URL_EXPIRY_SECONDS = 120      # S3 presigned URL expira em 2 minutos
MAX_DOWNLOADS_PER_DAY = 50              # Alerta se utilizador exceder (anti-abuso)
TOKEN_CACHE_PREFIX = 'dl_token:'        # Prefixo para cache de tokens single-use
TOKEN_CACHE_TTL = 60 * 10               # 10 minutos (token expira em 5, margem extra)


# ─── Throttle Classes ───

class DownloadTokenThrottle(UserRateThrottle):
    """Maximo 5 tokens de download por minuto por utilizador."""
    rate = '5/minute'
    scope = 'download_token'


class DownloadFileThrottle(UserRateThrottle):
    """Maximo 10 downloads por minuto por utilizador."""
    rate = '10/minute'
    scope = 'download_file'
PRESIGNED_URL_EXPIRY_SECONDS = 120      # S3 presigned URL expira em 2 minutos


# ─── Helpers ───

def _generate_download_token(download_id: str, user_id: str) -> str:
    """Gera um JWT de curta duracao para autorizar um download. O jti e tracked para single-use."""
    jti = uuid.uuid4().hex
    payload = {
        'download_id': download_id,
        'user_id': user_id,
        'exp': timezone.now() + timedelta(minutes=DOWNLOAD_TOKEN_EXPIRY_MINUTES),
        'iat': timezone.now(),
        'jti': jti,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    # Marcar token como nao-usado no cache (single-use tracking)
    cache.set(f'{TOKEN_CACHE_PREFIX}{jti}', 'unused', timeout=TOKEN_CACHE_TTL)
    return token


def _verify_download_token(token: str, download_id: str) -> str | None:
    """
    Valida o JWT de download.
    Verifica assinatura, expiracao e single-use.
    Retorna o user_id se valido, None caso contrario.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

    if payload.get('download_id') != download_id:
        return None

    # ─── Single-use check ───
    jti = payload.get('jti', '')
    if jti:
        cached = cache.get(f'{TOKEN_CACHE_PREFIX}{jti}')
        if cached is None:
            # Token nao encontrado no cache — ou ja foi usado ou expirou
            logger.warning(f'Token single-use invalido/ausente: jti={jti[:12]} download={download_id}')
            return None
        if cached == 'used':
            logger.warning(f'Tentativa de reutilizacao de token: jti={jti[:12]} download={download_id}')
            return None
        # Marcar como usado
        cache.set(f'{TOKEN_CACHE_PREFIX}{jti}', 'used', timeout=TOKEN_CACHE_TTL)

    return payload.get('user_id')


def _get_client_ip(request) -> str:
    """Extrai o IP real do cliente (suporta proxies/nginx)."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _log_download(download: DigitalDownload, request) -> None:
    """Regista o download no audit log."""
    try:
        DownloadAuditLog.objects.create(
            download=download,
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            file_size_bytes=download.product.digital_file.size
            if download.product.digital_file else 0,
        )
    except Exception as e:
        logger.error(f'Erro ao registar audit log: {e}')


def _check_daily_abuse(user_id: str) -> bool:
    """Verifica se o utilizador excedeu o limite diario de downloads. Retorna True se OK."""
    today = timezone.now().date()
    count = DownloadAuditLog.objects.filter(
        download__user_id=user_id,
        created_at__date=today,
    ).count()
    if count >= MAX_DOWNLOADS_PER_DAY:
        logger.warning(
            f'Limite diario de downloads excedido: user={user_id} count={count}'
        )
        return False
    return True


def _get_s3_presigned_url(file_field, filename: str) -> str:
    """Gera URL assinada S3/R2 para download directo."""
    try:
        storage = file_field.storage
        if hasattr(storage, 'bucket') and hasattr(storage, 'url'):
            # django-storages S3Boto3Storage
            return storage.url(
                file_field.name,
                parameters={
                    'ResponseContentDisposition': f'attachment; filename="{filename}"',
                    'ResponseContentType': 'application/octet-stream',
                },
                expire=PRESIGNED_URL_EXPIRY_SECONDS,
            )
    except Exception as e:
        logger.warning(f'Falha ao gerar presigned URL, fallback para stream: {e}')

    return None


# ─── Views ───

class MyDownloadsView(generics.ListAPIView):
    """
    GET /api/v1/products/downloads/
    Lista todos os downloads digitais do utilizador autenticado.
    """
    serializer_class = MyDownloadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            DigitalDownload.objects
            .filter(user=self.request.user)
            .select_related('product', 'order')
            .order_by('-created_at')
        )


class DownloadTokenView(APIView):
    """
    GET /api/v1/products/downloads/{id}/token/
    Gera um JWT de curta duracao para autorizar o download do ficheiro.
    Rate limit: 5 tokens/minuto por utilizador.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [DownloadTokenThrottle]

    def get(self, request, download_id):
        download = get_object_or_404(
            DigitalDownload.objects.select_related('product'),
            id=download_id,
            user=request.user,
        )

        product = download.product

        # ─── Validacoes ───

        if not product.digital_file:
            return Response(
                {'detail': 'Ficheiro não encontrado. Contacte o suporte.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if download.download_count >= product.download_limit:
            return Response(
                {
                    'detail': 'Limite de downloads atingido.',
                    'downloads_used': download.download_count,
                    'download_limit': product.download_limit,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if download.expires_at and timezone.now() > download.expires_at:
            return Response(
                {
                    'detail': 'O período de download expirou.',
                    'expired_at': download.expires_at.isoformat(),
                },
                status=status.HTTP_410_GONE,
            )

        # ─── Anti-abuso: limite diario ───
        if not _check_daily_abuse(str(request.user.id)):
            return Response(
                {'detail': 'Limite diário de downloads excedido. Tente novamente amanhã.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # ─── Gerar token ───
        token = _generate_download_token(str(download.id), str(request.user.id))

        logger.info(
            f'Token gerado: user={request.user.id} product={product.id} '
            f'count={download.download_count}/{product.download_limit}'
        )

        return Response({
            'token': token,
            'expires_in_seconds': DOWNLOAD_TOKEN_EXPIRY_MINUTES * 60,
            'file_name': product.digital_file.name.split('/')[-1],
            'downloads_remaining': max(0, product.download_limit - download.download_count - 1),
        })


class DownloadFileView(APIView):
    """
    GET /api/v1/products/downloads/{id}/file/?token=JWT
    Valida o token, incrementa contador, serve o ficheiro.
    Nao requer autenticacao Django — o token JWT de download e a autorizacao.
    Em producao (S3): redirect HTTP 302 para presigned URL.
    Em dev (local): FileResponse com streaming.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # Nao requer header Authorization
    throttle_classes = [DownloadFileThrottle]

    def get(self, request, download_id):
        token = request.GET.get('token', '')

        if not token:
            return Response(
                {'detail': 'Token de download em falta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar token JWT e extrair user_id
        token_user_id = _verify_download_token(token, str(download_id))
        if not token_user_id:
            return Response(
                {'detail': 'Token inválido ou expirado. Solicite um novo.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Buscar o download — verificar que pertence ao user do token
        download = get_object_or_404(
            DigitalDownload.objects.select_related('product'),
            id=download_id,
            user_id=token_user_id,
        )

        product = download.product

        if not product.digital_file:
            raise Http404('Ficheiro não encontrado.')

        if download.download_count >= product.download_limit:
            return Response(
                {'detail': 'Limite de downloads atingido.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if download.expires_at and timezone.now() > download.expires_at:
            return Response(
                {'detail': 'O período de download expirou.'},
                status=status.HTTP_410_GONE,
            )

        # ─── Incrementar contador ───
        download.download_count += 1
        download.save(update_fields=['download_count'])

        # ─── Audit log ───
        _log_download(download, request)

        # ─── Servir ficheiro ───
        file_field = product.digital_file
        filename = file_field.name.rsplit('/', 1)[-1]

        # Tenta presigned URL (S3/R2) primeiro
        presigned_url = _get_s3_presigned_url(file_field, filename)
        if presigned_url:
            logger.info(
                f'Download digital: user={request.user.id} product={product.id} '
                f'count={download.download_count}/{product.download_limit} method=S3-redirect'
            )
            return HttpResponse(
                status=302,
                headers={'Location': presigned_url},
            )

        # Fallback: streaming local (desenvolvimento)
        logger.info(
            f'Download digital: user={request.user.id} product={product.id} '
            f'count={download.download_count}/{product.download_limit} method=stream'
        )

        response = FileResponse(
            file_field.open('rb'),
            content_type='application/octet-stream',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['X-Content-Type-Options'] = 'nosniff'

        return response
