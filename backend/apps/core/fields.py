import base64
import os
from django.db import models
from cryptography.fernet import Fernet
from django.conf import settings


def get_fernet():
    key = getattr(settings, 'MESSAGE_ENCRYPTION_KEY', None)
    if not key:
        # Fallback: derive from SECRET_KEY (not ideal but functional)
        from django.conf import settings as s
        raw = s.SECRET_KEY.encode()[:32]
        key = base64.urlsafe_b64encode(raw.ljust(32, b'\x00')[:32]).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedTextField(models.TextField):
    """Campo que armazena dados encriptados com AES (Fernet)."""

    def get_prep_value(self, value):
        if value is None:
            return None
        if isinstance(value, str):
            f = get_fernet()
            return f.encrypt(value.encode()).decode()
        return value

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        try:
            f = get_fernet()
            return f.decrypt(value.encode() if isinstance(value, str) else value).decode()
        except Exception:
            return '[mensagem encriptada — impossivel de desencriptar]'

    def to_python(self, value):
        if value is None or isinstance(value, str):
            return value
        try:
            f = get_fernet()
            return f.decrypt(value.encode() if isinstance(value, str) else value).decode()
        except Exception:
            return value
