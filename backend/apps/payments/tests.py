"""Testes do fecho do elo de pagamento (W0) via PaySuite.

Fluxo testado: initiate (cria transacção + reference) → webhook `payment.success`
(assina HMAC) → mapeia reference → `complete_payment` → liquidação do vendedor.
"""
import hashlib
import hmac
from decimal import Decimal
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderStatusHistory
from apps.payments.models import PaymentTransaction
from apps.payments.services.completion import complete_payment
from apps.payments.services.paysuite import PaysuiteClient
from apps.payments.views import _gateway_reference as gateway_reference
from apps.stores.models import Store
from apps.wallet.services import get_wallet

User = get_user_model()

WEBHOOK_SECRET = 'whsec_teste_segredo'


def _sign(body, secret=WEBHOOK_SECRET):
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def _success_payload(reference, gateway_id='pay_123'):
    return {
        'event': 'payment.success',
        'data': {'id': gateway_id, 'amount': '100.00', 'reference': reference},
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
        payment_method='paysuite',
        payment_status='pending',
        shipping_address={},
    )


@pytest.mark.django_db
def test_complete_payment_marks_completed_and_settles(digital_order):
    order, created = complete_payment(
        digital_order.id, provider='paysuite', provider_transaction_id='pay_123',
        provider_response={'event': 'payment.success'},
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
        digital_order.id, provider='paysuite', provider_transaction_id='pay_123'
    )
    assert created is True

    _, created2 = complete_payment(
        digital_order.id, provider='paysuite', provider_transaction_id='pay_123'
    )
    assert created2 is False

    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')  # creditado apenas uma vez


@pytest.mark.django_db
def test_initiate_creates_paysuite_payment(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)

    reference = gateway_reference(digital_order.order_number)
    create_resp = {
        'ok': True,
        'data': {'id': 'pay_123', 'reference': reference, 'checkout_url': 'https://paysuite.tech/pay/123'},
        'message': None,
        'http_status': 201,
    }
    with mock.patch.object(PaysuiteClient, 'create_payment', return_value=create_resp):
        resp = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert resp.status_code == 200
    assert resp.data['checkout_url'] == 'https://paysuite.tech/pay/123'
    assert resp.data['reference'] == reference

    digital_order.refresh_from_db()
    assert digital_order.payment_id == reference

    txn = PaymentTransaction.objects.get(idempotency_key=f'paysuite:{reference}')
    assert txn.provider == 'paysuite'
    assert txn.provider_transaction_id == 'pay_123'
    assert txn.status == 'pending'
    assert txn.amount == Decimal('100.00')


@pytest.mark.django_db
def test_initiate_sends_alphanumeric_reference_to_gateway(digital_order, buyer):
    """A PaySuite recusa `reference` com hífen (``PED-8B549F72`` → 422)."""
    client = APIClient()
    client.force_authenticate(user=buyer)

    sent = {}

    def fake_create_payment(**kwargs):
        sent.update(kwargs)
        return {
            'ok': True,
            'data': {'id': 'pay_123', 'reference': kwargs['reference'],
                     'checkout_url': 'https://paysuite.tech/pay/123'},
            'message': None,
            'http_status': 201,
        }

    with mock.patch.object(PaysuiteClient, 'create_payment', side_effect=fake_create_payment):
        resp = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert resp.status_code == 200
    assert sent['reference'].isalnum()
    assert sent['reference'] == gateway_reference(digital_order.order_number)
    assert len(sent['description']) <= 125


def test_gateway_reference_strips_punctuation():
    assert gateway_reference('PED-8B549F72') == 'PED8B549F72'
    assert gateway_reference('CHECKOUT-AB12CD34EF') == 'CHECKOUTAB12CD34EF'
    assert gateway_reference('PED_1.2 3') == 'PED123'


def test_gateway_reference_is_bounded():
    assert len(gateway_reference('A' * 120)) == 50


@override_settings(PAYSUITE_WEBHOOK_SECRET='')
@pytest.mark.django_db
def test_webhook_success_completes_and_settles(digital_order):
    # Simula o estado pós-initiate: reference gravada no payment_id
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)
    resp = client.post(reverse('paysuite_webhook'), payload, format='json')

    assert resp.status_code == 200
    assert resp.data['created'] is True

    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'

    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')

    txn = PaymentTransaction.objects.get(idempotency_key=f'paysuite:{digital_order.order_number}')
    assert txn.status == 'completed'


@override_settings(PAYSUITE_WEBHOOK_SECRET='')
@pytest.mark.django_db
def test_webhook_success_idempotent(digital_order):
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)

    first = client.post(reverse('paysuite_webhook'), payload, format='json')
    second = client.post(reverse('paysuite_webhook'), payload, format='json')

    assert first.status_code == second.status_code == 200
    assert second.data['created'] is False

    digital_order.refresh_from_db()
    seller_wallet = get_wallet(digital_order.store.owner)
    assert seller_wallet.payout_balance == Decimal('100.00')  # liquidado uma vez


@override_settings(PAYSUITE_WEBHOOK_SECRET='')
@pytest.mark.django_db
def test_webhook_unknown_reference_records_failed():
    client = APIClient()
    payload = _success_payload('PED-NAO-EXISTE', gateway_id='pay_unknown')
    resp = client.post(reverse('paysuite_webhook'), payload, format='json')

    assert resp.status_code == 200
    assert resp.data['mapped'] is False
    assert PaymentTransaction.objects.filter(
        status='failed', provider='paysuite', provider_transaction_id=''
    ).exists()


@override_settings(PAYSUITE_WEBHOOK_SECRET=WEBHOOK_SECRET)
@pytest.mark.django_db
def test_webhook_verifies_signature(digital_order):
    digital_order.payment_id = digital_order.order_number
    digital_order.save(update_fields=['payment_id'])

    client = APIClient()
    payload = _success_payload(digital_order.order_number)

    # Assinatura inválida → 400
    bad = client.post(
        reverse('paysuite_webhook'), payload, format='json', HTTP_X_SIGNATURE='bad'
    )
    assert bad.status_code == 400

    # Assinatura válida (hex do corpo bruto exacto) → 200
    import json
    body = json.dumps(payload)
    good = client.post(
        reverse('paysuite_webhook'),
        data=body,
        content_type='application/json',
        HTTP_X_SIGNATURE=_sign(body),
    )
    assert good.status_code == 200
    assert good.data['created'] is True


def test_verify_signature_unit():
    secret = 's3cr3t'
    client = PaysuiteClient(webhook_secret=secret)
    body = '{"event":"payment.success","data":{"reference":"PED-1"}}'
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()

    assert client.verify_signature(body, sig) is True
    assert client.verify_signature(body, 'nope') is False


def test_verify_signature_stripe_style():
    secret = 's3cr3t'
    client = PaysuiteClient(webhook_secret=secret)
    body = '{"event":"payment.success"}'
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    stamped = f't=1700000000,v1={sig}'

    assert client.verify_signature(body, stamped) is True
