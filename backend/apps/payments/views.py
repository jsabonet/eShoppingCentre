import logging
from decimal import Decimal

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
from apps.payments.services.paysuite import PaysuiteClient

logger = logging.getLogger(__name__)


def _webhook_url():
    base = getattr(settings, 'PAYSUITE_WEBHOOK_URL', None)
    if base:
        return base
    site = getattr(settings, 'BACKEND_URL', '').rstrip('/')
    return f'{site}/api/v1/payments/webhook/paysuite/' if site else ''


def _return_url(reference):
    frontend = getattr(settings, 'FRONTEND_URL', '').rstrip('/')
    return f'{frontend}/checkout/success?reference={reference}' if frontend else ''


def _resolve_orders(reference):
    """Mapeia a ``reference`` do webhook para as encomendas do checkout."""
    if not reference:
        return Order.objects.none()
    return Order.objects.filter(payment_id=reference)


class PaymentsInitiateView(APIView):
    """Inicia um pagamento PaySuite para uma ou mais encomendas pendentes.

    Regista a transacção no ledger, grava a `reference` em `Order.payment_id`
    (para o webhook mapear) e devolve a ``checkout_url`` hospedada do PaySuite.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order_ids = request.data.get('order_ids') or [request.data.get('order_id')]
        order_ids = [str(i) for i in order_ids if i]

        if not order_ids:
            return Response({'error': 'Nenhuma encomenda indicada.'},
                            status=status.HTTP_400_BAD_REQUEST)

        orders = Order.objects.filter(id__in=order_ids, buyer=request.user)
        if orders.count() != len(set(order_ids)):
            return Response({'error': 'Encomenda(s) inválida(s) ou não autorizada(s).'},
                            status=status.HTTP_400_BAD_REQUEST)

        pending = [o for o in orders if o.payment_status == 'pending']
        already_paid = [o for o in orders if o.payment_status == 'completed']
        if already_paid and not pending:
            return Response({'error': 'Encomenda(s) já pagas.', 'order_ids': [o.id for o in already_paid]},
                            status=status.HTTP_400_BAD_REQUEST)

        # Um pagamento cobre o total das encomendas ainda por pagar.
        payable = pending or orders
        total = sum((o.total for o in payable), Decimal('0.00'))
        if total <= 0:
            return Response({'error': 'Montante de pagamento inválido.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if len(payable) == 1:
            reference = payable[0].order_number
        else:
            reference = f'CHECKOUT-{get_random_string(10).upper()}'

        description = ', '.join(o.order_number for o in payable)[:200]

        client = PaysuiteClient()
        result = client.create_payment(
            amount=total,
            reference=reference,
            description=description,
            return_url=_return_url(reference),
            webhook_url=_webhook_url(),
            method=request.data.get('method'),
        )

        if not result['ok']:
            PaymentTransaction.objects.create(
                order=payable[0],
                provider='paysuite',
                amount=total,
                currency='MZN',
                status='failed',
                provider_response=result.get('data') or {},
                error_message=result.get('message') or 'Erro ao criar pagamento.',
            )
            return Response(
                {'error': result.get('message') or 'Erro ao criar pagamento.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        data = result['data'] or {}
        gateway_id = data.get('id', '')
        checkout_url = data.get('checkout_url', '')

        with transaction.atomic():
            txn, _ = PaymentTransaction.objects.get_or_create(
                idempotency_key=f'paysuite:{reference}',
                defaults={
                    'order': payable[0],
                    'provider': 'paysuite',
                    'provider_transaction_id': gateway_id,
                    'amount': total,
                    'currency': 'MZN',
                    'status': 'pending',
                    'provider_response': data,
                },
            )
            if gateway_id and txn.provider_transaction_id != gateway_id:
                txn.provider_transaction_id = gateway_id
                txn.save(update_fields=['provider_transaction_id', 'updated_at'])

            for order in payable:
                order.payment_id = reference
                order.save(update_fields=['payment_id', 'updated_at'])

        return Response({
            'checkout_url': checkout_url,
            'payment_id': gateway_id,
            'reference': reference,
            'order_ids': [str(o.id) for o in payable],
        }, status=status.HTTP_200_OK)


class PaymentsStatusView(APIView):
    """Estado do pagamento de um checkout (fallback ao webhook, para polling)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        reference = request.query_params.get('reference')
        if not reference:
            return Response({'error': 'Parâmetro `reference` obrigatório.'},
                            status=status.HTTP_400_BAD_REQUEST)

        orders = _resolve_orders(reference).filter(buyer=request.user)
        if not orders.exists():
            return Response({'error': 'Pagamento não encontrado.'},
                            status=status.HTTP_404_NOT_FOUND)

        all_completed = all(o.payment_status == 'completed' for o in orders)
        any_failed = any(o.payment_status == 'failed' for o in orders)
        return Response({
            'reference': reference,
            'status': 'completed' if all_completed else ('failed' if any_failed else 'pending'),
            'orders': [{
                'id': str(o.id),
                'order_number': o.order_number,
                'payment_status': o.payment_status,
            } for o in orders],
        }, status=status.HTTP_200_OK)


