"""Testes da integração de pagamentos VPay e liquidação idempotente."""
import hashlib
import hmac
import json
from decimal import Decimal
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.payments.models import PaymentTransaction
from apps.payments.services.completion import complete_payment
from apps.payments.services.vpay import VPayClient
from apps.payments.views import _build_order_payload, _checkout_url, _friendly_error
from apps.stores.models import Store
from apps.wallet.services import get_wallet

User = get_user_model()
WEBHOOK_SECRET = 'vpay_webhook_test_secret'


def _sign(body, secret=WEBHOOK_SECRET):
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f'sha256={digest}'


def _confirmed_event(order_id, amount='100.00', transaction_id='txn_123'):
    return {
        'event': 'payment.confirmed',
        'orderId': order_id,
        'status': 'paid',
        'amount': amount,
        'currency': 'MZN',
        'transactionId': transaction_id,
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
        payment_method='mpesa',
        payment_status='pending',
        shipping_address={},
    )


@pytest.mark.django_db
def test_complete_payment_marks_completed_and_settles(digital_order):
    order, created = complete_payment(
        digital_order.id,
        provider='vpay',
        provider_transaction_id='txn_123',
        provider_response={'event': 'payment.confirmed'},
    )

    assert created is True
    order.refresh_from_db()
    assert order.payment_status == 'completed'
    assert order.status == 'confirmed'
    assert get_wallet(order.store.owner).payout_balance == Decimal('100.00')
    assert OrderStatusHistory.objects.filter(order=order, new_status='confirmed').exists()


@pytest.mark.django_db
def test_complete_payment_is_idempotent(digital_order):
    _, first_created = complete_payment(
        digital_order.id, provider='vpay', provider_transaction_id='txn_123'
    )
    _, second_created = complete_payment(
        digital_order.id, provider='vpay', provider_transaction_id='txn_123'
    )

    assert first_created is True
    assert second_created is False
    assert get_wallet(digital_order.store.owner).payout_balance == Decimal('100.00')


@pytest.mark.django_db
@override_settings(
    VPAY_CLIENT_ID='client-test',
    VPAY_CLIENT_SECRET='secret-test',
    VPAY_WEBHOOK_SECRET=WEBHOOK_SECRET,
)
def test_initiate_creates_vpay_order(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)
    create_result = {
        'ok': True,
        'data': {'orderId': 'vpay_order_123', 'status': True},
        'message': None,
        'http_status': 201,
    }

    with mock.patch.object(VPayClient, 'create_order', return_value=create_result) as create_order:
        response = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert response.status_code == 200
    assert response.data['checkout_url'] == 'https://checkout.vpay.co.mz/vpay_order_123'
    assert response.data['reference'] == 'vpay_order_123'
    payload = create_order.call_args.args[0]
    assert payload['source']['source'] == 'api'
    assert payload['customer']['email'] == buyer.email
    assert payload['items'] == [{
        'originProductId': f'order-{digital_order.id}',
        'name': f'Encomenda {digital_order.order_number}',
        'quantity': 1,
        'price': 100.0,
    }]

    digital_order.refresh_from_db()
    assert digital_order.payment_id == 'vpay_order_123'
    transaction_record = PaymentTransaction.objects.get(
        gateway_order_id='vpay_order_123'
    )
    assert transaction_record.provider == 'vpay'
    assert transaction_record.provider_transaction_id == ''
    assert transaction_record.status == 'pending'


@pytest.mark.django_db
@override_settings(
    VPAY_CLIENT_ID='client-test',
    VPAY_CLIENT_SECRET='secret-test',
    VPAY_WEBHOOK_SECRET=WEBHOOK_SECRET,
)
def test_initiate_prefers_gateway_checkout_url(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)
    create_result = {
        'ok': True,
        'data': {
            'orderId': 'vpay_order_456',
            'checkout': 'https://checkout.vpay.co.mz/vpay_order_456',
        },
        'message': None,
        'http_status': 201,
    }

    with mock.patch.object(VPayClient, 'create_order', return_value=create_result):
        response = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert response.status_code == 200
    assert response.data['checkout_url'] == 'https://checkout.vpay.co.mz/vpay_order_456'


