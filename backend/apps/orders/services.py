"""Serviços de encomendas — entrega digital e emails de venda.

Centraliza a lógica que só deve correr depois de o pagamento estar confirmado,
para que a criação da encomenda (estado `pending`) nunca dispare emails ou
libere conteúdo digital antes de o dinheiro entrar.
"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone


def set_reservation(order, minutes=None):
    """Marca o prazo de reserva de stock de uma encomenda pendente.

    Devolve a data-limite (ou None se não for aplicável).
    """
    from django.conf import settings
    if order.payment_status != 'pending':
        order.reserved_until = None
        order.save(update_fields=['reserved_until', 'updated_at'])
        return None
    minutes = minutes if minutes is not None else settings.ORDER_RESERVATION_MINUTES
    reserved_until = timezone.now() + timedelta(minutes=minutes)
    order.reserved_until = reserved_until
    order.save(update_fields=['reserved_until', 'updated_at'])
    return reserved_until


def restore_order_stock(order, *, changed_by=None, change_type='reserve_release',
                        notes='Stock libertado por reserva expirada'):
    """Repõe o stock dos itens físicos de uma encomenda (uma única vez por cancelamento)."""
    from apps.products.models import Product, StockLog

    for item in order.items.all():
        if not item.product_id:
            continue
        product = Product.objects.select_for_update().filter(pk=item.product_id).first()
        if not product or product.product_type != 'physical':
            continue
        old_stock = product.stock
        product.stock += item.quantity
        product.save(update_fields=['stock'])
        StockLog.objects.create(
            product=product,
            change_type=change_type,
            quantity=item.quantity,
            stock_before=old_stock,
            stock_after=product.stock,
            reference=f'Order {order.order_number}',
            changed_by=changed_by,
            notes=notes,
        )


@transaction.atomic
def cancel_order(order, *, changed_by=None, notes='Encomenda cancelada',
                 stock_change_type='cancel'):
    """Cancela uma encomenda pendente/confirmada e desfaz os efeitos colaterais.

    - restaura o stock dos itens físicos;
    - reverte o escrow ainda retido (vendedor);
    - reembolsa o comprador se a encomenda já estava paga;
    - rejeita comissões de afiliado.

    Idempotente: devolve False se a encomenda já não puder ser cancelada.
    """
    from apps.orders.models import Order

    order = Order.objects.select_for_update().get(pk=order.pk)

    if order.status not in ('pending', 'confirmed'):
        return False

    order.status = 'cancelled'
    order.reserved_until = None
    order.save(update_fields=['status', 'reserved_until', 'updated_at'])

    restore_order_stock(order, changed_by=changed_by, change_type=stock_change_type, notes=notes)

    # Reconcile the seller share, escrow and affiliate commission on paid cancellations.
    if order.payment_status == 'completed' and order.total > 0:
        from apps.affiliates.services import reverse_commissions_for_refund
        from apps.wallet.services import get_refundable_amount, process_refund
        seller = order.store.owner if order.store else None
        refund_id = f'cancel-{order.id}'
        refund_amount = get_refundable_amount(order)
        if refund_amount > 0:
            process_refund(
                order,
                seller,
                order.buyer,
                refund_amount,
                f'Reembolso por cancelamento {order.order_number}',
                refund_id=refund_id,
            )
            reverse_commissions_for_refund(
                order,
                refund_amount,
                refund_id=refund_id,
            )
        revoke_order_delivery(order)
        order.status = 'cancelled'
        order.save(update_fields=['status', 'updated_at'])
    else:
        from apps.wallet.services import reverse_escrow
        from apps.affiliates.services import reject_commissions_for_order
        reverse_escrow(order)
        reject_commissions_for_order(order, notes)

    return True


def revoke_order_delivery(order):
    """Expire digital access granted by an order after its full refund."""
    now = timezone.now()
    from apps.products.models_digital import DigitalDownload
    from apps.courses.models import Enrollment

    DigitalDownload.objects.filter(order=order).update(expires_at=now)
    Enrollment.objects.filter(order=order).update(access_expires_at=now)


def process_delivery(order):
    """Liberta downloads digitais e matricula em cursos após pagamento confirmado."""
    for item in order.items.all():
        product = item.product
        if not product:
            continue

        if product.product_type == 'digital':
            from apps.products.models import DigitalDownload
            DigitalDownload.objects.get_or_create(
                user=order.buyer,
                product=product,
                order=order,
            )

        elif product.product_type == 'course' and hasattr(product, 'course'):
            from apps.courses.models import Enrollment

            course = product.course
            defaults = {'order': order}
            if course.access_duration_days:
                defaults['access_expires_at'] = timezone.now() + timedelta(days=course.access_duration_days)

            Enrollment.objects.get_or_create(
                user=order.buyer,
                course=course,
                defaults=defaults,
            )

    # Pedidos 100% digitais/cursos são concluídos de imediato (não há envio)
    if order.is_digital_only and order.status != 'delivered':
        now = timezone.now()
        order.status = 'delivered'
        order.confirmed_at = order.confirmed_at or now
        order.delivered_at = order.delivered_at or now
        order.save(update_fields=['status', 'confirmed_at', 'delivered_at'])


def send_order_emails(order):
    """Dispara os emails de confirmação/nova venda de uma encomenda paga.

    Deve ser chamado apenas quando `order.payment_status == 'completed'`.
    """
    from apps.notifications import email_service

    email_service.dispatch(email_service.send_order_confirmation_email, str(order.id))
    email_service.dispatch(email_service.send_new_sale_email, str(order.id))
    email_service.dispatch(email_service.send_admin_new_sale_email, str(order.id))
    if order.affiliate_id and order.affiliate_commission and order.affiliate_commission > 0:
        email_service.dispatch(email_service.send_affiliate_sale_email, str(order.id))


def reconcile_cart_after_payment(order):
    """Remove do carrinho abandonado os artigos que esta encomenda pagou.

    Apenas remove os produtos efetivamente pagos — preservando o que o cliente
    tenha acrescentado entretanto — e marca o carrinho como recuperado quando
    fica vazio. Assim o email de "carrinho abandonado" nunca volta a referir
    artigos que já foram comprados.
    """
    from apps.orders.models import AbandonedCart

    cart = AbandonedCart.objects.filter(user=order.buyer).first()
    if cart is None:
        return

    paid_ids = {str(item.product_id) for item in order.items.all() if item.product_id}
    items = cart.items or []
    remaining = [i for i in items if str(i.get('product_id')) not in paid_ids]

    if len(remaining) != len(items):
        cart.items = remaining
        if not remaining:
            cart.recovered = True
            cart.recovered_at = timezone.now()
            cart.notified_at = None
        cart.save(update_fields=['items', 'recovered', 'recovered_at', 'notified_at'])
