from decimal import Decimal

from django.db.models import Sum


def paid_order_revenue(orders):
    """Return paid order totals less buyer-wallet refunds recorded for those orders."""
    from apps.wallet.models import WalletTransaction

    gross = orders.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
    refunds = WalletTransaction.objects.filter(
        type='refund',
        reference_type='order',
        reference_id__in=orders.values('id'),
        amount__gt=0,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    return gross - refunds
