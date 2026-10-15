"""Testes do fecho do elo de pagamento (W0) via ZumboPay.

Fluxo testado: initiate (cria transacção + referência) → webhook
`payment.succeeded` (assinado por HMAC) → mapeia a referência →
`complete_payment` → liquidação do vendedor.
"""
import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderStatusHistory
from apps.payments.models import PaymentTransaction
from apps.payments.services.completion import complete_payment
from apps.payments.services.reconciliation import (
    map_gateway_status,
    reconcile_checkout,
    reconcile_stale_payments,
)
from apps.payments.services.zumbopay import ZumbopayClient
from apps.payments.tasks import reconcile_pending_payments
from apps.stores.models import Store
from apps.wallet.services import get_wallet

User = get_user_model()

WEBHOOK_SECRET = 'whsec_teste_segredo'


def _sign(body, secret=WEBHOOK_SECRET):
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def _post_webhook(client, payload, *, signature=None, secret=WEBHOOK_SECRET):
    """Publica um webhook assinado.

    O endpoint falha fechado: sem assinatura válida (ou sem segredo configurado)
    o pedido é recusado, por isso os testes têm de assinar como o gateway faz —
    HMAC-SHA256 em hex do corpo bruto exacto.
    """
    body = json.dumps(payload)
    return client.post(
        reverse('zumbopay_webhook'),
        data=body,
        content_type='application/json',
        HTTP_X_ZUMBOPAY_SIGNATURE=_sign(body, secret) if signature is None else signature,
    )


@pytest.fixture(autouse=True)
def _configured_webhook_secret(settings):
    """Segredo fixo nos testes para que a assinatura seja sempre exercida."""
    settings.ZUMBOPAY_WEBHOOK_SECRET = WEBHOOK_SECRET


def _success_payload(reference, gateway_reference='ZP_AB12CD34'):
    """Payload de sucesso. ``reference`` é o campo devolvido pelo gateway."""
    return {
        'event': 'payment.succeeded',
        'data': {'id': gateway_reference, 'amount': '100.00', 'reference': reference},
    }


@pytest.fixture
def buyer(db):
    return User.objects.create_user(
        email='comprador@example.com', username='comprador', password='SenhaForte123!'
    )


@pytest.fixture
def seller(db):
    return User.objects.create_user(
        email='vendedor@example.com', username='vendedor', password='SenhaForte123!'
    )


@pytest.fixture
def staff(db):
    return User.objects.create_user(
        email='staff@example.com', username='staff', password='SenhaForte123!',
        is_staff=True,
    )


@pytest.fixture
def store(db, seller):
    return Store.objects.create(
        owner=seller,
        name='Loja Teste',
        description='Loja para testes',
        category='geral',
        product_type='digital',
        phone='840000000',
        email='loja@example.com',
        location='Maputo',
        status='active',
    )


@pytest.fixture
def digital_order(db, buyer, store):
    return Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        platform_fee=Decimal('0.00'),
        affiliate_commission=Decimal('0.00'),
        payment_method='mpesa',
        payment_status='pending',
        shipping_address={},
    )