@pytest.mark.django_db
@override_settings(
    VPAY_CLIENT_ID='client-test',
    VPAY_CLIENT_SECRET='secret-test',
    VPAY_WEBHOOK_SECRET=WEBHOOK_SECRET,
)
def test_repeated_initiation_reuses_active_attempt(digital_order, buyer):
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_order_existing',
        source_id='source-existing',
        amount=digital_order.total,
        currency='MZN',
        status='pending',
        provider_response={'checkout': 'https://checkout.vpay.co.mz/existing'},
    )
    attempt.orders.add(digital_order)
    digital_order.payment_id = attempt.gateway_order_id
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    client.force_authenticate(user=buyer)

    with mock.patch.object(VPayClient, 'create_order') as create_order:
        response = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert response.status_code == 200
    assert response.data['reference'] == attempt.gateway_order_id
    create_order.assert_not_called()
    assert PaymentTransaction.objects.filter(provider='vpay').count() == 1


@pytest.mark.django_db
@override_settings(
    VPAY_CLIENT_ID='client-test',
    VPAY_CLIENT_SECRET='secret-test',
)
def test_partial_retry_cannot_split_an_open_checkout(digital_order, buyer, store):
    second_order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        platform_fee=Decimal('0.00'),
        affiliate_commission=Decimal('0.00'),
        payment_method='vpay',
        payment_status='pending',
        shipping_address={},
    )
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_split_open',
        amount=Decimal('200.00'),
        currency='MZN',
        status='pending',
    )
    attempt.orders.add(digital_order, second_order)
    for order in (digital_order, second_order):
        order.payment_id = attempt.gateway_order_id
        order.save(update_fields=['payment_id'])
    client = APIClient()
    client.force_authenticate(user=buyer)

    with mock.patch.object(VPayClient, 'create_order') as create_order:
        response = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert response.status_code == 409
    assert response.data['reference'] == attempt.gateway_order_id
    create_order.assert_not_called()
    assert PaymentTransaction.objects.filter(provider='vpay').count() == 1
    digital_order.refresh_from_db()
    second_order.refresh_from_db()
    assert digital_order.payment_id == second_order.payment_id == attempt.gateway_order_id


@pytest.mark.django_db
@override_settings(VPAY_CLIENT_ID='client-test', VPAY_CLIENT_SECRET='secret-test')
def test_initiation_rejects_cancelled_order(digital_order, buyer):
    digital_order.status = 'cancelled'
    digital_order.save(update_fields=['status'])
    client = APIClient()
    client.force_authenticate(user=buyer)

    with mock.patch.object(VPayClient, 'create_order') as create_order:
        response = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert response.status_code == 409
    create_order.assert_not_called()
    assert not PaymentTransaction.objects.filter(provider='vpay').exists()


@pytest.mark.django_db
@override_settings(
    VPAY_CLIENT_ID='client-test',
    VPAY_CLIENT_SECRET='secret-test',
)
def test_ambiguous_creation_is_not_retried_automatically(digital_order, buyer):
    ambiguous_result = {
        'ok': False,
        'data': None,
        'message': 'Gateway timeout',
        'http_status': 504,
        'outcome_unknown': True,
    }
    client = APIClient()
    client.force_authenticate(user=buyer)

    with mock.patch.object(
            VPayClient, 'create_order', return_value=ambiguous_result) as create_order:
        first = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )
        second = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert first.status_code == 409
    assert second.status_code == 409
    assert first.data['reference'] == second.data['reference']
    create_order.assert_called_once()
    assert PaymentTransaction.objects.filter(
        provider='vpay',
        status='processing',
        source_id=first.data['reference'],
    ).count() == 1


def test_friendly_error_does_not_expose_gateway_details():
    message = 'Invalid client credentials provided by VPay.'
    assert 'temporariamente indisponível' in _friendly_error(message)
    assert 'Invalid client credentials' not in _friendly_error(message)
    assert 'Tente novamente' in _friendly_error('Unexpected provider response')


