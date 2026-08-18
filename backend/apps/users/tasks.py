import base64
import logging
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

SITE_NAME = 'e-Shopping Centre'
logger = logging.getLogger(__name__)

_LOGO_FILE = Path(settings.BASE_DIR) / 'apps' / 'users' / 'static' / 'email-logo.png'


def dispatch(task_func, *args):
    """Envia via Celery em produção; síncrono em dev (o console backend mostra o OTP).

    Se o broker (Redis) estiver indisponível, cai para envio síncrono para
    nunca bloquear o pedido HTTP nem perder o email.
    """
    if settings.DEBUG:
        try:
            task_func(*args)
        except Exception:
            logger.exception('Falha ao enviar email (dev).')
        return
    try:
        task_func.delay(*args)
    except Exception:
        logger.exception('Celery indisponível — a enviar email de forma síncrona.')
        try:
            task_func(*args)
        except Exception:
            logger.exception('Falha no envio síncrono do email.')


def _logo_src() -> str:
    """Devolve o src do logótipo: URL pública se definida, senão base64 embutido."""
    url = getattr(settings, 'EMAIL_LOGO_URL', '')
    if url:
        return url
    try:
        if _LOGO_FILE.exists():
            data = base64.b64encode(_LOGO_FILE.read_bytes()).decode('ascii')
            return f'data:image/png;base64,{data}'
    except Exception:
        pass
    return ''


def _base_context(**extra):
    context = {
        'site_name': SITE_NAME,
        'logo_src': _logo_src(),
        'frontend_url': settings.FRONTEND_URL,
        'support_email': settings.DEFAULT_FROM_EMAIL,
        'year': timezone.now().year,
    }
    context.update(extra)
    return context


def _send_templated(subject, template_name, recipient, text_message, context):
    context['subject'] = subject
    html = render_to_string(f'emails/{template_name}', context)
    send_mail(
        subject=subject,
        message=text_message,
        from_email=f'{SITE_NAME} <{settings.DEFAULT_FROM_EMAIL}>',
        recipient_list=[recipient],
        html_message=html,
        fail_silently=False,
    )


@shared_task
def send_verification_email(email: str, code: str) -> None:
    _send_templated(
        subject=f'Verifica o teu email — {SITE_NAME}',
        template_name='verification.html',
        recipient=email,
        text_message=f'Olá! O teu código de verificação é: {code}. Expira em 10 minutos.',
        context=_base_context(code=code),
    )


@shared_task
def send_password_reset_email(email: str, code: str) -> None:
    _send_templated(
        subject=f'Recuperação de password — {SITE_NAME}',
        template_name='password_reset.html',
        recipient=email,
        text_message=f'Olá! O teu código de recuperação é: {code}. Expira em 10 minutos.',
        context=_base_context(code=code),
    )


@shared_task
def send_welcome_email(email: str, first_name: str = '') -> None:
    _send_templated(
        subject=f'Bem-vindo à {SITE_NAME}!',
        template_name='welcome.html',
        recipient=email,
        text_message='Bem-vindo! A tua conta foi verificada com sucesso.',
        context=_base_context(first_name=first_name),
    )