@pytest.mark.django_db
def test_complete_payment_marks_completed_and_settles(digital_order):
    order, created = complete_payment(
        digital_order.id, provider='zumbopay', provider_transaction_id='ZP_AB12CD34',
        provider_response={'event': 'payment.succeeded'},
    )

    assert created is True
    order.refresh_from_db()
    assert order.payment_status == 'completed'
    assert order.status == 'confirmed'

    # Liquidação: crédito do vendedor (digital, sem escrow)
    seller_wallet = get_wallet(order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')
    assert OrderStatusHistory.objects.filter(order=order, new_status='confirmed').exists()


@pytest.mark.django_db
def test_complete_payment_idempotent(digital_order):
    _, created = complete_payment(
        digital_order.id, provider='zumbopay', provider_transaction_id='ZP_AB12CD34'
    )
    assert created is True

    _, created2 = complete_payment(
        digital_order.id, provider='zumbopay', provider_transaction_id='ZP_AB12CD34'
    )
    assert created2 is False

    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')  # creditado apenas uma vez


@pytest.mark.django_db
def test_initiate_creates_zumbopay_payment(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)

    create_resp = {
        'ok': True,
        'data': {
            'reference': 'ZP_AB12CD34',
            'slug': 'encomenda-teste',
            'status': 'active',
            'checkout_url': 'https://zumbopay.com/pay/encomenda-teste',
        },
        'message': None,
        'http_status': 201,
    }
    with mock.patch.object(ZumbopayClient, 'create_payment', return_value=create_resp):
        resp = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)], 'method': 'mpesa'},
            format='json',
        )

    assert resp.status_code == 200
    assert resp.data['checkout_url'] == 'https://zumbopay.com/pay/encomenda-teste'
    assert resp.data['reference'] == digital_order.order_number
    assert resp.data['payment_id'] == 'ZP_AB12CD34'

    digital_order.refresh_from_db()
    assert digital_order.payment_id == digital_order.order_number

    txn = PaymentTransaction.objects.get(idempotency_key=f'zumbopay:{digital_order.order_number}')
    assert txn.provider == 'zumbopay'
    assert txn.provider_transaction_id == 'ZP_AB12CD34'
    assert txn.status == 'pending'
    assert txn.amount == Decimal('100.00')
    # A resposta é guardada com a nossa referência, para o webhook ser auditável.
    assert txn.provider_response['merchant_reference'] == digital_order.order_number


@pytest.mark.django_db
def test_initiate_rejects_unsupported_method(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)

    resp = client.post(
        reverse('payments_initiate'),
        {'order_ids': [str(digital_order.id)], 'method': 'bitcoin'},
        format='json',
    )

    assert resp.status_code == 400
    assert 'bitcoin' in resp.data['error']


@pytest.mark.django_db
def test_initiate_reports_missing_wallet(digital_order, buyer):
    """Sem `wallet_id` configurado o gateway não pode cobrar — erro explícito."""
    client = APIClient()
    client.force_authenticate(user=buyer)

    with override_settings(ZUMBOPAY_WALLET_MPESA=''):
        resp = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)], 'method': 'mpesa'},
            format='json',
        )

    assert resp.status_code == 502
    assert 'mpesa' in resp.data['error']
    assert PaymentTransaction.objects.filter(
        order=digital_order, provider='zumbopay', status='failed',
    ).exists()


@pytest.mark.django_db
def test_webhook_succeeded_completes_and_settles(digital_order):
    # Simula o estado pós-initiate: referência do checkout gravada no payment_id
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)
    resp = _post_webhook(client, payload)

    assert resp.status_code == 200
    assert resp.data['created'] is True

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'

    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')

    txn = PaymentTransaction.objects.get(idempotency_key=f'zumbopay:{digital_order.order_number}')
    assert txn.status == 'completed'


@pytest.mark.django_db
def test_webhook_maps_by_gateway_reference(digital_order):
    """O gateway devolve a referência dele (``ZP…``), não a nossa.

    Como a API não aceita uma referência do comerciante, o mapeamento tem de ser
    reconstruído a partir da transacção persistida no ``initiate``.
    """
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    PaymentTransaction.objects.create(
        order=digital_order,
        provider='zumbopay',
        provider_transaction_id='ZP_AB12CD34',
        idempotency_key=f'zumbopay:{digital_order.order_number}',
        amount=Decimal('100.00'),
        currency='MZN',
        status='pending',
        provider_response={'merchant_reference': digital_order.order_number},
    )

    client = APIClient()
    # O payload só traz a referência do gateway — a nossa não aparece em lado nenhum.
    payload = _success_payload('ZP_AB12CD34')
    resp = _post_webhook(client, payload)

    assert resp.status_code == 200
    assert resp.data['created'] is True
    assert resp.data['reference'] == digital_order.order_number

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'

    txn = PaymentTransaction.objects.get(idempotency_key=f'zumbopay:{digital_order.order_number}')
    assert txn.status == 'completed'


