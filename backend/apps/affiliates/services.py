from decimal import Decimal
from django.db import transaction

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


@transaction.atomic
def approve_commission(commission):
    """Approves a commission, applying outstanding clawbacks before crediting cash."""
    from django.db.models import F
    from .models import AffiliateCommission, AffiliateProfile

    commission = AffiliateCommission.objects.select_for_update().select_related(
        'affiliate__user', 'order',
    ).get(pk=commission.pk)
    if commission.status != 'pending':
        return commission

    payable = commission.amount - commission.reversed_amount
    if payable <= 0:
        commission.status = 'rejected'
        commission.rejection_reason = 'Comissão anulada por reembolso'
        commission.save(update_fields=['status', 'rejection_reason'])
        return commission

    from apps.wallet.models import Wallet
    from apps.wallet.services import credit, debit, get_wallet
    wallet = Wallet.objects.select_for_update().get(
        pk=get_wallet(commission.affiliate.user).pk,
    )
    available_before = max(wallet.payout_balance - wallet.reserved_balance, Decimal('0.00'))
    credit(
        wallet,
        payable,
        kind='payout',
        ref_type='affiliate_commission',
        ref_id=commission.id,
        description=f'Comissão de afiliado (encomenda {commission.order.order_number})',
        txn_type='affiliate_commission',
        idempotency_key=f'affiliate_commission:{commission.id}:credit',
    )
    wallet.refresh_from_db(fields=['payout_balance', 'reserved_balance'])

    outstanding = payable
    debts = AffiliateCommission.objects.select_for_update().filter(
        affiliate=commission.affiliate,
        unrecovered_amount__gt=0,
    ).exclude(pk=commission.pk).order_by('created_at', 'pk')
    for debt in debts:
        recovered = min(outstanding, debt.unrecovered_amount)
        debt.unrecovered_amount -= recovered
        debt.save(update_fields=['unrecovered_amount'])
        outstanding -= recovered
        if outstanding <= 0:
            break

    recovered_total = payable - outstanding
    available_after_credit = max(
        wallet.payout_balance - wallet.reserved_balance - available_before,
        Decimal('0.00'),
    )
    recovered_total = min(recovered_total, available_after_credit)
    if recovered_total > 0:
        debit(
            wallet,
            recovered_total,
            kind='payout',
            ref_type='affiliate_commission_refund',
            ref_id=commission.id,
            description='Recuperação de saldo de comissão previamente revertida',
            txn_type='affiliate_commission',
            idempotency_key=f'affiliate_commission:{commission.id}:debt-recovery',
        )
    commission.status = 'approved'
    commission.save(update_fields=['status'])
    AffiliateProfile.objects.filter(pk=commission.affiliate_id).update(
        total_commission=F('total_commission') + payable,
    )
    return commission


@transaction.atomic
def reverse_commission_amount(commission, amount, *, reversal_id, reason):
    """Records a commission clawback without blocking a buyer refund on low balance."""
    from django.db.models import F
    from .models import AffiliateCommission, AffiliateProfile

    commission = AffiliateCommission.objects.select_for_update().select_related(
        'affiliate__user',
    ).get(pk=commission.pk)
    reversible = max(commission.amount - commission.reversed_amount, Decimal('0.00'))
    delta = min(Decimal(str(amount)), reversible)
    if delta <= 0:
        return commission

    if commission.status in ('approved', 'paid'):
        from apps.wallet.models import Wallet
        from apps.wallet.services import debit, get_wallet
        wallet = Wallet.objects.select_for_update().get(pk=get_wallet(commission.affiliate.user).pk)
        available = max(wallet.payout_balance - wallet.reserved_balance, Decimal('0.00'))
        recovered = min(delta, available)
        if recovered:
            debit(
                wallet, recovered, kind='payout',
                ref_type='affiliate_commission_refund',
                ref_id=commission.id,
                description=reason,
                txn_type='affiliate_commission',
                idempotency_key=f'affiliate_commission:{commission.id}:reverse:{reversal_id}',
            )
        commission.unrecovered_amount += delta - recovered
        AffiliateProfile.objects.filter(pk=commission.affiliate_id).update(
            total_commission=F('total_commission') - delta,
        )
    commission.reversed_amount += delta
    commission.save(update_fields=['reversed_amount', 'unrecovered_amount'])
    return commission


