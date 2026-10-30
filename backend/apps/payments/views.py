import logging
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.payments.services.completion import complete_payment
from apps.payments.services.vpay import VPayClient

logger = logging.getLogger(__name__)


def _friendly_error(message):
    if 'credential' in (message or '').lower() or 'autenticar' in (message or '').lower():
        return 'O pagamento online está temporariamente indisponível. Tente novamente mais tarde.'
    return 'Não foi possível iniciar o pagamento. Tente novamente.'


def _checkout_url(order_id):
    base_url = settings.VPAY_CHECKOUT_BASE_URL.rstrip('/')
    return f'{base_url}/{quote(str(order_id), safe="")}'


def _build_order_payload(orders, source_id):
    buyer = orders[0].buyer
    items = []
    shipping_total = Decimal('0.00')

    for order in orders:
        goods_value = (order.subtotal or Decimal('0.00')) - (order.discount or Decimal('0.00'))
        shipping_total += order.shipping_cost or Decimal('0.00')
        order_items = list(order.items.all())

        if order_items:
            items.extend(_order_items_to_payload(order, order_items, goods_value))
        else:
            # Encomenda legado/sem itens: colapsa num único item para o gateway
            # totalizar o valor líquido (subtotal - desconto) corretamente.
            items.append({
                'originProductId': f'order-{order.id}',
                'name': f'Encomenda {order.order_number}',
                'quantity': 1,
                'price': float(goods_value),
            })

    payload = {
        'source': {'source': 'api', 'sourceId': source_id},
        'customer': {
            'name': buyer.get_full_name() or buyer.email,
            'email': buyer.email,
            **({'phone': buyer.phone} if buyer.phone else {}),
        },
        # O nosso checkout recolhe morada e dados de entrega; o painel VPay
        # trata apenas do pagamento. Mantemos ambos os flags desativados para
        # nunca repetir a recolha entre as duas páginas.
        'shippingAddressDisabled': True,
        'deliveryInfoDisabled': True,
        'items': items,
    }

    if shipping_total > 0:
        payload['shippingCost'] = float(shipping_total)

    has_physical_items = any(order.has_physical_items for order in orders)
    if has_physical_items:
        address = orders[0].shipping_address or {}
        payload['shippingAddress'] = {
            'street': address.get('address') or address.get('street') or '',
            'city': address.get('city', ''),
            'country': 'MZ',
        }
    return payload


def _order_items_to_payload(order, order_items, goods_value):
    """Distribui o valor líquido (subtotal - desconto) pelos itens da encomenda.

    O desconto é rateado proporcionalmente a cada item para que a soma
    (preço × quantidade) iguale `goods_value`, evitando divergência de cêntimos
    face ao total cobrado pelo gateway.
    """
    from decimal import ROUND_HALF_UP

    totals = [item.total_price or Decimal('0.00') for item in order_items]
    sum_totals = sum(totals, Decimal('0.00'))
    last_index = len(order_items) - 1
    remaining = goods_value
    result = []

    for index, item in enumerate(order_items):
        quantity = item.quantity or 1
        if index == last_index:
            effective_total = remaining
        elif sum_totals > 0:
            share = (totals[index] / sum_totals) * goods_value
            effective_total = share.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            remaining -= effective_total
        else:
            effective_total = Decimal('0.00')

        unit_price = effective_total / Decimal(quantity)
        item_payload = {
            'originProductId': str(item.product_id) if item.product_id else f'orderitem-{item.id}',
            'name': item.product_name or 'Produto',
            'quantity': quantity,
            'price': float(unit_price),
        }
        if item.product_image:
            item_payload['imageUrl'] = item.product_image
        result.append(item_payload)

    return result


def _orders_for_vpay_id(order_id):
    if not order_id:
        return Order.objects.none()
    attempt = PaymentTransaction.objects.filter(
        provider='vpay',
    ).filter(
        models.Q(gateway_order_id=order_id)
        | models.Q(provider_transaction_id=order_id)
    ).first()
    if attempt and attempt.orders.exists():
        return attempt.orders.all()
    return Order.objects.filter(payment_id=order_id)


def _payment_attempt(order_id):
    return PaymentTransaction.objects.filter(
        provider='vpay',
    ).filter(
        models.Q(gateway_order_id=order_id)
        | models.Q(provider_transaction_id=order_id)
    ).first()


def _order_total(orders):
    return sum((order.total for order in orders), Decimal('0.00'))


