import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

SITE_NAME = 'e-Shopping Centre'
logger = logging.getLogger(__name__)


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
    """Devolve o URL público do logótipo; vazio → o template usa o wordmark em texto."""
    return getattr(settings, 'EMAIL_LOGO_URL', '')


def _base_context(**extra):
    context = {
        'site_name': SITE_NAME,
        'logo_src': _logo_src(),
        'frontend_url': settings.SITE_URL,
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


@shared_task
def delete_stale_unverified_users():
    """Apaga contas não verificadas após N dias (limpeza automática)."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    days = getattr(settings, 'UNVERIFIED_ACCOUNT_DAYS', 7)
    cutoff = timezone.now() - timedelta(days=days)

    stale = User.objects.filter(is_verified=False, is_staff=False, date_joined__lte=cutoff)
    deleted = 0
    for user in stale:
        try:
            user.delete()
            deleted += 1
        except Exception as exc:
            logger.warning(f'Não foi possível apagar {user.email}: {exc}')
    logger.info(f'Contas não verificadas removidas: {deleted}')


@shared_task
def send_verification_reminders():
    """Envia lembrete de verificação a contas não verificadas criadas há ~24h."""
    from django.contrib.auth import get_user_model
    from . import otp_service

    User = get_user_model()
    now = timezone.now()
    start = now - timedelta(hours=48)
    end = now - timedelta(hours=20)

    for user in User.objects.filter(is_verified=False, date_joined__gte=start, date_joined__lte=end):
        try:
            code = otp_service.create_otp(user, 'verification')
            send_verification_email(user.email, code)
        except Exception as exc:
            logger.warning(f'Falha ao enviar lembrete para {user.email}: {exc}')
