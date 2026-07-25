from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.conf import settings

User = settings.AUTH_USER_MODEL


@receiver(pre_save, sender=User)
def sync_admin_permissions(sender, instance, **kwargs):
    """
    Sincroniza is_staff e is_superuser com o campo roles.
    Se roles contém 'admin', o utilizador deve ter is_staff=True.
    Caso contrário, is_staff permanece como está (pode ser definido via Django admin).
    """
    if hasattr(instance, 'roles') and isinstance(instance.roles, list):
        if 'admin' in instance.roles:
            instance.is_staff = True
            # Apenas superuser se definido explicitamente ou via Django admin


@receiver(post_save, sender=User)
def create_user_wallet(sender, instance, created, **kwargs):
    """Cria automaticamente uma carteira para cada novo utilizador"""
    if created:
        from apps.wallet.models import Wallet
        Wallet.objects.get_or_create(user=instance)