def reject_commissions_for_order(order, reason=''):
    """
    Rejeita as comissões pendentes/aprovadas de uma encomenda
    (usado em cancelamento/reembolso) e decrementa o total do afiliado.
    """
    from .models import AffiliateCommission

    commissions = AffiliateCommission.objects.filter(
        order=order, status__in=['pending', 'approved', 'paid']
    ).select_related('affiliate__user', 'product')

    for comm in commissions:
        with transaction.atomic():
            comm = AffiliateCommission.objects.select_for_update().select_related(
                'affiliate__user', 'product',
            ).get(pk=comm.pk)
            if comm.status not in ('pending', 'approved', 'paid'):
                continue
            outstanding = Decimal('0.00')
            if comm.status in ('approved', 'paid'):
                outstanding = comm.amount - comm.reversed_amount
                if outstanding > 0:
                    comm = reverse_commission_amount(
                        comm, outstanding,
                        reversal_id=f'cancel-{order.id}',
                        reason=f'Reversão da comissão da encomenda {order.order_number}',
                    )
            comm.status = 'rejected'
            comm.rejection_reason = reason or 'Reversão automática'
            comm.save(update_fields=['status', 'rejection_reason'])
            if comm.conversion_recorded:
                _reverse_conversion(comm)


@transaction.atomic
def record_order_conversions(order):
    """Count affiliate sales only after payment, once for each eligible store order."""
    from django.db.models import F
    from .models import AffiliateCommission, AffiliateProfile

    commissions = AffiliateCommission.objects.filter(
        order=order, status='pending', conversion_recorded=False,
    ).select_related('affiliate', 'product')
    for commission in commissions:
        commission = AffiliateCommission.objects.select_for_update().get(pk=commission.pk)
        if commission.status != 'pending' or commission.conversion_recorded:
            continue
        commission.conversion_recorded = True
        commission.save(update_fields=['conversion_recorded'])
        AffiliateProfile.objects.filter(pk=commission.affiliate_id).update(
            total_sales=F('total_sales') + 1,
        )
        if commission.affiliate_link_id:
            from .models import AffiliateLink
            AffiliateLink.objects.filter(pk=commission.affiliate_link_id).update(
                conversions=F('conversions') + 1,
            )
        profile = commission.affiliate
        profile.refresh_from_db(fields=['total_sales', 'commission_tier'])
        update_tier(profile)


def _reverse_conversion(commission):
    from django.db.models import F
    from .models import AffiliateProfile

    AffiliateProfile.objects.filter(
        pk=commission.affiliate_id, total_sales__gt=0,
    ).update(total_sales=F('total_sales') - 1)
    if commission.affiliate_link_id:
        from .models import AffiliateLink
        AffiliateLink.objects.filter(
            pk=commission.affiliate_link_id,
            conversions__gt=0,
        ).update(conversions=F('conversions') - 1)
    profile = AffiliateProfile.objects.filter(pk=commission.affiliate_id).first()
    if profile:
        profile.refresh_from_db(fields=['total_sales', 'commission_tier'])
        update_tier(profile)


@transaction.atomic
def reverse_commissions_for_refund(order, refund_amount, *, refund_id):
    """Claw back the proportional commission for each partial refund."""
    from django.db.models import Sum
    from .models import AffiliateCommission
    from apps.wallet.models import WalletTransaction

    if not order.total:
        return
    refunded_total = WalletTransaction.objects.filter(
        type='refund',
        reference_type='order',
        reference_id=order.id,
        amount__gt=0,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    refund_ratio = min(refunded_total / order.total, Decimal('1'))

    for item in AffiliateCommission.objects.filter(
        order=order, status__in=['pending', 'approved', 'paid'],
    ).select_related('affiliate__user'):
        with transaction.atomic():
            commission = AffiliateCommission.objects.select_for_update().get(pk=item.pk)
            target_reversal = (commission.amount * refund_ratio).quantize(Decimal('0.01'))
            delta = target_reversal - commission.reversed_amount
            if delta <= 0:
                continue
            commission = reverse_commission_amount(
                commission, delta,
                reversal_id=refund_id,
                reason=f'Reversão parcial de comissão (reembolso {refund_id})',
            )
            if refund_ratio >= 1:
                commission.status = 'rejected'
                commission.rejection_reason = 'Encomenda totalmente reembolsada'
                commission.save(update_fields=['status', 'rejection_reason'])
            if refund_ratio >= 1 and commission.conversion_recorded:
                _reverse_conversion(commission)
