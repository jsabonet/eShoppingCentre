"""Serviço de códigos de uso único (OTP) para verificação de email e recuperação de password."""
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from .models import OneTimeCode

OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = {
    'verification': 3,
    'password_reset': 5,
}


def _generate_code() -> str:
    return f'{secrets.randbelow(1_000_000):06d}'


def create_otp(user, purpose: str) -> str:
    """Gera e guarda um OTP (guardado como hash). Devolve o código em claro para envio."""
    # Invalida códigos anteriores do mesmo tipo ainda não usados
    OneTimeCode.objects.filter(user=user, purpose=purpose, is_used=False).delete()

    code = _generate_code()
    OneTimeCode.objects.create(
        user=user,
        code_hash=make_password(code),
        purpose=purpose,
        expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    return code


def verify_otp(user, purpose: str, code: str):
    """Valida um OTP. Devolve (True, None) ou (False, mensagem)."""
    otp = OneTimeCode.objects.filter(
        user=user,
        purpose=purpose,
        is_used=False,
        expires_at__gt=timezone.now(),
    ).order_by('-created_at').first()

    if otp is None:
        return False, 'Código inválido ou expirado.'

    max_attempts = OTP_MAX_ATTEMPTS.get(purpose, 3)
    if otp.attempts >= max_attempts:
        return False, 'Código inválido ou expirado.'

    otp.attempts += 1
    otp.save(update_fields=['attempts'])

    if not check_password(code, otp.code_hash):
        remaining = max_attempts - otp.attempts
        return False, f'Código incorreto. Tentativas restantes: {remaining}.'

    otp.is_used = True
    otp.save(update_fields=['is_used'])
    return True, None


def invalidate_otps(user, purpose: str) -> None:
    OneTimeCode.objects.filter(user=user, purpose=purpose, is_used=False).delete()
