from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

User = settings.AUTH_USER_MODEL


@receiver(post_save, sender=User)
def create_user_wallet(sender, instance, created, **kwargs):
    """Cria automaticamente uma carteira para cada novo utilizador"""
    if created:
        from apps.wallet.models import Wallet
        Wallet.objects.get_or_create(user=instance)
