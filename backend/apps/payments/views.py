import logging
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.crypto import get_random_string
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.payments.services.completion import (
    complete_payment,
    mark_transaction_completed,
    mark_transaction_failed,
    record_unmapped_payment,
)
from apps.payments.services.reconciliation import reconcile_checkout
from apps.payments.services.references import (
    find_transaction_for_order,
    idempotency_key,
    merchant_reference,
    resolve_orders,
    resolve_orders_from_gateway,
)
from apps.payments.services.zumbopay import SUPPORTED_CHANNELS, ZumbopayClient

logger = logging.getLogger(__name__)

# Caminho onde este backend serve o webhook. É o que tem de estar registado no
# Painel ZumboPay → Programadores; comparado com o que lá está no diagnóstico.
WEBHOOK_PATH = '/api/v1/payments/webhook/zumbopay/'


def _webhook_url():
    """URL pública onde o ZumboPay entrega os webhooks.

    Não é enviada no pedido de pagamento — o gateway usa a URL registada no
    Painel ZumboPay → Programadores. Existe para documentação e para o
    diagnóstico do gateway.
    """
    base = getattr(settings, 'ZUMBOPAY_WEBHOOK_URL', None)
    if base:
        return base
    site = getattr(settings, 'BACKEND_URL', '').rstrip('/')
    return f'{site}{WEBHOOK_PATH}' if site else ''


