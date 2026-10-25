from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

# Dias sem confirmação do comprador até a entrega ser confirmada automaticamente
AUTO_DELIVERY_DAYS = 7

# Horas sem atividade até o carrinho ser considerado abandonado
ABANDONED_CART_HOURS = 24

# Dias após entrega até o escrow ser libertado ao vendedor
ESCROW_RELEASE_DAYS = 7
logger = logging.getLogger(__name__)


@shared_task
def auto_refund_unprocessed_returns():
    """
    Reembolsa automaticamente devoluções com status 'received'
    que não foram reembolsadas pelo vendedor em 3 dias.
    """
    from apps.orders.models import ReturnRequest
    from apps.wallet.services import process_refund, InsufficientFunds
    from apps.notifications.models import Notification
    from django.db import transaction

    cutoff = timezone.now() - timedelta(days=3)
    pending = ReturnRequest.objects.filter(
        status='received',
        updated_at__lte=cutoff,
    )

    count = 0
    for return_req in pending:
        from apps.wallet.services import get_refundable_amount
        refund_amount = return_req.refund_amount or get_refundable_amount(return_req.order)
        seller = return_req.store.owner if return_req.store else None

        try:
            with transaction.atomic():
                process_refund(
                    return_req.order, seller, return_req.buyer, refund_amount,
                    f'Reembolso automático da devolução #{return_req.rma_number}',
                    refund_id=return_req.id,
                )
                from apps.affiliates.services import reverse_commissions_for_refund
                reverse_commissions_for_refund(
                    return_req.order, refund_amount, refund_id=return_req.id,
                )
                return_req.status = 'refunded'
                return_req.admin_notes = f'Reembolsado automaticamente pelo sistema em {timezone.now().date()}'
                return_req.save()
        except InsufficientFunds:
            # Vendedor sem saldo — marca para revisão manual do admin
            return_req.admin_notes = 'Reembolso automático falhou: saldo insuficiente do vendedor. Revisão manual necessária.'
            return_req.status = 'disputed'
            return_req.save()
            continue
        except ValueError as exc:
            return_req.admin_notes = f'Reembolso automático requer revisão: {exc}'
            return_req.status = 'disputed'
            return_req.save()
            continue

        # Reverter comissão de afiliado (se existir)
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


@shared_task
def recover_abandoned_carts():
    """
    Envia email + notificação a utilizadores com carrinhos abandonados
    (sem atividade há mais de ABANDONED_CART_HOURS horas e ainda não notificados).
    """
    from apps.orders.models import AbandonedCart, Order
    from apps.notifications.models import Notification

    cutoff = timezone.now() - timedelta(hours=ABANDONED_CART_HOURS)
    # Não importunar utilizadores que já iniciaram o checkout e aguardam
    # confirmação de pagamento (encomenda pendente) — para eles o carrinho
    # ainda está "ativo" e será limpo assim que o pagamento for confirmado.
    pending_buyer_ids = Order.objects.filter(
        payment_status='pending',
    ).values_list('buyer_id', flat=True).distinct()

    carts = AbandonedCart.objects.filter(
        recovered=False,
        notified_at__isnull=True,
        last_activity__lte=cutoff,
    ).exclude(user_id__in=pending_buyer_ids).select_related('user')

    count = 0
    for cart in carts:
        items = cart.items or []
        if not items:
            continue
        user = cart.user
        if not user.email:
            continue

        # Email de recuperação (template HTML)
        from apps.notifications import email_service
        email_service.dispatch(
            email_service.send_abandoned_cart_email,
            user.email, user.first_name, items, '/cart',
        )

        Notification.objects.create(
            user=user,
            title='Carrinho abandonado',
            message=f'Ainda tem {len(items)} item(ns) no carrinho. Conclua a sua compra!',
            notification_type='order_update',
            link='/cart',
        )

        cart.notified_at = timezone.now()
        cart.save(update_fields=['notified_at'])
        count += 1

    return f'{count} carrinho(s) abandonado(s) notificado(s).'


