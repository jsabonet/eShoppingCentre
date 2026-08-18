from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

SITE_NAME = 'eShopping Centre'


def dispatch(task_func, *args):
    """Envia via Celery em produção; síncrono em dev (o console backend mostra o OTP)."""
    if settings.DEBUG:
        task_func(*args)
    else:
        task_func.delay(*args)


def _base_context(**extra):
    context = {
        'site_name': SITE_NAME,
        'logo_url': settings.EMAIL_LOGO_URL,
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
        from_email=settings.DEFAULT_FROM_EMAIL,
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