@pytest.mark.django_db
def test_webhook_failure_marks_order_failed(digital_order):
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    resp = _post_webhook(client, {
        'event': 'payment.failed',
        'data': {'reference': digital_order.order_number, 'message': 'psp_declined'},
    })

    assert resp.status_code == 200

    # Sem isto o polling de `/payments/status/` reportaria "pending" para sempre.
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'failed'


@pytest.mark.django_db
def test_webhook_ignores_unhandled_event(digital_order):
    client = APIClient()
    resp = _post_webhook(client, {'event': 'subscription.charged', 'data': {}})

    assert resp.status_code == 200
    assert resp.data['handled'] is False


@pytest.mark.django_db
def test_webhook_succeeded_idempotent(digital_order):
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)

    first = _post_webhook(client, payload)
    second = _post_webhook(client, payload)

    assert first.status_code == second.status_code == 200
    assert second.data['created'] is False

    digital_order.refresh_from_db()
    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')  # liquidado uma vez


@pytest.mark.django_db
def test_webhook_unknown_reference_records_failed():
    client = APIClient()
    payload = _success_payload('PED-NAO-EXISTE', gateway_reference='ZP_NAO_EXISTE')
    resp = _post_webhook(client, payload)

    assert resp.status_code == 200
    assert resp.data['mapped'] is False
    assert PaymentTransaction.objects.filter(
        status='failed', provider='zumbopay', provider_transaction_id=''
    ).exists()


@override_settings(ZUMBOPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
@pytest.mark.django_db
def test_webhook_verifies_signature(digital_order):
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)

    # Assinatura inválida → 400
    bad = _post_webhook(client, payload, signature='bad')
    assert bad.status_code == 400

    # Corpo assinado com outro segredo → 400
    wrong_secret = _post_webhook(client, payload, secret='outro_segredo')
    assert wrong_secret.status_code == 400

    # Assinatura válida (hex do corpo bruto exacto) → 200
    good = _post_webhook(client, payload)
    assert good.status_code == 200
    assert good.data['created'] is True


@pytest.mark.django_db
def test_webhook_fails_closed_without_secret(digital_order, settings):
    """Sem segredo configurado o endpoint recusa — ninguém marca encomendas pagas.

    Em produção (`DEBUG=False`) um pedido não assinado não pode ser aceite só
    porque falta a configuração. A reconciliação fecha o que daí resultar.
    """
    settings.ZUMBOPAY_WEBHOOK_SECRET = ''
    settings.DEBUG = False

    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)
    body = json.dumps(payload)

    resp = client.post(reverse('zumbopay_webhook'), data=body,
                       content_type='application/json')

    assert resp.status_code == 503
    assert 'secret' in resp.data['error'].lower()

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@pytest.mark.django_db
def test_webhook_tolerates_missing_secret_in_debug(digital_order, settings):
    """Em desenvolvimento o webhook continua utilizável sem segredo configurado."""
    settings.ZUMBOPAY_WEBHOOK_SECRET = ''
    settings.DEBUG = True

    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)
    body = json.dumps(payload)

    resp = client.post(reverse('zumbopay_webhook'), data=body,
                       content_type='application/json')

    assert resp.status_code == 200
    assert resp.data['created'] is True

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'


def test_verify_signature_unit():
    secret = 's3cr3t'
    client = ZumbopayClient(webhook_secret=secret)
    body = '{"event":"payment.succeeded","data":{"reference":"ZP_AB12CD34"}}'
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()

    assert client.verify_signature(body, sig) is True
    # O gateway pode enviar o hex em maiúsculas.
    assert client.verify_signature(body, sig.upper()) is True
    assert client.verify_signature(body, 'nope') is False
    assert client.verify_signature(body, '') is False


