from celery import shared_task
from django.utils import timezone
from datetime import timedelta

# Dias após a entrega para aprovar automaticamente a comissão (janela de devolução)
APPROVE_AFTER_DAYS = 7


@shared_task
def auto_approve_affiliate_commissions():
    """
    Aprova comissões 'pending' de encomendas entregues há mais de
    APPROVE_AFTER_DAYS dias (após a janela de devolução) e actualiza os tiers.
    """
    from django.db.models import F, Q
    from .models import AffiliateCommission, AffiliateProfile
    from .services import update_tier
    from apps.notifications import email_service

    cutoff = timezone.now() - timedelta(days=APPROVE_AFTER_DAYS)
    pending = AffiliateCommission.objects.filter(
        status='pending',
        order__status='delivered',
    ).filter(
        Q(order__delivered_at__lte=cutoff) | Q(order__confirmed_at__lte=cutoff)
    ).select_related('affiliate')

    affected_ids = set()
    count = 0
    for comm in pending:
        comm.status = 'approved'
        comm.save(update_fields=['status'])
        AffiliateProfile.objects.filter(pk=comm.affiliate_id).update(
            total_commission=F('total_commission') + comm.amount
        )
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=comm.affiliate.user,
            title='Comissão aprovada',
            message=f'A sua comissão de {comm.amount} MZN foi aprovada.',
            notification_type='affiliate',
            link='/affiliate/earnings',
        )
        try:
            email_service.send_affiliate_commission_email(str(comm.id))
        except Exception:
            pass
        affected_ids.add(comm.affiliate_id)
        count += 1

    for pid in affected_ids:
        profile = AffiliateProfile.objects.filter(pk=pid).first()
        if profile:
            update_tier(profile)

    return f'{count} comissão(ões) de afiliado aprovada(s) automaticamente.'