class PaysuiteWebhookView(APIView):
    """Webhook PaySuite — fecha o elo de pagamento (W0).

    Eventos tratados: `payment.success` (liquida e credita) e `payment.failed`.
    `payout.*` e `refund.*` são registados para auditoria (fora do âmbito W0).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        payload = request.body
        body = payload.decode('utf-8') or ''
        signature = request.META.get('HTTP_X_SIGNATURE', '')

        client = PaysuiteClient()
        if client.webhook_secret and not client.verify_signature(body, signature):
            logger.error('Webhook PaySuite com assinatura inválida.')
            return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data if isinstance(request.data, dict) else {}
        event = data.get('event', '')
        payload_data = data.get('data') or {}

        if event == 'payment.success':
            return self._handle_success(data, payload_data)
        if event == 'payment.failed':
            return self._handle_failed(data, payload_data)

        # Eventos de payout/refund fora do âmbito W0: só auditar.
        logger.info('Webhook PaySuite evento não tratado: %s', event)
        return Response({'status': 'ok', 'handled': False}, status=status.HTTP_200_OK)

    @staticmethod
    def _handle_success(data, payload_data):
        reference = payload_data.get('reference', '')
        gateway_id = payload_data.get('id', '') or payload_data.get('transaction_id', '')

        orders = _resolve_orders(reference)
        if not orders.exists():
            logger.warning('Webhook PaySuite sem encomenda mapeada: %s', data)
            PaysuiteWebhookView._record_failed(data, 'Encomenda não encontrada para a referência.', gateway_id)
            return Response({'status': 'ok', 'mapped': False}, status=status.HTTP_200_OK)

        total = sum((o.total for o in orders), Decimal('0.00'))
        PaysuiteWebhookView._mark_txn_completed(reference, gateway_id, data, total)

        created_any = False
        for order in orders:
            _, created = complete_payment(
                order.id,
                provider='paysuite',
                provider_transaction_id=gateway_id,
                provider_response=data,
            )
            created_any = created_any or created

        return Response({
            'status': 'ok',
            'reference': reference,
            'orders': [str(o.order_number) for o in orders],
            'created': created_any,
        }, status=status.HTTP_200_OK)

    @staticmethod
    def _handle_failed(data, payload_data):
        reference = payload_data.get('reference', '')
        gateway_id = payload_data.get('id', '')

        txn = PaymentTransaction.objects.filter(
            idempotency_key=f'paysuite:{reference}',
        ).first() or PaymentTransaction.objects.filter(
            provider_transaction_id=gateway_id, provider='paysuite',
        ).first()

        if txn and txn.status != 'failed':
            txn.status = 'failed'
            txn.provider_response = data
            txn.error_message = payload_data.get('message', '') or 'Pagamento falhou.'
            txn.save(update_fields=['status', 'provider_response', 'error_message', 'updated_at'])

        logger.warning('Webhook PaySuite payment.failed: %s', data)
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)

    @staticmethod
    def _mark_txn_completed(reference, gateway_id, data, amount=Decimal('0.00')):
        txn, _ = PaymentTransaction.objects.get_or_create(
            idempotency_key=f'paysuite:{reference}',
            defaults={
                'provider': 'paysuite',
                'provider_transaction_id': gateway_id,
                'amount': amount,
                'currency': 'MZN',
                'status': 'completed',
                'provider_response': data,
                'completed_at': timezone.now(),
            },
        )
        if txn.status != 'completed':
            txn.status = 'completed'
            if gateway_id and not txn.provider_transaction_id:
                txn.provider_transaction_id = gateway_id
            txn.provider_response = data
            txn.completed_at = timezone.now()
            txn.save(update_fields=['status', 'provider_transaction_id', 'provider_response', 'completed_at', 'updated_at'])

    @staticmethod
    def _record_failed(data, error_message, gateway_id=''):
        key = f"paysuite:failed:{gateway_id or data.get('reference', '')}"
        PaymentTransaction.objects.get_or_create(
            idempotency_key=key,
            defaults={
                'provider': 'paysuite',
                'amount': 0,
                'currency': 'MZN',
                'status': 'failed',
                'provider_response': data,
                'error_message': error_message,
            },
        )