@shared_task
def auto_release_unpaid_orders():
    """
    Cancela encomendas `pending` cuja reserva de stock expirou, restaurando o
    stock e notificando o comprador de forma suave (não agressiva).
    """
    from django.db import transaction
    from apps.orders.models import Order, OrderStatusHistory
    from apps.orders.services import cancel_order
    from apps.notifications.models import Notification
    from apps.notifications import email_service
    from apps.payments.models import PaymentTransaction
    from apps.payments.services.vpay import VPayClient
    from apps.payments.views import _amount_matches, _confirm_payment, _mark_attempt_failed

    now = timezone.now()
    expired = Order.objects.filter(
        payment_status='pending',
        status='pending',
        reserved_until__lte=now,
    ).select_related('buyer', 'store__owner').prefetch_related('items')

    count = 0
    for order in expired:
        order.refresh_from_db()
        if order.payment_status != 'pending' or order.status != 'pending':
            continue

        active_attempt = order.payment_attempts.filter(
            status__in=['pending', 'processing'],
        ).order_by('-created_at').first()
        gateway_order_id = order.payment_id
        if active_attempt and not active_attempt.gateway_order_id:
            logger.warning(
                'Expired order %s has a VPay creation outcome requiring manual reconciliation (%s).',
                order.order_number,
                active_attempt.source_id,
            )
            continue
        if gateway_order_id:
            attempt = active_attempt or PaymentTransaction.objects.filter(
                provider='vpay',
                gateway_order_id=gateway_order_id,
            ).first()
            if attempt and attempt.status in ('completed', 'refund_pending', 'refunded'):
                continue
            result = VPayClient().get_order_status(gateway_order_id)
            if not result['ok']:
                logger.warning(
                    'Could not reconcile expired VPay order %s; retaining stock reservation.',
                    gateway_order_id,
                )
                continue
            data = result['data']
            if data.get('orderId') != gateway_order_id:
                logger.error('VPay returned a mismatched order id for %s.', gateway_order_id)
                continue
            if data.get('status') == 'paid':
                orders = list(attempt.orders.all()) if attempt else [order]
                total = sum((item.total for item in orders), Decimal('0.00'))
                if (
                    data.get('currency') != 'MZN'
                    or not _amount_matches(data.get('amount'), total)
                ):
                    logger.error('VPay amount/currency mismatch for expired order %s.', gateway_order_id)
                    continue
                _confirm_payment(
                    gateway_order_id,
                    data,
                    delivery_id='reservation-expiry-reconciliation',
                )
                continue
            if data.get('status') in ('failed', 'cancelled'):
                _mark_attempt_failed(gateway_order_id, data['status'])
                count += 1
                continue
            logger.info(
                'VPay order %s is still %s; retaining the stock reservation.',
                gateway_order_id,
                data.get('status', 'unknown'),
            )
            continue

        buyer = order.buyer

        items = [
            {'product_id': str(item.product_id) if item.product_id else '',
             'name': item.product_name,
             'price': str(item.unit_price)}
            for item in order.items.all()
        ]

        with transaction.atomic():
            locked_order = Order.objects.select_for_update().get(pk=order.pk)
            if (
                locked_order.payment_status != 'pending'
                or locked_order.status != 'pending'
                or not locked_order.reserved_until
                or locked_order.reserved_until > timezone.now()
            ):
                continue
            previous_status = locked_order.status
            cancelled = cancel_order(
                locked_order,
                changed_by=None,
                notes='Reserva de stock expirada (pagamento não confirmado)',
                stock_change_type='reserve_release',
            )
            if not cancelled:
                continue
            OrderStatusHistory.objects.create(
                order=locked_order,
                previous_status=previous_status,
                new_status='cancelled',
                changed_by=None,
                notes='Reserva de stock expirada (pagamento não confirmado)',
            )

        # Notificação + email suaves (fora da transação, não bloqueiam o cancelamento)
        Notification.objects.create(
            user=buyer,
            title='Reserva expirada',
            message='A reserva dos seus artigos expirou. Pode concluir novamente a compra para garantir os produtos.',
            notification_type='order_update',
            link='/cart',
        )
        if buyer.email:
            email_service.dispatch(
                email_service.send_order_reservation_expired_email,
                buyer.email, buyer.first_name, items, '/cart',
            )

        count += 1

    return f'{count} encomenda(s) não paga(s) libertada(s).'


@shared_task
def release_escrow_after_return_window():
    """
    Liberta escrows de encomendas físicas entregues há mais de ESCROW_RELEASE_DAYS dias,
    creditando o vendedor no saldo de saque.
    """
    from apps.wallet.models import EscrowHolding
    from apps.wallet.services import release_escrow

    cutoff = timezone.now() - timedelta(days=ESCROW_RELEASE_DAYS)
    held = EscrowHolding.objects.filter(
        status='held',
        order__status='delivered',
        order__delivered_at__lte=cutoff,
    ).select_related('order')

    count = 0
    for escrow in held:
        try:
            release_escrow(escrow)
            count += 1
        except Exception:
            continue

    return f'{count} escrow(s) libertado(s).'
