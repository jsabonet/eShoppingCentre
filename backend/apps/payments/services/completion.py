"""Conclusão idempotente de pagamento — fecha o elo W0 do circuito de dinheiro.

Quando o gateway (PaySuite) confirma o pagamento via webhook, este módulo mapeia
o payload para a(s) encomenda(s), marca `payment_status='completed'` de forma
idempotente e despoleta a liquidação do dinheiro (`settle_payment`), que credita o
vendedor (digital/curso) ou retém em escrow (físico).
"""
from django.db import transaction

from apps.orders.models import Order, OrderStatusHistory


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