@pytest.mark.django_db
def test_initiate_records_gateway_error_and_returns_safe_message(digital_order, buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)
    failure = {
        'ok': False,
        'data': None,
        'message': 'Invalid client credentials provided by VPay.',
        'http_status': 401,
    }

    with mock.patch.object(VPayClient, 'create_order', return_value=failure):
        response = client.post(
            reverse('payments_initiate'),
            {'order_ids': [str(digital_order.id)]},
            format='json',
        )

    assert response.status_code == 502
    assert 'Invalid client credentials' not in response.data['error']
    assert response.data['detail'] == failure['message']
    assert PaymentTransaction.objects.filter(
        order=digital_order,
        provider='vpay',
        status='failed',
        error_message=failure['message'],
    ).exists()


@pytest.mark.django_db
@override_settings(VPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_vpay_webhook_confirms_payment_and_settles_once(digital_order):
    digital_order.payment_id = 'vpay_order_123'
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    event = _confirmed_event('vpay_order_123')
    raw_body = json.dumps(event, separators=(',', ':'))

    first = client.post(
        reverse('vpay_webhook'),
        data=raw_body,
        content_type='application/json',
        HTTP_X_VOIDPAY_SIGNATURE=_sign(raw_body.encode()),
        HTTP_X_VOIDPAY_DELIVERY='delivery_123',
    )
    second = client.post(
        reverse('vpay_webhook'),
        data=raw_body,
        content_type='application/json',
        HTTP_X_VOIDPAY_SIGNATURE=_sign(raw_body.encode()),
        HTTP_X_VOIDPAY_DELIVERY='delivery_123',
    )

    assert first.status_code == second.status_code == 200
    assert first.data['created'] is True
    assert second.data['created'] is False
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'
    assert get_wallet(digital_order.store.owner).payout_balance == Decimal('100.00')
    assert PaymentTransaction.objects.get(
        idempotency_key='vpay:vpay_order_123'
    ).status == 'completed'


@pytest.mark.django_db
@override_settings(VPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_vpay_webhook_requires_valid_signature(digital_order):
    digital_order.payment_id = 'vpay_order_123'
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    event = _confirmed_event('vpay_order_123')
    raw_body = json.dumps(event)

    response = client.post(
        reverse('vpay_webhook'),
        data=raw_body,
        content_type='application/json',
        HTTP_X_VOIDPAY_SIGNATURE='bad',
    )

    assert response.status_code == 401
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@pytest.mark.django_db
@override_settings(VPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_vpay_webhook_rejects_amount_mismatch(digital_order):
    digital_order.payment_id = 'vpay_order_123'
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    event = _confirmed_event('vpay_order_123', amount='99.00')
    raw_body = json.dumps(event)

    response = client.post(
        reverse('vpay_webhook'),
        data=raw_body,
        content_type='application/json',
        HTTP_X_VOIDPAY_SIGNATURE=_sign(raw_body.encode()),
    )

    assert response.status_code == 400
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@pytest.mark.django_db
@override_settings(VPAY_WEBHOOK_SECRET='')
def test_vpay_webhook_rejects_missing_secret(digital_order):
    digital_order.payment_id = 'vpay_order_123'
    digital_order.save(update_fields=['payment_id'])
    response = APIClient().post(
        reverse('vpay_webhook'),
        _confirmed_event('vpay_order_123'),
        format='json',
    )

    assert response.status_code == 401
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@pytest.mark.django_db
def test_status_polling_confirms_only_when_vpay_reports_paid(digital_order, buyer):
    digital_order.payment_id = 'vpay_order_123'
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    client.force_authenticate(user=buyer)
    status_result = {
        'ok': True,
        'data': {
            'orderId': 'vpay_order_123',
            'status': 'paid',
            'amount': 100,
            'currency': 'MZN',
            'transactionId': 'txn_from_poll',
        },
        'message': None,
        'http_status': 200,
    }

    with mock.patch.object(VPayClient, 'get_order_status', return_value=status_result):
        response = client.get(
            reverse('payments_status'),
            {'reference': 'vpay_order_123'},
        )

    assert response.status_code == 200
    assert response.data['status'] == 'completed'
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'completed'
    assert get_wallet(digital_order.store.owner).payout_balance == Decimal('100.00')


@pytest.mark.django_db
def test_server_reconciliation_confirms_open_payment(digital_order, store):
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_server_reconciled',
        amount=digital_order.total,
        currency='MZN',
        status='pending',
    )
    attempt.orders.add(digital_order)
    digital_order.payment_id = attempt.gateway_order_id
    digital_order.save(update_fields=['payment_id'])
    paid_result = {
        'ok': True,
        'data': {
            'orderId': attempt.gateway_order_id,
            'status': 'paid',
            'amount': '100.00',
            'currency': 'MZN',
            'transactionId': 'txn_server_reconciled',
        },
        'message': None,
        'http_status': 200,
    }

    with mock.patch.object(
            VPayClient, 'get_order_status', return_value=paid_result) as get_status:
        from apps.payments.tasks import reconcile_vpay_pending_payments
        result = reconcile_vpay_pending_payments()

    assert '1 tentativa' in result
    get_status.assert_called_once_with(attempt.gateway_order_id)
    digital_order.refresh_from_db()
    attempt.refresh_from_db()
    assert digital_order.payment_status == 'completed'
    assert attempt.status == 'completed'
    assert get_wallet(store.owner).payout_balance == Decimal('100.00')


@pytest.mark.django_db
def test_terminal_gateway_failure_cancels_order(digital_order, buyer):
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_order_failed',
        amount=digital_order.total,
        currency='MZN',
        status='pending',
    )
    attempt.orders.add(digital_order)
    digital_order.payment_id = attempt.gateway_order_id
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    client.force_authenticate(user=buyer)
    result = {
        'ok': True,
        'data': {'orderId': attempt.gateway_order_id, 'status': 'failed'},
        'message': None,
        'http_status': 200,
    }

    with mock.patch.object(VPayClient, 'get_order_status', return_value=result):
        response = client.get(
            reverse('payments_status'),
            {'reference': attempt.gateway_order_id},
        )

    assert response.status_code == 200
    assert response.data['status'] == 'failed'
    digital_order.refresh_from_db()
    attempt.refresh_from_db()
    assert digital_order.status == 'cancelled'
    assert digital_order.payment_status == 'failed'
    assert attempt.status == 'failed'


@pytest.mark.django_db
def test_late_payment_for_cancelled_order_is_flagged_for_refund(digital_order):
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_order_late',
        amount=digital_order.total,
        currency='MZN',
        status='pending',
    )
    attempt.orders.add(digital_order)
    digital_order.payment_id = attempt.gateway_order_id
    digital_order.status = 'cancelled'
    digital_order.save(update_fields=['payment_id', 'status'])

    from apps.payments.views import _confirm_payment
    _confirm_payment(attempt.gateway_order_id, _confirmed_event(attempt.gateway_order_id))

    digital_order.refresh_from_db()
    attempt.refresh_from_db()
    assert digital_order.payment_status == 'completed'
    assert digital_order.status == 'cancelled'
    assert attempt.status == 'refund_pending'
    assert get_wallet(digital_order.store.owner).payout_balance == Decimal('0.00')