def test_available_channels_reflects_configured_wallets():
    client = ZumbopayClient(wallets={'mpesa': 'w-mpesa', 'emola': '', 'card': 'w-card'})

    assert client.available_channels() == ['mpesa', 'card']
    assert client.resolve_wallet_id('card') == 'w-card'
    assert client.resolve_wallet_id('emola') == ''
    assert client.resolve_wallet_id(None) == ''


def test_create_payment_requires_a_wallet():
    """`wallet_id` é obrigatório no contrato — falha antes de tocar a rede."""
    client = ZumbopayClient(
        api_key='zk_test_x', wallets={'mpesa': '', 'emola': '', 'card': ''},
    )

    result = client.create_payment(amount='100.00', reference='PED-1', method='mpesa')

    assert result['ok'] is False
    assert 'mpesa' in result['message']
    assert result['http_status'] is None


def test_error_message_reads_zumbopay_envelope():
    """O ZumboPay usa ``{"error": {code, message}}``, não ``{"status": ...}``."""
    assert ZumbopayClient._error_message(
        {'error': {'code': 'invalid_input', 'message': 'wallet_id é obrigatório'}}
    ) == 'wallet_id é obrigatório'
    assert ZumbopayClient._error_message({'error': {'code': 'not_found'}}) == 'not_found'
    assert ZumbopayClient._error_message({}) == ''


# ─────────────────────────────────────────────────────────────────────────────
# Reconciliação — rede de segurança para webhooks que não chegam
# ─────────────────────────────────────────────────────────────────────────────

def _gateway_payment(status='completed', reference='ZP_AB12CD34'):
    return {
        'ok': True,
        'data': {'reference': reference, 'slug': 'encomenda-teste', 'status': status,
                 'amount': '100.00', 'currency': 'MZN'},
        'message': None,
        'http_status': 200,
    }


def _pending_transaction(order, gateway_reference='ZP_AB12CD34', age_minutes=30):
    """Simula o estado pós-initiate: referência na encomenda + transacção pendente."""
    order.payment_id = order.order_number
    order.save(update_fields=['payment_id'])

    txn = PaymentTransaction.objects.create(
        order=order,
        provider='zumbopay',
        provider_transaction_id=gateway_reference,
        idempotency_key=f'zumbopay:{order.order_number}',
        amount=Decimal('100.00'),
        currency='MZN',
        status='pending',
        provider_response={'merchant_reference': order.order_number},
    )
    if age_minutes:
        moment = timezone.now() - timedelta(minutes=age_minutes)
        PaymentTransaction.objects.filter(pk=txn.pk).update(created_at=moment)
        Order.objects.filter(pk=order.pk).update(updated_at=moment)
    return txn


