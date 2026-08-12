from decimal import Decimal

TIER_MULTIPLIERS = {
    'basic': Decimal('1.0'),
    'silver': Decimal('1.25'),
    'gold': Decimal('1.5'),
}

TIER_SALES_THRESHOLDS = {
    'gold': 100,
    'silver': 25,
}


def get_tier_multiplier(profile):
    """Multiplicador de comissão conforme o tier do afiliado."""
    return TIER_MULTIPLIERS.get(profile.commission_tier, Decimal('1.0'))


def update_tier(profile):
    """Actualiza o tier do afiliado com base no volume de vendas."""
    sales = profile.total_sales
    tier = 'basic'
    if sales >= TIER_SALES_THRESHOLDS['gold']:
        tier = 'gold'
    elif sales >= TIER_SALES_THRESHOLDS['silver']:
        tier = 'silver'
    if profile.commission_tier != tier:
        profile.commission_tier = tier
        profile.save(update_fields=['commission_tier'])
    return tier


def reject_commissions_for_order(order, reason=''):
    """
    Rejeita as comissões pendentes/aprovadas de uma encomenda
    (usado em cancelamento/reembolso) e decrementa o total do afiliado.
    """
    from django.db.models import F
    from .models import AffiliateCommission, AffiliateProfile

    commissions = AffiliateCommission.objects.filter(
        order=order, status__in=['pending', 'approved']
    )

    for comm in commissions:
        was_approved = comm.status == 'approved'
        comm.status = 'rejected'
        comm.rejection_reason = reason or 'Reversão automática'
        comm.save(update_fields=['status', 'rejection_reason'])

        if was_approved:
            AffiliateProfile.objects.filter(pk=comm.affiliate_id).update(
                total_commission=F('total_commission') - comm.amount
            )