def _attempt_orders(attempt):
    orders = list(attempt.orders.select_related('buyer', 'store__owner').all())
    if not orders and (attempt.gateway_order_id or attempt.provider_transaction_id):
        orders = list(
            Order.objects.filter(
                payment_id=attempt.gateway_order_id or attempt.provider_transaction_id,
            )
            .select_related('buyer', 'store__owner')
        )
        if orders:
            attempt.orders.add(*orders)
    return orders


def _mark_attempt_failed(order_id, gateway_status):
    """Apply a definitive negative gateway state without overriding a paid order."""
    from apps.orders.models import Order, OrderStatusHistory
    from apps.orders.services import cancel_order

    with transaction.atomic():
        attempt = PaymentTransaction.objects.select_for_update().filter(
            provider='vpay',
        ).filter(
            models.Q(gateway_order_id=order_id)
            | models.Q(provider_transaction_id=order_id)
        ).first()
        if attempt and attempt.status in ('completed', 'refund_pending', 'refunded'):
            return False
        order_ids = (
            list(attempt.orders.values_list('id', flat=True))
            if attempt else []
        )
        orders = list(Order.objects.select_for_update().filter(
            models.Q(pk__in=order_ids) | models.Q(payment_id=order_id),
        ).order_by('pk'))
        if not orders or any(order.payment_status == 'completed' for order in orders):
            return False
        current_attempt_orders = [
            order for order in orders if order.payment_id == order_id
        ]
        if attempt:
            attempt.status = 'failed'
            attempt.error_message = f'VPay status: {gateway_status}'
            attempt.provider_response = {
                **(attempt.provider_response or {}),
                'terminal_status': gateway_status,
            }
            attempt.save(update_fields=[
                'status', 'error_message', 'provider_response', 'updated_at',
            ])
        for order in current_attempt_orders:
            if order.payment_status not in ('pending', 'failed'):
                continue
            previous_status = order.status
            if order.status != 'cancelled':
                cancel_order(
                    order,
                    changed_by=None,
                    notes=f'Pagamento {gateway_status} confirmado pela VPay',
                )
                OrderStatusHistory.objects.create(
                    order=order,
                    previous_status=previous_status,
                    new_status='cancelled',
                    changed_by=None,
                    notes=f'Pagamento {gateway_status} confirmado pela VPay',
                )
            order.payment_status = 'failed'
            order.save(update_fields=['payment_status', 'updated_at'])
        return True


def _amount_matches(amount, total):
    try:
        parsed_amount = Decimal(str(amount))
        # Tolerância de 1 cêntimo para absorver arredondamentos de float na
        # distribuição do valor pelos itens do gateway.
        return parsed_amount.is_finite() and abs(parsed_amount - total) <= Decimal('0.01')
    except (InvalidOperation, TypeError, ValueError):
        return False


def _valid_amount(amount):
    try:
        return Decimal(str(amount)).is_finite()
    except (InvalidOperation, TypeError, ValueError):
        return False


