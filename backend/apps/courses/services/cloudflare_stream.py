import requests
import jwt
import time
from django.conf import settings

ACCOUNT_ID = getattr(settings, 'CLOUDFLARE_ACCOUNT_ID', '')
API_TOKEN = getattr(settings, 'CLOUDFLARE_API_TOKEN', '')
BASE_URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/stream'
HEADERS = {'Authorization': f'Bearer {API_TOKEN}'}


def create_direct_upload(max_duration_seconds=3600):
    """
    Obtem um URL de upload directo do Cloudflare.
    O frontend usa este URL para enviar o video directamente (TUS protocol).
    """
    response = requests.post(
        BASE_URL,
        headers=HEADERS,
        json={
            'maxDurationSeconds': max_duration_seconds,
        }
    )
    response.raise_for_status()
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


def generate_stream_token(video_uid, max_duration_seconds=7200):
    """
    Gera um token JWT assinado para o player.
    O token expira apos max_duration_seconds (default: 2 horas).
    """
    jwt_secret = getattr(settings, 'CLOUDFLARE_JWT_SECRET', 'default-secret-change-me')
    now = int(time.time())
    payload = {
        'sub': video_uid,
        'kid': jwt_secret[:32],
        'exp': now + max_duration_seconds,
        'iat': now,
        'accessRules': [
            {
                'type': 'ip.src',
                'action': 'allow',
            }
        ]
    }
    token = jwt.encode(payload, jwt_secret, algorithm='HS256')
    return token


def get_stream_url(video_uid):
    """Retorna a URL base do manifesto HLS/DASH para o video."""
    domain = getattr(settings, 'CLOUDFLARE_STREAM_DOMAIN', 'customer-xxx.cloudflarestream.com')
    return f'https://{domain}/{video_uid}/manifest/video.m3u8'
