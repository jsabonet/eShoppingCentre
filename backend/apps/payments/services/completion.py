"""Conclusão idempotente de pagamento — fecha o elo W0 do circuito de dinheiro.

Quando o gateway (ZumboPay) confirma o pagamento via webhook, este módulo mapeia
o payload para a(s) encomenda(s), marca `payment_status='completed'` de forma
idempotente e despoleta a liquidação do dinheiro (`settle_payment`), que credita o
vendedor (digital/curso) ou retém em escrow (físico).

Aqui vive também o registo no ledger (`PaymentTransaction`), usado pelo webhook
e pela reconciliação — as duas únicas formas de fechar um pagamento.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, OrderStatusHistory
from apps.payments.models import PaymentTransaction
from apps.payments.services.references import FAILED_KEY_PREFIX, find_transaction


@transaction.atomic
def complete_payment(order_id, *, provider, provider_transaction_id='',
                     provider_response=None):
    """Marca a encomenda como paga e liquida o dinheiro.

    Idempotente: se a encomenda já estiver `completed`, devolve `(order, False)`
    sem repetir a liquidação.

    Retorna `(order, created)` onde `created` é `True` apenas quando foi esta
    chamada que concluiu o pagamento.
    """
    order = Order.objects.select_for_update().get(pk=order_id)

    if order.payment_status == 'completed':
        return order, False

    previous_status = order.status
    order.payment_status = 'completed'
    if provider_transaction_id and not order.payment_id:
        order.payment_id = provider_transaction_id
    if order.status == 'pending':
        order.status = 'confirmed'
    order.save(update_fields=['payment_status', 'payment_id', 'status'])

    if previous_status != order.status:
        OrderStatusHistory.objects.create(
            order=order,
            previous_status=previous_status,
            new_status=order.status,
            changed_by=None,
            notes=f'Pagamento confirmado via {provider}',
        )

    # Liquida o dinheiro: crédito imediato (digital/curso) ou retenção em escrow (físico).
    from apps.wallet.services import settle_payment
    settle_payment(order)

    # Notificações em memória (não bloqueiam o webhook).
    from apps.notifications.models import Notification
    Notification.objects.create(
        user=order.buyer,
        title='Pagamento confirmado',
        message=f'O pagamento da encomenda {order.order_number} foi confirmado.',
        notification_type='order_update',
        link=f'/account/orders/{order.id}',
    )
    if order.store and order.store.owner:
        Notification.objects.create(
            user=order.store.owner,
            title='Pagamento recebido',
            message=f'Recebeu um pagamento para a encomenda {order.order_number}.',
            notification_type='order_update',
            link=f'/seller/orders',
        )

    return order, True


# ─── Ledger ───
#
# O `PaymentTransaction` é o registo de auditoria do pagamento. As escritas estão
# aqui (e não nas vistas) para que o webhook e a reconciliação gravem exactamente
# o mesmo formato de chave.


def mark_transaction_completed(idem_key, gateway_reference='', provider_response=None,
                               amount=Decimal('0.00')):
    """Regista (ou fecha) a transacção de checkout como concluída."""
    txn, _ = PaymentTransaction.objects.get_or_create(
        idempotency_key=idem_key,
        defaults={
            'provider': 'zumbopay',
            'provider_transaction_id': gateway_reference,
            'amount': amount,
            'currency': 'MZN',
            'status': 'completed',
            'provider_response': provider_response or {},
            'completed_at': timezone.now(),
        },
    )
    if txn.status != 'completed':
        txn.status = 'completed'
        if gateway_reference and not txn.provider_transaction_id:
            txn.provider_transaction_id = gateway_reference
        txn.provider_response = provider_response or {}
        txn.completed_at = timezone.now()
        txn.save(update_fields=['status', 'provider_transaction_id', 'provider_response',
                                'completed_at', 'updated_at'])
    return txn


def mark_transaction_failed(*, idem_key='', gateway_reference='', provider_response=None,
                            error_message=''):
    """Marca como falhada a transacção de checkout, se existir.

    Devolve ``(transacção, alterada)``. Não cria registos: uma transacção que
    nunca foi iniciada não deve ganhar uma linha de "falha".
    """
    txn = find_transaction(idem_key=idem_key, gateway_reference=gateway_reference)
    if txn is None or txn.status == 'failed':
        return txn, False
    txn.status = 'failed'
    txn.provider_response = provider_response or {}
    txn.error_message = error_message or ''
    txn.save(update_fields=['status', 'provider_response', 'error_message', 'updated_at'])
    return txn, True


def record_unmapped_payment(provider_response, error_message, gateway_reference=''):
    """Regista um pagamento que o gateway confirmou sem encomenda correspondente.

    Sem isto, dinheiro cobrado a um comprador cujo pedido não foi encontrado
    desapareceria sem rasto.
    """
    key = f"{FAILED_KEY_PREFIX}{gateway_reference or (provider_response or {}).get('reference', '')}"
    txn, _ = PaymentTransaction.objects.get_or_create(
        idempotency_key=key,
        defaults={
            'provider': 'zumbopay',
            'amount': 0,
            'currency': 'MZN',
            'status': 'failed',
            'provider_response': provider_response,
            'error_message': error_message,
        },
    )
    return txn
