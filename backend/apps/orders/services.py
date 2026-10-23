"""Serviços de encomendas — entrega digital e emails de venda.

Centraliza a lógica que só deve correr depois de o pagamento estar confirmado,
para que a criação da encomenda (estado `pending`) nunca dispare emails ou
libere conteúdo digital antes de o dinheiro entrar.
"""
from datetime import timedelta

from django.utils import timezone


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