@pytest.mark.django_db
def test_split_checkout_attempt_confirms_every_linked_order(digital_order, buyer, store):
    second_order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        platform_fee=Decimal('0.00'),
        affiliate_commission=Decimal('0.00'),
        payment_method='vpay',
        payment_status='pending',
        shipping_address={},
    )
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_split_checkout',
        amount=Decimal('200.00'),
        currency='MZN',
        status='pending',
    )
    attempt.orders.add(digital_order, second_order)
    for order in (digital_order, second_order):
        order.payment_id = attempt.gateway_order_id
        order.save(update_fields=['payment_id'])

    from apps.payments.views import _confirm_payment
    orders, created = _confirm_payment(
        attempt.gateway_order_id,
        _confirmed_event(attempt.gateway_order_id, amount='200.00'),
    )

    assert created is True
    assert len(orders) == 2
    assert all(order.payment_status == 'completed' for order in orders)
    assert get_wallet(store.owner).payout_balance == Decimal('200.00')


@pytest.mark.django_db
def test_polling_terminal_response_does_not_overwrite_webhook_success(digital_order, buyer):
    attempt = PaymentTransaction.objects.create(
        order=digital_order,
        provider='vpay',
        gateway_order_id='vpay_order_race',
        amount=digital_order.total,
        currency='MZN',
        status='pending',
    )
    attempt.orders.add(digital_order)
    digital_order.payment_id = attempt.gateway_order_id
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    client.force_authenticate(user=buyer)
    failure = {
        'ok': True,
        'data': {'orderId': attempt.gateway_order_id, 'status': 'failed'},
        'message': None,
        'http_status': 200,
    }

    def confirm_then_report_failed(_):
        from apps.payments.views import _confirm_payment
        _confirm_payment(
            attempt.gateway_order_id,
            _confirmed_event(attempt.gateway_order_id),
        )
        return failure

    with mock.patch.object(
            VPayClient, 'get_order_status', side_effect=confirm_then_report_failed):
        response = client.get(
            reverse('payments_status'),
            {'reference': attempt.gateway_order_id},
        )

    assert response.status_code == 200
    assert response.data['status'] == 'completed'
    digital_order.refresh_from_db()
    attempt.refresh_from_db()
    assert digital_order.payment_status == 'completed'
    assert digital_order.status == 'confirmed'
    assert attempt.status == 'completed'


