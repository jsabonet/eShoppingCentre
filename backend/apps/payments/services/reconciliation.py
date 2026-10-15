"""Reconciliação de pagamentos — rede de segurança para webhooks perdidos.

O webhook é o caminho normal de fecho de um pagamento, mas não é fiável: pode
atrasar-se, ser rejeitado por causa da assinatura, ou nunca chegar (serviço em
baixo, URL do webhook alterada, rede falhou). Nesse caso a encomenda ficaria
``pending`` para sempre e o comprador teria pago sem receber.

Este módulo consulta o gateway directamente para as transacções que continuam
pendentes depois de um período de tolerância e fecha-as de forma idempotente
através de ``complete_payment`` — a mesma função que o webhook usa, pelo que não
há dois caminhos de liquidação diferentes.

É accionado por:
  * ``apps.payments.tasks.reconcile_pending_payments`` (Celery beat, periódico);
  * ``POST /api/v1/payments/reconcile/`` (staff, uma encomenda concreta);
  * ``manage.py reconcile_payments`` (uso manual/cron).
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.payments.services.completion import (
    complete_payment,
    mark_transaction_completed,
    mark_transaction_failed,
)
from apps.payments.services.references import (
    KEY_PREFIX,
    idempotency_key,
    merchant_reference,
    resolve_orders,
)
from apps.payments.services.zumbopay import SUPPORTED_CHANNELS, ZumbopayClient

logger = logging.getLogger(__name__)

#: Estados que o gateway devolve para um pagamento já liquidado. A lista é
#: deliberadamente tolerante: a documentação pública mostra ``active`` na
#: criação mas não enumera todos os estados possíveis.
STATUS_COMPLETED = frozenset({'completed', 'paid', 'succeeded', 'success', 'settled', 'approved'})

#: Estados que significam pagamento impossível. ``refunded`` fica de fora de
#: propósito — um reembolso pressupõe que o pagamento foi aceite, e não pode ser
#: tratado como falha.
STATUS_FAILED = frozenset({'failed', 'declined', 'cancelled', 'canceled', 'expired', 'rejected'})

DEFAULT_MIN_AGE_MINUTES = 5
DEFAULT_MAX_AGE_HOURS = 48
DEFAULT_BATCH = 50


def map_gateway_status(raw):
    """Traduz o estado do gateway para o vocabulário interno.

    Um estado desconhecido devolve ``pending``: nunca se assume que um pagamento
    foi feito sem uma confirmação explícita.
    """
    value = str(raw or '').strip().lower()
    if value in STATUS_COMPLETED:
        return 'completed'
    if value in STATUS_FAILED:
        return 'failed'
    return 'pending'


def _setting_int(name, default):
    try:
        return int(getattr(settings, name, default))
    except (TypeError, ValueError):
        return default


def reconcile_checkout(reference, *, client=None):
    """Verifica junto do gateway o estado real de um checkout e fecha-o.

    Devolve um dicionário com o que aconteceu, seguro para devolver a um admin::

        {'reference', 'gateway_reference', 'gateway_status', 'status', 'checked',
         'orders', 'completed', 'failed', 'error'}

    ``checked`` é ``True`` só quando o gateway respondeu — um erro de rede não
    altera nada e está sempre explícito em ``error``.
    """
    result = {
        'reference': reference,
        'gateway_reference': '',
        'gateway_status': '',
        'status': '',
        'checked': False,
        'orders': [],
        'completed': [],
        'failed': [],
        'error': '',
    }

    orders = resolve_orders(reference)
    txn = _find_transaction(reference, orders)
    if not orders.exists() and txn is not None and txn.order_id:
        # A encomenda pode apontar para uma tentativa de pagamento mais recente;
        # a transacção ainda sabe a que encomenda pertence.
        orders = Order.objects.filter(pk=txn.order_id)

    if not orders.exists():
        result['error'] = 'Encomenda não encontrada para esta referência.'
        return result

    result['orders'] = [o.order_number for o in orders]

    client = client or ZumbopayClient()
    if not client.api_key:
        result['error'] = 'Gateway de pagamento não configurado.'
        return result

    gateway_reference = (txn.provider_transaction_id if txn else '') or reference
    result['gateway_reference'] = gateway_reference

    response = client.get_payment(gateway_reference)
    if not response['ok']:
        result['error'] = response['message'] or 'Erro ao consultar o pagamento no gateway.'
        return result

    data = response['data'] or {}
    raw_status = data.get('status') or data.get('payment_status') or ''
    status = 'completed' if data.get('paid') is True else map_gateway_status(raw_status)

    result['checked'] = True
    result['gateway_status'] = str(raw_status)
    result['status'] = status

    if status == 'pending':
        return result

    idem_key = txn.idempotency_key if txn and txn.idempotency_key else idempotency_key(reference)
    provider_response = {**data, 'source': 'reconciliation'}

    if status == 'completed':
        amount = sum((o.total for o in orders), Decimal('0.00'))
        mark_transaction_completed(
            idem_key, gateway_reference, provider_response=provider_response, amount=amount,
        )
        for order in orders:
            _, created = complete_payment(
                order.id,
                provider='zumbopay',
                provider_transaction_id=gateway_reference,
                provider_response=provider_response,
            )
            if created:
                result['completed'].append(order.order_number)
        if result['completed']:
            logger.info(
                'Reconciliação: o gateway confirma o pagamento de %s (referência %s).',
                result['completed'], reference,
            )
        return result

    # status == 'failed'
    mark_transaction_failed(
        idem_key=idem_key,
        gateway_reference=gateway_reference,
        provider_response=provider_response,
        error_message=f'Pagamento falhado no gateway ({raw_status}).',
    )
    for order in orders:
        if order.payment_status == 'pending':
            order.payment_status = 'failed'
            order.save(update_fields=['payment_status', 'updated_at'])
            result['failed'].append(order.order_number)
    logger.warning('Reconciliação: o gateway reporta falha em %s (referência %s).',
                   result['failed'], reference)
    return result


def _find_transaction(reference, orders):
    """Transacção do checkout, pela chave de idempotência ou pelas encomendas."""
    txn = PaymentTransaction.objects.filter(idempotency_key=idempotency_key(reference)).first()
    if txn is None:
        txn = PaymentTransaction.objects.filter(
            provider='zumbopay', order__in=orders, status='pending',
        ).order_by('-created_at').first()
    return txn


def _stale_references(*, min_age_minutes, max_age_hours, limit):
    """Referências de checkout pendentes há tempo suficiente para valer a pena verificar.

    Devolve ``(referências, quantas ficaram fora do prazo)``. O limite superior de
    idade evita andar a consultar para sempre ligações de pagamento abandonadas
    — passado esse prazo a encomenda fica pendente para decisão humana.
    """
    now = timezone.now()
    fresh_after = now - timedelta(minutes=min_age_minutes)
    oldest_allowed = now - timedelta(hours=max_age_hours)

    references, seen, too_old = [], set(), 0

    def add(reference, moment):
        nonlocal too_old
        if not reference or reference in seen:
            return False
        if moment < oldest_allowed:
            too_old += 1
            return False
        seen.add(reference)
        references.append(reference)
        return len(references) >= limit

    pending_txns = PaymentTransaction.objects.filter(
        provider='zumbopay',
        status='pending',
        created_at__lte=fresh_after,
        idempotency_key__startswith=KEY_PREFIX,
    ).order_by('created_at').values_list('idempotency_key', 'created_at')[:limit * 4]

    for key, created_at in pending_txns:
        if add(merchant_reference(key), created_at):
            return references, too_old

    # Rede de segurança para encomendas sem transacção associada (por exemplo se
    # o registo do ledger se perdeu): basta a referência gravada na encomenda.
    pending_orders = Order.objects.filter(
        payment_status='pending',
        payment_method__in=SUPPORTED_CHANNELS,
        payment_id__gt='',
        updated_at__lte=fresh_after,
    ).order_by('updated_at').values_list('payment_id', 'updated_at')[:limit * 4]

    for reference, updated_at in pending_orders:
        if add(reference, updated_at):
            break

    return references, too_old


def reconcile_stale_payments(*, min_age_minutes=None, max_age_hours=None, limit=None, client=None):
    """Reconcilia em lote os pagamentos pendentes. Devolve um resumo."""
    min_age_minutes = (_setting_int('ZUMBOPAY_RECONCILE_MIN_AGE_MINUTES', DEFAULT_MIN_AGE_MINUTES)
                       if min_age_minutes is None else min_age_minutes)
    max_age_hours = (_setting_int('ZUMBOPAY_RECONCILE_MAX_AGE_HOURS', DEFAULT_MAX_AGE_HOURS)
                     if max_age_hours is None else max_age_hours)
    limit = _setting_int('ZUMBOPAY_RECONCILE_BATCH', DEFAULT_BATCH) if limit is None else limit

    summary = {
        'candidates': 0,
        'checked': 0,
        'pending': 0,
        'completed': 0,
        'failed': 0,
        'errors': 0,
        'too_old': 0,
        'orders_completed': [],
        'orders_failed': [],
        'error': '',
    }

    client = client or ZumbopayClient()
    if not client.api_key:
        summary['error'] = 'Gateway de pagamento não configurado.'
        return summary

    references, too_old = _stale_references(
        min_age_minutes=min_age_minutes, max_age_hours=max_age_hours, limit=limit,
    )
    summary['candidates'] = len(references)
    summary['too_old'] = too_old

    for reference in references:
        try:
            result = reconcile_checkout(reference, client=client)
        except Exception:
            # Uma referência problemática não pode travar o lote inteiro.
            logger.exception('Reconciliação falhou para a referência %s.', reference)
            summary['errors'] += 1
            continue

        if result['error']:
            summary['errors'] += 1
            logger.warning('Reconciliação de %s sem resultado: %s', reference, result['error'])
            continue

        summary['checked'] += 1
        if result['status'] == 'completed':
            summary['completed'] += 1
            summary['orders_completed'].extend(result['completed'])
        elif result['status'] == 'failed':
            summary['failed'] += 1
            summary['orders_failed'].extend(result['failed'])
        else:
            summary['pending'] += 1

    return summary
