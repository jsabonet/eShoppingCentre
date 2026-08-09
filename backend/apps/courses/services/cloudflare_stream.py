import requests
import jwt
import time
from django.conf import settings

ACCOUNT_ID = getattr(settings, 'CLOUDFLARE_ACCOUNT_ID', '')
API_TOKEN = getattr(settings, 'CLOUDFLARE_API_TOKEN', '')
BASE_URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/stream'
HEADERS = {'Authorization': f'Bearer {API_TOKEN}'}


def create_direct_upload(max_duration_seconds=14400):
    """
    Obtem um URL de upload directo do Cloudflare.
    O frontend usa este URL para enviar o video directamente (basic POST upload).
    """
    if not ACCOUNT_ID or not API_TOKEN or 'precisa-gerar' in API_TOKEN:
        raise ValueError('Cloudflare Stream nao configurado. Configure CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no .env')
    response = requests.post(
        f'{BASE_URL}/direct_upload',
        headers=HEADERS,
        json={
            'maxDurationSeconds': max_duration_seconds,
        }
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get('success'):
        message = 'Erro desconhecido ao criar upload URL no Cloudflare Stream.'
        errors = payload.get('errors') or []
        if errors:
            message = '; '.join(error.get('message', str(error)) for error in errors)
        raise ValueError(message)
    data = response.json()['result']
    return {
        'upload_url': data['uploadURL'],
        'video_uid': data['uid'],
    }


def get_video_status(video_uid):
    """Verifica o estado de um video (pending, processing, ready, error)."""
    response = requests.get(f'{BASE_URL}/{video_uid}', headers=HEADERS)
    response.raise_for_status()
    result = response.json()['result']
    return {
        'status': result['status']['state'],
        'ready_to_stream': result.get('readyToStream', False),
        'duration': result.get('duration', 0),
        'thumbnail': result.get('thumbnail', ''),
    }


def delete_video(video_uid):
    """Remove um video do Cloudflare Stream."""
    response = requests.delete(f'{BASE_URL}/{video_uid}', headers=HEADERS)
    response.raise_for_status()
    return True


def generate_stream_token(video_uid, max_duration_seconds=21600, client_ip=None):
    """
    Gera um token JWT assinado para o player.
    O token expira apos max_duration_seconds (default: 6 horas).
    Se client_ip for fornecido, o token so e valido para esse IP.
    """
    jwt_secret = getattr(settings, 'CLOUDFLARE_JWT_SECRET', 'default-secret-change-me')
    now = int(time.time())

    # Restringir ao IP do cliente (anti-partilha de token)
    if client_ip:
        access_rules = [
            {
                'type': 'ip.src',
                'ip': [client_ip],
                'action': 'allow',
            }
        ]
    else:
        access_rules = [
            {
                'type': 'any',
                'action': 'allow',
            }
        ]

    payload = {
        'sub': video_uid,
        'kid': jwt_secret[:32],
        'exp': now + max_duration_seconds,
        'iat': now,
        'accessRules': access_rules,
    }
    token = jwt.encode(payload, jwt_secret, algorithm='HS256')
    return token


def get_stream_url(video_uid):
    """Retorna a URL base do manifesto HLS/DASH para o video."""
    domain = getattr(settings, 'CLOUDFLARE_STREAM_DOMAIN', 'customer-xxx.cloudflarestream.com')
    return f'https://{domain}/{video_uid}/manifest/video.m3u8'