def test_map_gateway_status():
    assert map_gateway_status('completed') == 'completed'
    assert map_gateway_status('PAID') == 'completed'
    assert map_gateway_status('expired') == 'failed'
    assert map_gateway_status('declined') == 'failed'
    # `refunded` pressupõe um pagamento aceite — nunca é tratado como falha.
    assert map_gateway_status('refunded') == 'pending'
    assert map_gateway_status('active') == 'pending'
    assert map_gateway_status('') == 'pending'
    assert map_gateway_status(None) == 'pending'


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_closes_payment_the_webhook_never_brought(digital_order):
    """O caso que motiva a reconciliação: o comprador pagou, o webhook perdeu-se."""
    _pending_transaction(digital_order)

    with mock.patch.object(
        ZumbopayClient, 'get_payment',
        return_value=_gateway_payment('completed'),
    ) as call:
        result = reconcile_checkout(digital_order.order_number)

    assert result['checked'] is True
    assert result['gateway_status'] == 'completed'
    assert result['status'] == 'completed'
    assert result['completed'] == [digital_order.order_number]
    # Consultado pela referência do gateway, não pela nossa.
    assert call.call_args.args[0] == 'ZP_AB12CD34'

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'

    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')

    txn = PaymentTransaction.objects.get(idempotency_key=f'zumbopay:{digital_order.order_number}')
    assert txn.status == 'completed'
    assert txn.provider_response['source'] == 'reconciliation'


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_is_idempotent(digital_order):
    """Correr a reconciliação depois do webhook não pode creditar duas vezes."""
    _pending_transaction(digital_order)

    with mock.patch.object(ZumbopayClient, 'get_payment',
                           return_value=_gateway_payment('completed')):
        first = reconcile_checkout(digital_order.order_number)
        second = reconcile_checkout(digital_order.order_number)

    assert first['completed'] == [digital_order.order_number]
    assert second['completed'] == []  # já fechado — nada de novo

    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_marks_order_failed_when_gateway_declines(digital_order):
    _pending_transaction(digital_order)

    with mock.patch.object(ZumbopayClient, 'get_payment',
                           return_value=_gateway_payment('expired')):
        result = reconcile_checkout(digital_order.order_number)

    assert result['status'] == 'failed'
    assert result['failed'] == [digital_order.order_number]

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'failed'

    txn = PaymentTransaction.objects.get(idempotency_key=f'zumbopay:{digital_order.order_number}')
    assert txn.status == 'failed'
    assert 'expired' in txn.error_message


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_leaves_unpaid_order_alone(digital_order):
    _pending_transaction(digital_order)

    with mock.patch.object(ZumbopayClient, 'get_payment',
                           return_value=_gateway_payment('active')):
        result = reconcile_checkout(digital_order.order_number)

    assert result['status'] == 'pending'
    assert result['completed'] == [] and result['failed'] == []

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@pytest.mark.django_db
def test_reconcile_does_nothing_without_credentials(digital_order):
    """Sem chave configurada nem se toca na rede (evita 401 em série)."""
    _pending_transaction(digital_order)

    with override_settings(ZUMBOPAY_API_KEY=''):
        with mock.patch.object(ZumbopayClient, 'get_payment') as call:
            result = reconcile_checkout(digital_order.order_number)

    assert result['checked'] is False
    assert 'não configurado' in result['error']
    call.assert_not_called()

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_reports_gateway_error(digital_order):
    """Um erro de rede não pode alterar nada nem rebentar."""
    _pending_transaction(digital_order)

    with mock.patch.object(ZumbopayClient, 'get_payment',
                           return_value={'ok': False, 'data': None,
                                         'message': 'timeout', 'http_status': None}):
        result = reconcile_checkout(digital_order.order_number)

    assert result['checked'] is False
    assert result['error'] == 'timeout'
    assert result['completed'] == []

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@pytest.mark.django_db
def test_reconcile_unknown_reference():
    result = reconcile_checkout('PED-INEXISTENTE')

    assert result['checked'] is False
    assert 'não encontrada' in result['error']


@pytest.mark.django_db
def test_reconcile_batch_ignores_fresh_and_too_old(digital_order):
    """O lote só olha para a janela útil — nem recente demais nem abandonado."""
    _pending_transaction(digital_order, age_minutes=1)  # demasiado recente
    with override_settings(ZUMBOPAY_API_KEY='zk_test_recon'):
        recent = reconcile_stale_payments()

    assert recent['candidates'] == 0

    PaymentTransaction.objects.update(created_at=timezone.now() - timedelta(hours=72))
    Order.objects.update(updated_at=timezone.now() - timedelta(hours=72))
    with override_settings(ZUMBOPAY_API_KEY='zk_test_recon'):
        stale = reconcile_stale_payments()

    assert stale['candidates'] == 0
    assert stale['too_old'] >= 1


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_task_closes_stale_payment(digital_order):
    """A tarefa periódica fecha o pagamento sem intervenção humana."""
    _pending_transaction(digital_order)

    with mock.patch.object(ZumbopayClient, 'get_payment',
                           return_value=_gateway_payment('completed')):
        message = reconcile_pending_payments()

    assert '1 verificado' in message
    assert digital_order.order_number in message

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'


