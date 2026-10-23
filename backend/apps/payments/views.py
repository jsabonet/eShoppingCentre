import logging
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
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
    # Send each local order total as one item so gateway totals include discounts.
    items = [{
        'originProductId': f'order-{order.id}',
        'name': f'Encomenda {order.order_number}',
        'quantity': 1,
        'price': float(order.total),
    } for order in orders]

    has_physical_items = any(order.has_physical_items for order in orders)
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

    if has_physical_items:
        address = orders[0].shipping_address or {}
        payload['shippingAddress'] = {
            'street': address.get('address', ''),
            'city': address.get('city', ''),
            'country': 'MZ',
            **({'reference': address['notes']} if address.get('notes') else {}),
        }
    return payload


def _orders_for_vpay_id(order_id):
    if not order_id:
        return Order.objects.none()
    return Order.objects.filter(payment_id=order_id)


def _amount_matches(amount, total):
    try:
        parsed_amount = Decimal(str(amount))
        return parsed_amount.is_finite() and parsed_amount == total
    except (InvalidOperation, TypeError, ValueError):
        return False


def _valid_amount(amount):
    try:
        return Decimal(str(amount)).is_finite()
    except (InvalidOperation, TypeError, ValueError):
        return False


@transaction.atomic
def _confirm_payment(order_id, event_data, delivery_id=''):
    orders = list(_orders_for_vpay_id(order_id).select_related('buyer', 'store__owner'))
    if not orders:
        return None, False

    total = sum((order.total for order in orders), Decimal('0.00'))
    if not _amount_matches(event_data.get('amount'), total):
        logger.error('VPay amount mismatch for order %s', order_id)
        return None, False
    if event_data.get('currency') != 'MZN':
        logger.error('VPay currency mismatch for order %s', order_id)
        return None, False

    transaction_id = str(event_data.get('transactionId') or '')
    record_key = f'vpay:{order_id}'
    txn, _ = PaymentTransaction.objects.get_or_create(
        idempotency_key=record_key,
        defaults={
            'order': orders[0],
            'provider': 'vpay',
            'provider_transaction_id': transaction_id,
            'amount': total,
            'currency': 'MZN',
            'status': 'completed',
            'provider_response': {
                'event': event_data,
                'delivery_id': delivery_id,
            },
            'completed_at': timezone.now(),
        },
    )
    if txn.status != 'completed':
        txn.status = 'completed'
        txn.provider_transaction_id = transaction_id
        txn.provider_response = {'event': event_data, 'delivery_id': delivery_id}
        txn.completed_at = timezone.now()
        txn.save(update_fields=[
            'status', 'provider_transaction_id', 'provider_response',
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
    return orders, created_any


class PaymentsInitiateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order_ids = request.data.get('order_ids') or [request.data.get('order_id')]
        order_ids = [str(order_id) for order_id in order_ids if order_id]
        if not order_ids:
            return Response({'error': 'Nenhuma encomenda indicada.'},
                            status=status.HTTP_400_BAD_REQUEST)

        orders = list(Order.objects.filter(
            id__in=order_ids,
            buyer=request.user,
        ).prefetch_related('items'))
        if len(orders) != len(set(order_ids)):
            return Response({'error': 'Encomenda(s) inválida(s) ou não autorizada(s).'},
                            status=status.HTTP_400_BAD_REQUEST)

        pending = [order for order in orders if order.payment_status == 'pending']
        already_paid = [order for order in orders if order.payment_status == 'completed']
        if already_paid and not pending:
            return Response({
                'error': 'Encomenda(s) já pagas.',
                'order_ids': [str(order.id) for order in already_paid],
            }, status=status.HTTP_400_BAD_REQUEST)

        payable = pending or orders
        total = sum((order.total for order in payable), Decimal('0.00'))
        if total <= 0:
            return Response({'error': 'Montante de pagamento inválido.'},
                            status=status.HTTP_400_BAD_REQUEST)

        source_id = f'checkout-{get_random_string(20).lower()}'
        result = VPayClient().create_order(_build_order_payload(payable, source_id))
        if not result['ok']:
            message = result.get('message') or 'Erro ao criar pedido na VPay.'
            PaymentTransaction.objects.create(
                order=payable[0],
                provider='vpay',
                amount=total,
                currency='MZN',
                status='failed',
                provider_response=result.get('data') or {},
                error_message=message,
            )
            return Response(
                {'error': _friendly_error(message), 'detail': message},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        data = result['data']
        gateway_order_id = str(data['orderId'])
        checkout_url = data.get('checkout') or _checkout_url(gateway_order_id)
        with transaction.atomic():
            PaymentTransaction.objects.update_or_create(
                idempotency_key=f'vpay:{gateway_order_id}',
                defaults={
                    'order': payable[0],
                    'provider': 'vpay',
                    'provider_transaction_id': gateway_order_id,
                    'amount': total,
                    'currency': 'MZN',
                    'status': 'pending',
                    'provider_response': data,
                    'error_message': '',
                    'completed_at': None,
                },
            )
            for order in payable:
                order.payment_id = gateway_order_id
                order.save(update_fields=['payment_id', 'updated_at'])

        return Response({
            'checkout_url': checkout_url,
            'payment_id': gateway_order_id,
            'reference': gateway_order_id,
            'order_ids': [str(order.id) for order in payable],
        }, status=status.HTTP_200_OK)


class PaymentsStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        order_id = request.query_params.get('reference')
        if not order_id:
            return Response({'error': 'Parâmetro `reference` obrigatório.'},
                            status=status.HTTP_400_BAD_REQUEST)

        orders = list(_orders_for_vpay_id(order_id).filter(
            buyer=request.user,
        ).select_related('buyer', 'store__owner'))
        if not orders:
            return Response({'error': 'Pagamento não encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        if any(order.payment_status != 'completed' for order in orders):
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
                if not _amount_matches(data.get('amount'), total):
                    logger.error('VPay polling amount mismatch for order %s', order_id)
                    return Response({'error': 'Montante confirmado inválido.'},
                                    status=status.HTTP_502_BAD_GATEWAY)
                confirmed_data = {
                    **data,
                    'currency': data.get('currency', 'MZN'),
                    'transactionId': data.get('transactionId', ''),
                }
                confirmed_orders, _ = _confirm_payment(order_id, confirmed_data)
                if confirmed_orders is None:
                    return Response({'error': 'Dados de pagamento inválidos da VPay.'},
                                    status=status.HTTP_502_BAD_GATEWAY)
                orders = confirmed_orders
            elif payment_status in ('failed', 'cancelled'):
                PaymentTransaction.objects.filter(
                    idempotency_key=f'vpay:{order_id}',
                    status='pending',
                ).update(status='failed', error_message=f'VPay status: {payment_status}')
                for order in orders:
                    if order.payment_status == 'pending':
                        order.payment_status = 'failed'
                        order.save(update_fields=['payment_status', 'updated_at'])

        all_completed = all(order.payment_status == 'completed' for order in orders)
        return Response({
            'reference': order_id,
            'status': 'completed' if all_completed else (
                'failed' if any(order.payment_status == 'failed' for order in orders) else 'pending'
            ),
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
