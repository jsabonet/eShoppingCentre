import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

# Garante que a app Celery é importada juntamente com o Django, para que
# os `shared_task` no processo web usem o broker configurado (Redis) em vez
# do broker AMQP por defeito do Celery.
from .celery import app as celery_app

__all__ = ('celery_app',)