@pytest.mark.django_db
def test_reconcile_endpoint_is_staff_only(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)

    resp = client.post(reverse('payments_reconcile'),
                       {'order_id': str(digital_order.id)}, format='json')

    assert resp.status_code == 403


@override_settings(ZUMBOPAY_API_KEY='zk_test_recon')
@pytest.mark.django_db
def test_reconcile_endpoint_closes_order_for_staff(digital_order, staff):
    _pending_transaction(digital_order)

    api = APIClient()
    api.force_authenticate(user=staff)

    with mock.patch.object(ZumbopayClient, 'get_payment',
                           return_value=_gateway_payment('completed')):
        resp = api.post(reverse('payments_reconcile'),
                        {'order_id': digital_order.order_number}, format='json')

    assert resp.status_code == 200
    assert resp.data['status'] == 'completed'
    assert resp.data['completed'] == [digital_order.order_number]

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'


@pytest.mark.django_db
def test_reconcile_endpoint_rejects_order_without_payment(staff):
    api = APIClient()
    api.force_authenticate(user=staff)

    resp = api.post(reverse('payments_reconcile'),
                    {'order_id': 'PED-QUE-NAO-EXISTE'}, format='json')

    assert resp.status_code == 404


@override_settings(ZUMBOPAY_API_KEY='')
@pytest.mark.django_db
def test_reconcile_endpoint_distinguishes_unreachable_gateway(digital_order, staff):
    """Encomenda existe mas o gateway não responde: 502, não 404."""
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    api = APIClient()
    api.force_authenticate(user=staff)

    resp = api.post(reverse('payments_reconcile'),
                    {'order_id': digital_order.order_number}, format='json')

    assert resp.status_code == 502
    assert 'não configurado' in resp.data['error']


@pytest.mark.django_db
def test_reconcile_endpoint_requires_an_identifier(staff):
    api = APIClient()
    api.force_authenticate(user=staff)

    resp = api.post(reverse('payments_reconcile'), {}, format='json')

    assert resp.status_code == 400


# ─── Diagnóstico do gateway ───

@pytest.mark.django_db
def test_gateway_validate_flags_webhook_url_mismatch(staff):
    """Um webhook registado fora do nosso caminho entrega num 404.

    Foi observado numa conta real: o endereço estava registado na raiz do
    domínio. O pagamento continuaria a ser cobrado mas nunca seria confirmado
    pelo caminho normal — o diagnóstico tem de o dizer sem rodeios.
    """
    api = APIClient()
    api.force_authenticate(user=staff)

    def _validate(url):
        return {
            'ok': True, 'http_status': 200, 'message': None,
            'data': {
                'ready': False,
                'missing': ['wallet_emola', 'wallet_card'],
                'webhook': {'url': url, 'secret': 'whsec_nao_pode_sair'},
            },
        }

    with mock.patch.object(ZumbopayClient, 'validate_merchant',
                           return_value=_validate('https://e-shoppingcentre.com')):
        resp = api.get(reverse('payments_gateway_validate'))

    assert resp.status_code == 200
    assert resp.data['webhook_url_ok'] is False
    assert resp.data['expected_webhook_path'] == '/api/v1/payments/webhook/zumbopay/'
    # O segredo de assinatura nunca sai, nem para staff.
    assert 'secret' not in resp.data['webhook']


@pytest.mark.django_db
def test_gateway_validate_accepts_correct_webhook_url(staff):
    api = APIClient()
    api.force_authenticate(user=staff)

    for url in (
        'https://e-shoppingcentre.com/api/v1/payments/webhook/zumbopay/',
        'https://e-shoppingcentre.com/api/v1/payments/webhook/zumbopay',  # barra final opcional
    ):
        with mock.patch.object(ZumbopayClient, 'validate_merchant', return_value={
            'ok': True, 'http_status': 200, 'message': None,
            'data': {'ready': True, 'missing': [], 'webhook': {'url': url}},
        }):
            resp = api.get(reverse('payments_gateway_validate'))

        assert resp.data['webhook_url_ok'] is True, url
