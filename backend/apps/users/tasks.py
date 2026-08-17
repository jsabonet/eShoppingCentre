from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


def dispatch(task_func, *args):
    """Envia via Celery em produção; síncrono em dev (o console backend mostra o OTP)."""
    if settings.DEBUG:
        task_func(*args)
    else:
        task_func.delay(*args)


@shared_task
def send_verification_email(email: str, code: str) -> None:
    send_mail(
        subject='Verifica o teu email — eShopping Centre',
        message=(
            'Olá!\n\n'
            f'O teu código de verificação é: {code}\n\n'
            'O código expira em 10 minutos.\n\n'
            'Se não criaste esta conta, ignora este email.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


@shared_task
def send_password_reset_email(email: str, code: str) -> None:
    send_mail(
        subject='Recuperação de password — eShopping Centre',
        message=(
            'Olá!\n\n'
            'Recebemos um pedido para redefinir a tua password.\n'
            f'O teu código de recuperação é: {code}\n\n'
            'O código expira em 10 minutos.\n\n'
            'Se não foste tu, ignora este email.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