@transaction.atomic
def _confirm_payment(order_id, event_data, delivery_id=''):
    attempt = PaymentTransaction.objects.select_for_update().filter(
        provider='vpay',
    ).filter(
        models.Q(gateway_order_id=order_id)
        | models.Q(provider_transaction_id=order_id)
    ).first()
    source_id = event_data.get('sourceId')
    if not attempt and isinstance(event_data.get('source'), dict):
        source_id = source_id or event_data['source'].get('sourceId')
    if not attempt and source_id:
        attempt = PaymentTransaction.objects.select_for_update().filter(
            provider='vpay',
            source_id=str(source_id),
        ).first()
        if attempt and not attempt.gateway_order_id:
            attempt.gateway_order_id = order_id
            attempt.save(update_fields=['gateway_order_id', 'updated_at'])
    orders = _attempt_orders(attempt) if attempt else list(
        _orders_for_vpay_id(order_id).select_related('buyer', 'store__owner')
    )
    if not orders:
        return None, False

    total = _order_total(orders)
    if not _amount_matches(event_data.get('amount'), total):
        logger.error('VPay amount mismatch for order %s', order_id)
        return None, False
    if event_data.get('currency') != 'MZN':
        logger.error('VPay currency mismatch for order %s', order_id)
        return None, False

    transaction_id = str(event_data.get('transactionId') or '')
    record_key = f'vpay:{order_id}'
    if attempt and transaction_id and attempt.provider_transaction_id:
        prior_id = attempt.provider_transaction_id
        if prior_id != transaction_id:
            logger.error('VPay transaction id mismatch for order %s', order_id)
            return None, False
    txn = attempt
    if txn is None:
        txn, _ = PaymentTransaction.objects.get_or_create(
            idempotency_key=record_key,
            defaults={
                'order': orders[0],
                'provider': 'vpay',
                'provider_transaction_id': transaction_id,
                'gateway_order_id': order_id,
                'amount': total,
                'currency': 'MZN',
                'status': 'pending',
                'provider_response': {
                    'event': event_data,
                    'delivery_id': delivery_id,
                },
                'completed_at': timezone.now(),
            },
        )
        txn.orders.add(*orders)
    current_attempt = all(order.payment_id == order_id for order in orders)
    cancelled_order = any(order.status == 'cancelled' for order in orders)
    if not current_attempt or cancelled_order:
        txn.status = 'refund_pending'
        txn.provider_transaction_id = transaction_id or txn.provider_transaction_id
        txn.gateway_order_id = order_id
        txn.provider_response = {
            **(txn.provider_response or {}),
            'event': event_data,
            'delivery_id': delivery_id,
            'exception': 'payment_after_cancel' if cancelled_order else 'superseded_payment_attempt',
        }
        txn.completed_at = timezone.now()
        txn.error_message = (
            'Pagamento recebido após cancelamento; reembolso necessário.'
            if cancelled_order
            else 'Pagamento recebido numa tentativa substituída; reembolso necessário.'
        )
        txn.save(update_fields=[
            'status', 'provider_transaction_id', 'gateway_order_id',
            'provider_response', 'completed_at', 'error_message', 'updated_at',
        ])
        from apps.notifications.email_service import dispatch, send_admin_alert_email
        transaction.on_commit(lambda: dispatch(
            send_admin_alert_email,
            f'Pagamento VPay requer reembolso: {order_id}',
            txn.error_message,
        ))
        if cancelled_order:
            for index, order in enumerate(orders):
                orders[index], _ = complete_payment(
                    order.id,
                    provider='vpay',
                    provider_transaction_id=transaction_id,
                    provider_response=event_data,
                )
        return orders, True
    if txn.status not in ('completed', 'refund_pending', 'refunded'):
        txn.status = (
            'refund_pending'
            if cancelled_order
            else 'completed'
        )
        if transaction_id:
            txn.provider_transaction_id = transaction_id
        txn.gateway_order_id = order_id
        txn.provider_response = {
            **(txn.provider_response or {}),
            'event': event_data,
            'delivery_id': delivery_id,
        }
        txn.completed_at = timezone.now()
        txn.save(update_fields=[
            'status', 'provider_transaction_id', 'gateway_order_id', 'provider_response',
            'completed_at', 'updated_at',
        ])

    created_any = False
    for index, order in enumerate(orders):
        completed_order, created = complete_payment(
            order.id,
            provider='vpay',
            provider_transaction_id=transaction_id,
            provider_response=event_data,
        )
        orders[index] = completed_order
        created_any = created_any or created
    # Email-resumo único quando o checkout foi dividido por várias lojas.
    if created_any and len(orders) > 1:
        from apps.notifications import email_service
        transaction.on_commit(lambda: email_service.dispatch(
            email_service.send_checkout_summary_email,
            [str(order.id) for order in orders],
        ))

    return orders, created_any


class PaymentsInitiateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order_ids = request.data.get('order_ids') or [request.data.get('order_id')]
        order_ids = [str(order_id) for order_id in order_ids if order_id]
        if not order_ids:
            return Response({'error': 'Nenhuma encomenda indicada.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            orders = list(Order.objects.select_for_update().filter(
                id__in=order_ids,
                buyer=request.user,
            ).prefetch_related('items'))
            if len(orders) != len(set(order_ids)):
                return Response({'error': 'Encomenda(s) inválida(s) ou não autorizada(s).'},
                                status=status.HTTP_400_BAD_REQUEST)
            orders.sort(key=lambda order: str(order.pk))
            if any(order.status != 'pending' or order.payment_status != 'pending' for order in orders):
                return Response(
                    {'error': 'Apenas encomendas pendentes e não canceladas podem iniciar pagamento.'},
                    status=status.HTTP_409_CONFLICT,
                )
            if any(
                order.reserved_until and order.reserved_until <= timezone.now()
                for order in orders
            ):
                return Response(
                    {'error': 'A reserva expirou. Crie uma nova encomenda para pagar.'},
                    status=status.HTTP_409_CONFLICT,
                )
            total = _order_total(orders)
            if total <= 0:
                return Response({'error': 'Montante de pagamento inválido.'},
                                status=status.HTTP_400_BAD_REQUEST)

            requested_ids = {order.id for order in orders}
            open_attempt_ids = PaymentTransaction.objects.filter(
                provider='vpay',
                status__in=['pending', 'processing'],
                orders__in=orders,
            ).values_list('pk', flat=True).distinct()
            open_attempts = list(
                PaymentTransaction.objects.select_for_update().filter(
                    pk__in=open_attempt_ids,
                ).order_by('-created_at')
            )
            existing = open_attempts[0] if open_attempts else None
            if existing:
                existing_order_ids = set(existing.orders.values_list('id', flat=True))
                if (
                    existing.status in ('pending', 'processing')
                    and existing.gateway_order_id
                    and existing_order_ids == requested_ids
                ):
                    return Response({
                        'checkout_url': existing.provider_response.get('checkout')
                        or _checkout_url(existing.gateway_order_id),
                        'payment_id': existing.gateway_order_id,
                        'reference': existing.gateway_order_id,
                        'order_ids': [str(order.id) for order in orders],
                        'reused': True,
                    }, status=status.HTTP_200_OK)
                return Response(
                    {
                        'error': (
                            'Estas encomendas estão associadas a outra tentativa '
                            'de pagamento em aberto. Conclua ou contacte o suporte '
                            'antes de iniciar outro checkout.'
                        ),
                        'reference': existing.gateway_order_id or existing.source_id,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            source_id = f'checkout-{get_random_string(20).lower()}'
            attempt = PaymentTransaction.objects.create(
                order=orders[0],
                provider='vpay',
                source_id=source_id,
                amount=total,
                currency='MZN',
                status='processing',
                provider_response={'request': {'sourceId': source_id}},
            )
            attempt.orders.add(*orders)

        result = VPayClient().create_order(_build_order_payload(orders, source_id))
        if not result['ok']:
            message = result.get('message') or 'Erro ao criar pedido na VPay.'
            outcome_unknown = result.get('outcome_unknown') or (
                result.get('http_status') is not None
                and result['http_status'] >= 500
            )
            attempt.status = 'processing' if outcome_unknown else 'failed'
            attempt.error_message = message
            attempt.provider_response = {
                **(attempt.provider_response or {}),
                'creation_response': result.get('data') or {},
                'creation_outcome_unknown': bool(outcome_unknown),
            }
            attempt.save(update_fields=[
                'status', 'error_message', 'provider_response', 'updated_at',
            ])
            response_status = (
                status.HTTP_409_CONFLICT if outcome_unknown
                else status.HTTP_502_BAD_GATEWAY
            )
            return Response(
                {
                    'error': _friendly_error(message),
                    'detail': message,
                    **({'reference': source_id} if outcome_unknown else {}),
                },
                status=response_status,
            )

        data = result['data']
        gateway_order_id = str(data['orderId'])
        checkout_url = data.get('checkout') or _checkout_url(gateway_order_id)
        with transaction.atomic():
            attempt = PaymentTransaction.objects.select_for_update().get(pk=attempt.pk)
            attempt.gateway_order_id = gateway_order_id
            attempt.status = 'pending'
            attempt.provider_response = {**data, 'checkout': checkout_url}
            attempt.save(update_fields=[
                'gateway_order_id', 'status', 'provider_response', 'updated_at',
            ])
            for order in orders:
                locked_order = Order.objects.select_for_update().get(pk=order.pk)
                if locked_order.payment_status != 'pending' or locked_order.status != 'pending':
                    attempt.status = 'processing'
                    attempt.error_message = 'A encomenda mudou de estado durante a criação do pagamento.'
                    attempt.save(update_fields=['status', 'error_message', 'updated_at'])
                    return Response(
                        {'error': 'A encomenda mudou de estado. O pagamento requer reconciliação manual.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                locked_order.payment_id = gateway_order_id
                locked_order.save(update_fields=['payment_id', 'updated_at'])

        return Response({
            'checkout_url': checkout_url,
            'payment_id': gateway_order_id,
            'reference': gateway_order_id,
            'order_ids': [str(order.id) for order in orders],
        }, status=status.HTTP_200_OK)


class PaymentsStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        order_id = request.query_params.get('reference')
        if not order_id:
            return Response({'error': 'Parâmetro `reference` obrigatório.'},
                            status=status.HTTP_400_BAD_REQUEST)

        attempt = _payment_attempt(order_id)
        source_attempt = None
        if attempt is None:
            source_attempt = PaymentTransaction.objects.filter(
                provider='vpay',
                source_id=order_id,
            ).first()
            attempt = source_attempt
        order_queryset = (
            attempt.orders.all()
            if attempt
            else _orders_for_vpay_id(order_id)
        )
        orders = list(order_queryset.filter(
            buyer=request.user,
        ).select_related('buyer', 'store__owner'))
        if not orders:
            return Response({'error': 'Pagamento não encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        provider_status = attempt.status if attempt else 'pending'
        if source_attempt:
            if source_attempt.status == 'processing':
                provider_status = 'processing'
            else:
                provider_status = source_attempt.status
        elif attempt and attempt.status in ('refund_pending', 'refunded', 'failed'):
            provider_status = attempt.status
        elif any(order.payment_status != 'completed' for order in orders):
            result = VPayClient().get_order_status(order_id)
            if not result['ok']:
                return Response(
                    {'error': 'Não foi possível confirmar o pagamento com a VPay.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            data = result['data']
            if data.get('orderId') != order_id:
                return Response({'error': 'Resposta de pagamento inválida da VPay.'},
                                status=status.HTTP_502_BAD_GATEWAY)

            payment_status = data.get('status')
            if payment_status == 'paid':
                total = sum((order.total for order in orders), Decimal('0.00'))
                expected_currency = attempt.currency if attempt else 'MZN'
                if (
                    not _amount_matches(data.get('amount'), total)
                    or expected_currency != 'MZN'
                    or (
                        data.get('currency') is not None
                        and data.get('currency') != expected_currency
                    )
                ):
                    logger.error('VPay polling amount mismatch for order %s', order_id)
                    return Response({'error': 'Montante confirmado inválido.'},
                                    status=status.HTTP_502_BAD_GATEWAY)
                confirmed_data = {
                    **data,
                    'currency': expected_currency,
                    'transactionId': data.get('transactionId', ''),
                }
                confirmed_orders, _ = _confirm_payment(order_id, confirmed_data)
                if confirmed_orders is None:
                    return Response({'error': 'Dados de pagamento inválidos da VPay.'},
                                    status=status.HTTP_502_BAD_GATEWAY)
                orders = confirmed_orders
                attempt = _payment_attempt(order_id)
                provider_status = attempt.status if attempt else 'completed'
            elif payment_status in ('failed', 'cancelled'):
                _mark_attempt_failed(order_id, payment_status)
                orders = list(
                    _orders_for_vpay_id(order_id).filter(buyer=request.user)
                    .select_related('buyer', 'store__owner')
                )
                attempt = _payment_attempt(order_id)
                provider_status = attempt.status if attempt else 'failed'
            else:
                provider_status = 'pending'
        elif not source_attempt and attempt and attempt.status == 'processing':
            provider_status = 'processing'

        all_completed = all(order.payment_status == 'completed' for order in orders)
        if provider_status not in ('refund_pending', 'refunded', 'failed', 'processing'):
            provider_status = 'completed' if all_completed else (
                'failed' if any(order.payment_status == 'failed' for order in orders)
                else 'pending'
            )
        return Response({
            'reference': order_id,
            'status': provider_status,
            'orders': [{
                'id': str(order.id),
                'order_number': order.order_number,
                'payment_status': order.payment_status,
            } for order in orders],
        }, status=status.HTTP_200_OK)


class VPayWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        client = VPayClient()
        signature = request.META.get('HTTP_X_VOIDPAY_SIGNATURE', '')
        payload = request.body
        if not client.webhook_secret or not client.verify_signature(payload, signature):
            logger.warning('VPay webhook rejected: missing or invalid signature.')
            return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)

        event = request.data if isinstance(request.data, dict) else {}
        if event.get('event') != 'payment.confirmed':
            return Response({'status': 'ok', 'handled': False}, status=status.HTTP_200_OK)

        order_id = event.get('orderId')
        if (not order_id or event.get('status') != 'paid'
                or not _valid_amount(event.get('amount'))
                or event.get('currency') != 'MZN'):
            return Response({'error': 'Invalid payment event'}, status=status.HTTP_400_BAD_REQUEST)

        orders, created = _confirm_payment(
            str(order_id),
            event,
            delivery_id=request.META.get('HTTP_X_VOIDPAY_DELIVERY', ''),
        )
        if orders is None:
            return Response({'error': 'Payment could not be verified'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'status': 'ok',
            'orderId': str(order_id),
            'created': created,
        }, status=status.HTTP_200_OK)