class PaymentsInitiateView(APIView):
    """Inicia um pagamento ZumboPay para uma ou mais encomendas pendentes.

    Resolve a carteira do método escolhido, cria o link de pagamento, regista a
    transacção no ledger e devolve a ``checkout_url`` hospedada do ZumboPay.
    Grava a referência do checkout em ``Order.payment_id`` para que o webhook
    consiga mapear as encomendas.
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

        method = str(request.data.get('method') or '').strip().lower()
        if method and method not in SUPPORTED_CHANNELS:
            return Response(
                {'error': f'Método de pagamento «{method}» não é suportado pelo gateway.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Um pagamento cobre o total das encomendas ainda por pagar.
        payable = pending or orders
        total = sum((o.total for o in payable), Decimal('0.00'))
        if total <= 0:
            return Response({'error': 'Montante de pagamento inválido.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if len(payable) == 1:
            reference = payable[0].order_number
            title = f'Encomenda {payable[0].order_number}'
        else:
            reference = f'CHECKOUT-{get_random_string(10).upper()}'
            title = f'Compra de {len(payable)} encomendas'

        description = ', '.join(o.order_number for o in payable)[:200]

        client = ZumbopayClient()
        if not method and not client.available_channels():
            return Response(
                {'error': 'O gateway de pagamento não está configurado. Contacte o suporte.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        result = client.create_payment(
            amount=total,
            reference=reference,
            title=title,
            description=description,
            method=method or None,
        )

        if not result['ok']:
            PaymentTransaction.objects.create(
                order=payable[0],
                provider='zumbopay',
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
        gateway_reference = data.get('reference') or data.get('id') or ''
        checkout_url = data.get('checkout_url') or ''

        if not checkout_url:
            logger.error('ZumboPay devolveu um pagamento sem checkout_url: %s', data)
            return Response(
                {'error': 'O gateway não devolveu um link de pagamento. Tente novamente.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            txn, _ = PaymentTransaction.objects.get_or_create(
                idempotency_key=idempotency_key(reference),
                defaults={
                    'order': payable[0],
                    'provider': 'zumbopay',
                    'provider_transaction_id': gateway_reference,
                    'amount': total,
                    'currency': 'MZN',
                    'status': 'pending',
                    # A resposta é guardada com a nossa referência para que o
                    # mapeamento do webhook fique auditável.
                    'provider_response': {**data, 'merchant_reference': reference},
                },
            )
            if gateway_reference and txn.provider_transaction_id != gateway_reference:
                txn.provider_transaction_id = gateway_reference
                txn.save(update_fields=['provider_transaction_id', 'updated_at'])

            for order in payable:
                order.payment_id = reference
                order.save(update_fields=['payment_id', 'updated_at'])

        return Response({
            'checkout_url': checkout_url,
            'payment_id': gateway_reference,
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

        orders = resolve_orders(reference).filter(buyer=request.user)
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


class ZumbopayWebhookView(APIView):
    """Webhook ZumboPay — fecha o elo de pagamento (W0).

    Eventos tratados: ``payment.succeeded`` (liquida e credita) e
    ``payment.failed``. Os restantes (``payout.*``, ``refund.*``,
    ``subscription.*``, ``kyc.*``) são registados para auditoria.

    O payload do webhook não está documentado publicamente, pelo que o
    mapeamento para as encomendas é resolvido de forma tolerante por
    ``resolve_orders_from_gateway`` (services/references.py).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        body = request.body.decode('utf-8') or ''
        signature = request.META.get('HTTP_X_ZUMBOPAY_SIGNATURE', '')

        client = ZumbopayClient()
        rejection = self._verify_origin(client, body, signature)
        if rejection is not None:
            return rejection

        data = request.data if isinstance(request.data, dict) else {}
        event = data.get('event', '')
        payload_data = data.get('data') or {}

        if event == 'payment.succeeded':
            return self._handle_succeeded(data, payload_data)
        if event == 'payment.failed':
            return self._handle_failed(data, payload_data)

        # Eventos de payout/refund/subscription fora do âmbito W0: só auditar.
        logger.info('Webhook ZumboPay evento não tratado: %s', event)
        return Response({'status': 'ok', 'handled': False}, status=status.HTTP_200_OK)

    @staticmethod
    def _verify_origin(client, body, signature):
        """Confirma que o pedido vem mesmo do gateway.

        Falha **fechada**: sem segredo configurado o endpoint recusa tudo fora de
        DEBUG. Isto é seguro porque a reconciliação passou a fechar os pagamentos
        que um webhook rejeitado deixaria pendentes — antes, aceitar pedidos não
        assinados era o mal menor; agora já não é preciso.
        """
        if not client.webhook_secret:
            if settings.DEBUG:
                logger.warning(
                    'Webhook ZumboPay sem ZUMBOPAY_WEBHOOK_SECRET — assinatura ignorada '
                    '(DEBUG activo). Em produção o pedido seria recusado.'
                )
                return None
            logger.critical(
                'Webhook ZumboPay recusado: ZUMBOPAY_WEBHOOK_SECRET não configurado. '
                'Os pagamentos serão fechados pela reconciliação.'
            )
            return Response({'error': 'Webhook secret not configured'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not client.verify_signature(body, signature):
            logger.error('Webhook ZumboPay com assinatura inválida.')
            return Response({'error': 'Invalid signature'},
                            status=status.HTTP_400_BAD_REQUEST)

        return None

    @staticmethod
    def _handle_succeeded(data, payload_data):
        orders, reference = resolve_orders_from_gateway(payload_data)
        gateway_reference = payload_data.get('reference') or payload_data.get('id') or ''

        if not orders.exists():
            logger.warning('Webhook ZumboPay sem encomenda mapeada: %s', data)
            record_unmapped_payment(
                data, 'Encomenda não encontrada para a referência.', gateway_reference,
            )
            return Response({'status': 'ok', 'mapped': False}, status=status.HTTP_200_OK)

        total = sum((o.total for o in orders), Decimal('0.00'))
        mark_transaction_completed(
            idempotency_key(reference), gateway_reference,
            provider_response=data, amount=total,
        )

        created_any = False
        for order in orders:
            _, created = complete_payment(
                order.id,
                provider='zumbopay',
                provider_transaction_id=gateway_reference,
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
        orders, reference = resolve_orders_from_gateway(payload_data)
        gateway_reference = payload_data.get('reference') or payload_data.get('id') or ''
        message = payload_data.get('message', '') or 'Pagamento falhou.'

        mark_transaction_failed(
            idem_key=idempotency_key(reference) if reference else '',
            gateway_reference=gateway_reference,
            provider_response=data,
            error_message=message,
        )

        # Marca as encomendas como falhadas (sem descer uma já paga) para que o
        # polling de `/payments/status/` deixe de reportar "pending" sem fim.
        for order in orders:
            if order.payment_status == 'pending':
                order.payment_status = 'failed'
                order.save(update_fields=['payment_status', 'updated_at'])

        logger.warning('Webhook ZumboPay payment.failed: %s', data)
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)


class GatewayValidateView(APIView):
    """Diagnóstico de prontidão do gateway ZumboPay (``GET /merchant/validate``).

    Devolve o que falta configurar na conta (`missing`), as carteiras por método
    e o webhook registado — sem expor o segredo de assinatura. Apenas staff.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        client = ZumbopayClient()
        result = client.validate_merchant()
        if not result['ok']:
            return Response(
                {'error': result['message'] or 'Erro ao validar o gateway.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        data = result['data'] or {}
        webhook = data.get('webhook')
        registered_url = ''
        if isinstance(webhook, dict):
            registered_url = (webhook.get('url') or '').rstrip('/')
            # Nunca devolver o segredo de assinatura, mesmo a staff.
            webhook = {k: v for k, v in webhook.items() if k != 'secret'}

        # O endereço registado no painel tem de terminar no caminho que este
        # backend serve. Caso contrário o gateway entrega num 404 e a cobrança
        # fica pendente para sempre — falha silenciosa que merece aviso explícito.
        webhook_url_ok = bool(registered_url) and registered_url.endswith(WEBHOOK_PATH.rstrip('/'))

        return Response({
            'ready': data.get('ready'),
            'missing': data.get('missing', []),
            'merchant': data.get('merchant'),
            'wallets': data.get('wallets'),
            'webhook': webhook,
            'configured_channels': client.available_channels(),
            'expected_webhook_url': _webhook_url(),
            'expected_webhook_path': WEBHOOK_PATH,
            'webhook_url_ok': webhook_url_ok,
        }, status=status.HTTP_200_OK)


class PaymentsReconcileView(APIView):
    """Reconciliação manual de um pagamento (staff).

    Para quando o webhook não chegou e o comprador reclama: consulta o gateway
    e, se o pagamento estiver confirmado do lado dele, fecha a encomenda como
    paga (e liquida o vendedor) sem esperar pelo próximo lote automático.

    Aceita ``reference`` (a referência do checkout, em ``Order.payment_id``) ou
    ``order_id`` (o ID ou o número da encomenda).
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        reference = str(request.data.get('reference') or '').strip()
        order_key = str(request.data.get('order_id') or '').strip()

        if not reference and not order_key:
            return Response({'error': 'Indique `reference` ou `order_id`.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if not reference:
            order = self._find_order(order_key)
            if order is None:
                return Response({'error': 'Encomenda não encontrada.'},
                                status=status.HTTP_404_NOT_FOUND)
            reference = order.payment_id
            if not reference:
                # Pode existir transacção sem referência gravada na encomenda.
                txn = find_transaction_for_order(order)
                reference = merchant_reference(txn.idempotency_key) if txn else ''
            if not reference:
                return Response(
                    {'error': 'Esta encomenda não tem nenhum pagamento online iniciado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        result = reconcile_checkout(reference)

        if not result['checked']:
            # Não se falou com o gateway: distinguir "não existe" de "não respondeu".
            if not result['orders']:
                return Response({'error': result['error'], **result},
                                status=status.HTTP_404_NOT_FOUND)
            return Response({'error': result['error'], **result},
                            status=status.HTTP_502_BAD_GATEWAY)

        logger.info('Reconciliação manual de %s por %s: %s',
                    reference, request.user, result['status'])
        return Response(result, status=status.HTTP_200_OK)

    @staticmethod
    def _find_order(order_key):
        order = Order.objects.filter(order_number=order_key).first()
        if order is not None:
            return order
        try:
            return Order.objects.filter(pk=order_key).first()
        except (ValueError, ValidationError):
            return None
