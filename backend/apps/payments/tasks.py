import logging
from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def reconcile_vpay_pending_payments(batch_size=100):
    """Poll open VPay attempts server-side so webhook loss does not strand payments."""
    from apps.payments.models import PaymentTransaction
    from apps.payments.services.vpay import VPayClient
    from apps.payments.views import (
        _amount_matches,
        _attempt_orders,
        _confirm_payment,
        _mark_attempt_failed,
    )

    retry_before = timezone.now() - timedelta(minutes=5)
    attempts = PaymentTransaction.objects.filter(
        provider='vpay',
        status__in=['pending', 'processing'],
    ).filter(
        Q(last_checked_at__isnull=True) | Q(last_checked_at__lte=retry_before),
    ).order_by('last_checked_at', 'created_at')[:batch_size]

    checked = 0
    for candidate in attempts:
        with transaction.atomic():
            attempt = PaymentTransaction.objects.select_for_update().get(pk=candidate.pk)
            if attempt.status not in ('pending', 'processing'):
                continue
            if attempt.last_checked_at and attempt.last_checked_at > retry_before:
                continue
            attempt.last_checked_at = timezone.now()
            attempt.save(update_fields=['last_checked_at', 'updated_at'])
            gateway_order_id = attempt.gateway_order_id

        if not gateway_order_id:
            logger.error(
                'VPay payment creation outcome is unknown for source %s; manual reconciliation required.',
                attempt.source_id,
            )
            checked += 1
            continue

        result = VPayClient().get_order_status(gateway_order_id)
        checked += 1
        if not result['ok']:
            logger.warning('VPay reconciliation failed for order %s.', gateway_order_id)
            continue

        data = result['data']
        if data.get('orderId') != gateway_order_id:
            logger.error('VPay returned mismatched order id for %s.', gateway_order_id)
            continue

        if data.get('status') == 'paid':
            orders = _attempt_orders(attempt)
            total = sum((order.total for order in orders), Decimal('0.00'))
            if not orders:
                logger.error('VPay order %s has no linked local orders.', gateway_order_id)
                continue
            reported_currency = data.get('currency')
            if (
                attempt.currency != 'MZN'
                or not _amount_matches(data.get('amount'), total)
                or (
                    reported_currency is not None
                    and reported_currency != attempt.currency
                )
            ):
                logger.error(
                    'VPay reconciliation amount/currency mismatch for order %s.',
                    gateway_order_id,
                )
                continue
            _confirm_payment(
                gateway_order_id,
                {**data, 'currency': attempt.currency},
                delivery_id='server-reconciliation',
            )
        elif data.get('status') in ('failed', 'cancelled'):
            _mark_attempt_failed(gateway_order_id, data['status'])
        elif data.get('status') == 'processing' and attempt.status == 'pending':
            PaymentTransaction.objects.filter(
                pk=attempt.pk,
                status='pending',
            ).update(status='processing')

    return f'{checked} tentativa(s) VPay reconciliada(s).'