@pytest.mark.django_db
def test_status_polling_rejects_amount_mismatch(digital_order, buyer):
    digital_order.payment_id = 'vpay_order_123'
    digital_order.save(update_fields=['payment_id'])
    client = APIClient()
    client.force_authenticate(user=buyer)
    status_result = {
        'ok': True,
        'data': {
            'orderId': 'vpay_order_123',
            'status': 'paid',
            'amount': 99,
        },
        'message': None,
        'http_status': 200,
    }

    with mock.patch.object(VPayClient, 'get_order_status', return_value=status_result):
        response = client.get(
            reverse('payments_status'),
            {'reference': 'vpay_order_123'},
        )

    assert response.status_code == 502
    digital_order.refresh_from_db()
    assert digital_order.payment_status == 'pending'


@override_settings(
    VPAY_BASE_URL='https://api.vpay.co.mz',
    VPAY_CLIENT_ID='client-test',
    VPAY_CLIENT_SECRET='secret-test',
    VPAY_TIMEOUT=10,
    VPAY_RETRY_TOTAL=0,
    VPAY_RETRY_BACKOFF=0,
)
def test_vpay_create_order_authenticates_and_uses_documented_endpoint():
    client = VPayClient()
    cache.delete(client.token_cache_key)
    auth_response = mock.Mock(
        ok=True,
        status_code=200,
        json=lambda: {'success': True, 'data': {'access_token': 'token-test'}},
    )
    create_response = mock.Mock(
        ok=True,
        status_code=201,
        json=lambda: {
            'success': True,
            'orderId': 'order-123',
            'checkout': 'https://checkout.vpay.co.mz/order-123',
            'data': {'orderId': 'order-123', 'status': 'pending'},
        },
    )
    with mock.patch.object(client.session, 'post', side_effect=[auth_response, create_response]) as post:
        result = client.create_order({'source': {'source': 'api'}, 'items': []})

    assert result['ok'] is True
    assert result['data']['orderId'] == 'order-123'
    assert result['data']['checkout'] == 'https://checkout.vpay.co.mz/order-123'
    assert post.call_args_list[0].args[0] == 'https://api.vpay.co.mz/v1/auth/token'
    assert post.call_args_list[1].args[0] == 'https://api.vpay.co.mz/v1/orders'
    assert post.call_args_list[1].kwargs['headers']['Authorization'] == 'Bearer token-test'


