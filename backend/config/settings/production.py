from .base import *

DEBUG = False

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='').split(',')

# ─── Security ───
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = [f'https://{host.strip()}' for host in ALLOWED_HOSTS if host.strip()]
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ─── Cloudflare R2 (apenas para ficheiros digitais) ───
# O armazenamento default (imagens, logos, banners) continua FileSystemStorage local.
# Apenas o campo Product.digital_file usa R2 via DigitalFileStorage.
R2_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
R2_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')
R2_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='')
R2_ENDPOINT_URL = config('AWS_S3_ENDPOINT_URL', default='')
R2_REGION = config('AWS_S3_REGION_NAME', default='auto')

# ─── Logging ───
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ─── Email (Resend via django-anymail) ───
EMAIL_BACKEND = 'anymail.backends.resend.EmailBackend'
