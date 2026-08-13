from celery import shared_task
from django.utils import timezone
from datetime import timedelta

# Dias sem confirmação do comprador até a entrega ser confirmada automaticamente
AUTO_DELIVERY_DAYS = 7

# Horas sem atividade até o carrinho ser considerado abandonado
ABANDONED_CART_HOURS = 24

# Dias após entrega até o escrow ser libertado ao vendedor
ESCROW_RELEASE_DAYS = 7


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
        refund_amount = return_req.refund_amount or return_req.order.total
        seller = return_req.store.owner if return_req.store else None

        try:
            with transaction.atomic():
                process_refund(
                    return_req.order, seller, return_req.buyer, refund_amount,
                    f'Reembolso automático da devolução #{return_req.rma_number}',
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

        # Reverter comissão de afiliado (se existir)
        from apps.affiliates.services import reject_commissions_for_order
        reject_commissions_for_order(return_req.order, f'Devolução #{return_req.rma_number} reembolsada automaticamente')

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
    from apps.orders.models import AbandonedCart
    from apps.notifications.models import Notification
    from django.core.mail import send_mail
    from django.conf import settings

    cutoff = timezone.now() - timedelta(hours=ABANDONED_CART_HOURS)
    carts = AbandonedCart.objects.filter(
        recovered=False,
        notified_at__isnull=True,
        last_activity__lte=cutoff,
    ).select_related('user')

    count = 0
    for cart in carts:
        items = cart.items or []
        if not items:
            continue
        user = cart.user
        if not user.email:
            continue

        # Resumo simples dos itens
        item_names = ', '.join(
            (it.get('name') or 'Produto') for it in items[:3]
        )
        if len(items) > 3:
            item_names += f' e mais {len(items) - 3}'

        message = (
            f'Olá {user.get_full_name() or user.email},\n\n'
            f'Ainda tem {len(items)} item(ns) no seu carrinho: {item_names}.\n'
            f'Volte ao eShoppingCentre para concluir a sua compra!\n\n'
            f'https://e-shoppingcentre.com/cart'
        )

        try:
            send_mail(
                subject='O seu carrinho está à sua espera 🛒',
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=f'<p>{message.replace(chr(10), "<br>")}</p>',
                fail_silently=True,
            )
        except Exception:
            pass

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
