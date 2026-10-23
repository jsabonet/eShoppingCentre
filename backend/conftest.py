import os

import pytest

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')


@pytest.fixture(autouse=True)
def _use_locmem_email(settings):
    """Nunca enviar emails reais durante os testes."""
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