def test_vpay_signature_uses_raw_body_and_sha256_prefix():
    client = VPayClient(
        base_url='https://api.vpay.co.mz',
        client_id='id',
        client_secret='secret',
        webhook_secret=WEBHOOK_SECRET,
    )
    raw_body = b'{"event":"payment.confirmed"}'

    assert client.verify_signature(raw_body, _sign(raw_body))
    assert not client.verify_signature(raw_body + b' ', _sign(raw_body))
    assert not client.verify_signature(raw_body, 'bad')
    assert not client.verify_signature(raw_body, 'sha256=not-hex')


def test_checkout_url_quotes_provider_order_id():
    with override_settings(VPAY_CHECKOUT_BASE_URL='https://checkout.vpay.co.mz/'):
        assert _checkout_url('order/123') == 'https://checkout.vpay.co.mz/order%2F123'


@pytest.mark.django_db
def test_payment_payload_always_disables_shipping_collection(digital_order):
    payload = _build_order_payload([digital_order], 'checkout-test')

    assert payload['shippingAddressDisabled'] is True
    assert payload['deliveryInfoDisabled'] is True
    assert payload['source']['sourceId'] == 'checkout-test'
    assert payload['items'][0]['price'] == float(digital_order.total)
    assert payload['items'][0]['originProductId'] == f'order-{digital_order.id}'


@pytest.mark.django_db
def test_payment_payload_disables_collection_but_sends_shipping_address(db, buyer, store):
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('150.00'),
        shipping_cost=Decimal('20.00'),
        total=Decimal('170.00'),
        platform_fee=Decimal('0.00'),
        affiliate_commission=Decimal('0.00'),
        payment_method='vpay',
        payment_status='pending',
        shipping_address={'address': 'Rua X', 'city': 'Maputo', 'notes': 'Ref'},
    )
    OrderItem.objects.create(
        order=order,
        product=None,
        product_name='Produto Físico',
        quantity=1,
        unit_price=Decimal('150.00'),
        total_price=Decimal('150.00'),
        product_type='physical',
    )

    payload = _build_order_payload([order], 'checkout-test')

    assert payload['shippingAddressDisabled'] is True
    assert payload['deliveryInfoDisabled'] is True
    assert payload['shippingAddress']['street'] == 'Rua X'
    assert payload['shippingAddress']['city'] == 'Maputo'
    assert payload['shippingAddress']['country'] == 'MZ'
    assert 'reference' not in payload['shippingAddress']
    assert payload['shippingCost'] == 20.0


@pytest.mark.django_db
def test_payment_payload_splits_goods_and_shipping(digital_order):
    digital_order.subtotal = Decimal('100.00')
    digital_order.discount = Decimal('20.00')
    digital_order.shipping_cost = Decimal('10.00')
    digital_order.total = Decimal('90.00')
    digital_order.save()

    payload = _build_order_payload([digital_order], 'checkout-test')

    # O valor líquido (subtotal - desconto) vai nos itens e o frete é enviado
    # separadamente, para o gateway não o mostrar como "grátis".
    assert sum(item['price'] * item['quantity'] for item in payload['items']) == 80.0
    assert payload['shippingCost'] == 10.0


@pytest.mark.django_db
def test_payment_payload_sends_item_images_and_breakdown(db, buyer, store):
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('300.00'),
        discount=Decimal('30.00'),
        shipping_cost=Decimal('50.00'),
        total=Decimal('320.00'),
        platform_fee=Decimal('0.00'),
        affiliate_commission=Decimal('0.00'),
        payment_method='vpay',
        payment_status='pending',
        shipping_address={},
    )
    OrderItem.objects.create(
        order=order,
        product=None,
        product_name='Produto A',
        product_image='https://cdn.example.com/a.png',
        quantity=2,
        unit_price=Decimal('150.00'),
        total_price=Decimal('300.00'),
        product_type='physical',
    )

    payload = _build_order_payload([order], 'checkout-test')

    assert payload['shippingCost'] == 50.0
    assert payload['items'][0]['imageUrl'] == 'https://cdn.example.com/a.png'
    assert payload['items'][0]['quantity'] == 2
    assert payload['items'][0]['originProductId'] == f'orderitem-{order.items.first().id}'
    # subtotal - desconto = 270, distribuído pelo único item da encomenda
    assert payload['items'][0]['price'] * payload['items'][0]['quantity'] == 270.0
