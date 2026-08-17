"""Helpers para armazenar o refresh token num cookie httpOnly (anti-XSS)."""
from django.conf import settings
from rest_framework_simplejwt import settings as jwt_settings

REFRESH_COOKIE_NAME = 'refresh_token'


def _max_age():
    return int(jwt_settings.api_settings.REFRESH_TOKEN_LIFETIME.total_seconds())


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=str(refresh_token),
        max_age=_max_age(),
        httponly=True,
        samesite='Lax',
        secure=not settings.DEBUG,
        path='/',
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/')
    return response
