from celery import shared_task
from django.utils import timezone
from datetime import timedelta

# Dias sem confirmação do comprador até a entrega ser confirmada automaticamente
AUTO_DELIVERY_DAYS = 7


@shared_task
def auto_refund_unprocessed_returns():
    """
    Reembolsa automaticamente devoluções com status 'received'
    que não foram reembolsadas pelo vendedor em 3 dias.
    """
    from apps.orders.models import ReturnRequest
    from apps.wallet.models import Wallet, WalletTransaction
    from apps.notifications.models import Notification
    from django.db import transaction

    cutoff = timezone.now() - timedelta(days=3)
    pending = ReturnRequest.objects.filter(
        status='received',
        updated_at__lte=cutoff,
    )

    count = 0
    for return_req in pending:
        refund_amount = return_req.refund_amount or return_req.order.total

        with transaction.atomic():
            # Deduct from seller (owner of store)
            seller = return_req.store.owner if return_req.store else None
            if seller:
                seller_wallet, _ = Wallet.objects.get_or_create(user=seller)
                if seller_wallet.balance >= refund_amount:
                    seller_wallet.balance -= refund_amount
                    seller_wallet.save()
                    WalletTransaction.objects.create(
                        wallet=seller_wallet, type='refund', amount=-refund_amount,
                        status='completed',
                        description=f'Reembolso automático da devolução #{return_req.rma_number}',
                    )
                else:
                    # Seller não tem saldo — marca para revisão manual do admin
                    return_req.admin_notes = 'Reembolso automático falhou: saldo insuficiente do vendedor. Revisão manual necessária.'
                    return_req.status = 'disputed'
                    return_req.save()
                    continue

            # Credit buyer
            buyer_wallet, _ = Wallet.objects.get_or_create(user=return_req.buyer)
            buyer_wallet.balance += refund_amount
            buyer_wallet.save()
            WalletTransaction.objects.create(
                wallet=buyer_wallet, type='refund', amount=refund_amount,
                status='completed',
                description=f'Reembolso automático da devolução #{return_req.rma_number}',
            )

            return_req.status = 'refunded'
            return_req.admin_notes = f'Reembolsado automaticamente pelo sistema em {timezone.now().date()}'
            return_req.save()

        Notification.objects.create(
            user=return_req.buyer,
            title='Reembolso processado',
            message=f'O reembolso de {refund_amount} MZN da devolução #{return_req.rma_number} foi creditado automaticamente na sua carteira.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )
        count += 1

    return f'{count} devolução(ões) reembolsada(s) automaticamente.'


@shared_task
def auto_confirm_delivery():
    """
    Confirma automaticamente a entrega de encomendas 'shipped' (envio)
    ou 'ready_for_pickup' (levantamento) após AUTO_DELIVERY_DAYS dias sem
    confirmação do comprador.
    """
    from apps.orders.models import Order, OrderStatusHistory
    from apps.notifications.models import Notification

    cutoff = timezone.now() - timedelta(days=AUTO_DELIVERY_DAYS)
    pending = Order.objects.filter(
        status__in=['shipped', 'ready_for_pickup'],
        shipped_at__lte=cutoff,
    )

    count = 0
    for order in pending:
        previous_status = order.status
        order.status = 'delivered'
        order.confirmed_at = timezone.now()
        order.delivered_at = timezone.now()
        order.save(update_fields=['status', 'confirmed_at', 'delivered_at'])

        OrderStatusHistory.objects.create(
            order=order,
            previous_status=previous_status,
            new_status='delivered',
            changed_by=None,
            notes='Entrega confirmada automaticamente pelo sistema',
        )

        Notification.objects.create(
            user=order.buyer,
            title='Encomenda entregue',
            message=f'A entrega da encomenda {order.order_number} foi confirmada automaticamente.',
            notification_type='order_update',
            link=f'/account/orders/{order.id}',
        )
        if order.store and order.store.owner:
            Notification.objects.create(
                user=order.store.owner,
                title='Encomenda entregue',
                message=f'A encomenda {order.order_number} foi marcada como entregue automaticamente.',
                notification_type='order_update',
                link=f'/seller/orders',
            )
        count += 1

    return f'{count} encomenda(s) entregue(s) automaticamente.'
