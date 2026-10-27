"""Testes do circuito da carteira — movimentos, idempotência e saques manuais."""
import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.affiliates.models import AffiliateCommission, AffiliatePayout, AffiliateProfile
from apps.orders.models import Order
from apps.stores.models import Store
from apps.wallet.models import EscrowHolding, PayoutRequest, WalletTransaction, WalletEntry
from apps.wallet.services import (
    credit,
    debit,
    get_wallet,
    request_payout,
    approve_payout,
    pay_payout,
    reject_payout,
    process_refund,
    get_refundable_amount,
    InsufficientFunds,
)
from apps.wallet.views import AdminPayoutListView, AdminReconciliationView, WalletPayoutView

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='comprador@example.com',
        username='comprador',
        password='SenhaForte123!',
    )


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(
        email='admin@example.com',
        username='admin',
        password='Admin123!',
    )


@pytest.fixture
def ref_id():
    return uuid.uuid4()


@pytest.mark.django_db
def test_admin_payout_list_filters_by_status_method_and_search(admin, user):
    matching = PayoutRequest.objects.create(
        user=user,
        role='seller',
        amount=Decimal('300.00'),
        method='mpesa',
        status='paid',
        admin_reference='PAY-REPORT-123',
    )
    PayoutRequest.objects.create(
        user=user,
        role='affiliate',
        amount=Decimal('200.00'),
        method='emola',
        status='pending',
    )
    request = APIRequestFactory().get(
        '/api/v1/wallet/admin/payouts/',
        {'status': 'paid', 'method': 'mpesa', 'search': 'PAY-REPORT-123'},
    )
    force_authenticate(request, user=admin)

    response = AdminPayoutListView.as_view()(request)

    assert response.status_code == 200
    assert response.data['count'] == 1
    assert response.data['results'][0]['id'] == str(matching.id)


@pytest.mark.django_db
def test_credit_debit_round_trip(user, ref_id):
    wallet = get_wallet(user)

    credit(wallet, 500, kind='buyer', ref_type='system', ref_id=ref_id,
           description='Depósito inicial', txn_type='sale')
    wallet.refresh_from_db()
    assert wallet.balance == 500

    debit(wallet, 200, kind='buyer', ref_type='system', ref_id=ref_id,
          description='Compra', txn_type='withdrawal')
    wallet.refresh_from_db()
    assert wallet.balance == 300

    assert WalletTransaction.objects.count() == 2
    assert WalletEntry.objects.count() == 2


@pytest.mark.django_db
def test_unverified_user_can_list_payouts_but_cannot_request_one(user):
    factory = APIRequestFactory()
    view = WalletPayoutView.as_view()

    get_request = factory.get('/api/v1/wallet/me/payouts/')
    force_authenticate(get_request, user=user)
    get_response = view(get_request)

    assert get_response.status_code == 200
    assert get_response.data == []

    post_request = factory.post('/api/v1/wallet/me/payouts/', {}, format='json')
    force_authenticate(post_request, user=user)
    post_response = view(post_request)

    assert post_response.status_code == 403


@pytest.mark.django_db
def test_credit_idempotency(user, ref_id):
    wallet = get_wallet(user)
    key = f'test:{ref_id}:credit'

    txn1 = credit(wallet, 100, kind='buyer', ref_type='system', ref_id=ref_id,
                  description='Depósito', txn_type='sale', idempotency_key=key)
    txn2 = credit(wallet, 100, kind='buyer', ref_type='system', ref_id=ref_id,
                  description='Depósito', txn_type='sale', idempotency_key=key)

    wallet.refresh_from_db()
    assert txn1.pk == txn2.pk
    assert wallet.balance == 100
    assert WalletTransaction.objects.filter(idempotency_key=key).count() == 1
    assert WalletEntry.objects.filter(transaction=txn1).count() == 1


@pytest.mark.django_db
def test_debit_idempotency(user, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 100, kind='buyer', ref_type='system', ref_id=ref_id,
           description='Depósito', txn_type='sale')
    key = f'test:{ref_id}:debit'

    txn1 = debit(wallet, 40, kind='buyer', ref_type='system', ref_id=ref_id,
                 description='Débito', txn_type='withdrawal', idempotency_key=key)
    txn2 = debit(wallet, 40, kind='buyer', ref_type='system', ref_id=ref_id,
                 description='Débito', txn_type='withdrawal', idempotency_key=key)

    wallet.refresh_from_db()
    assert txn1.pk == txn2.pk
    assert wallet.balance == 60
    assert WalletTransaction.objects.filter(idempotency_key=key).count() == 1


@pytest.mark.django_db
def test_debit_insufficient_funds(user, ref_id):
    wallet = get_wallet(user)
    with pytest.raises(InsufficientFunds):
        debit(wallet, 50, kind='buyer', ref_type='system', ref_id=ref_id,
              description='Débito sem saldo', txn_type='withdrawal')
    wallet.refresh_from_db()
    assert wallet.balance == 0
    assert WalletTransaction.objects.count() == 0


@pytest.mark.django_db
def test_entry_records_counterparty(user, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 10, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda digital', txn_type='sale', counterparty='external')
    entry = WalletEntry.objects.get()
    assert entry.counterparty == 'external'
    assert entry.direction == 'credit'
    assert entry.kind == 'payout'


@pytest.mark.django_db
def test_request_payout_reserves_balance(user, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 1000, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda', txn_type='sale')

    payout = request_payout(user, role='seller', amount=300, method='mpesa',
                            account_details={'phone': '840000000'})

    wallet.refresh_from_db()
    assert payout.status == 'pending'
    assert wallet.payout_balance == 1000
    assert wallet.reserved_balance == 300
    assert payout.fee_percent == Decimal('11.00')
    assert payout.fee == Decimal('33.00')
    assert payout.net_amount == Decimal('267.00')


@pytest.mark.django_db
def test_request_payout_rejects_over_available(user, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 100, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda', txn_type='sale')

    with pytest.raises(InsufficientFunds):
        request_payout(user, role='seller', amount=200, method='mpesa',
                       account_details={'phone': '840000000'})


@pytest.mark.django_db
def test_pay_payout_requires_approval(user, admin, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 1000, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda', txn_type='sale')
    payout = request_payout(user, role='seller', amount=300, method='mpesa',
                            account_details={'phone': '840000000'})

    with pytest.raises(ValueError):
        pay_payout(payout, admin)


@pytest.mark.django_db
def test_pay_payout_full_flow(user, admin, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 1000, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda', txn_type='sale')
    payout = request_payout(user, role='seller', amount=300, method='mpesa',
                            account_details={'phone': '840000000'})

    payout = approve_payout(payout, admin)
    assert payout.status == 'approved'

    payout = pay_payout(payout, admin, reference='TX-123')

    wallet.refresh_from_db()
    payout.refresh_from_db()
    assert payout.status == 'paid'
    assert payout.admin_reference == 'TX-123'
    assert wallet.payout_balance == 700
    assert wallet.reserved_balance == 0
    assert wallet.total_withdrawn == 300

    txn = WalletTransaction.objects.get(idempotency_key=f'payout:{payout.id}:pay')
    assert txn.amount == -267
    assert txn.type == 'withdrawal'
    entry = txn.entries.get()
    assert entry.counterparty == 'external'
    assert entry.direction == 'debit'
    fee_txn = WalletTransaction.objects.get(idempotency_key=f'payout:{payout.id}:fee')
    assert fee_txn.amount == -33
    assert fee_txn.type == 'fee'
    assert fee_txn.entries.get().counterparty == 'platform'


@pytest.mark.django_db
def test_pay_payout_requires_manual_transfer_reference(user, admin, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 1000, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda', txn_type='sale')
    payout = request_payout(user, role='seller', amount=300, method='mpesa',
                            account_details={'phone': '840000000'})
    approve_payout(payout, admin)

    with pytest.raises(ValueError, match='referência'):
        pay_payout(payout, admin)

    wallet.refresh_from_db()
    assert wallet.payout_balance == 1000
    assert wallet.reserved_balance == 300


@pytest.mark.django_db
def test_reject_payout_releases_reservation(user, admin, ref_id):
    wallet = get_wallet(user)
    credit(wallet, 1000, kind='payout', ref_type='order', ref_id=ref_id,
           description='Venda', txn_type='sale')
    payout = request_payout(user, role='seller', amount=300, method='mpesa',
                            account_details={'phone': '840000000'})

    reject_payout(payout, admin, reason='Dados inválidos')

    wallet.refresh_from_db()
    payout.refresh_from_db()
    assert payout.status == 'rejected'
    assert wallet.reserved_balance == 0
    assert wallet.payout_balance == 1000


@pytest.mark.django_db
def test_wallet_payout_requires_explicit_role_and_affiliate_kyc(db):
    from apps.affiliates.models import AffiliateProfile

    affiliate = User.objects.create_user(
        email='payout-affiliate@example.com',
        username='payout-affiliate',
        password='SenhaForte123!',
        is_verified=True,
        roles=['affiliate'],
    )
    AffiliateProfile.objects.create(user=affiliate, referral_code='PAYOUT-AFFILIATE')
    factory = APIRequestFactory()

    missing_role = factory.post('/api/v1/wallet/me/payouts/', {'amount': 300}, format='json')
    force_authenticate(missing_role, user=affiliate)
    missing_role_response = WalletPayoutView.as_view()(missing_role)
    assert missing_role_response.status_code == 400

    affiliate_role = factory.post(
        '/api/v1/wallet/me/payouts/',
        {'role': 'affiliate', 'amount': 300, 'account_details': {'phone': '840000000'}},
        format='json',
    )
    force_authenticate(affiliate_role, user=affiliate)
    affiliate_response = WalletPayoutView.as_view()(affiliate_role)
    assert affiliate_response.status_code == 400
    assert 'KYC' in affiliate_response.data['detail']


@pytest.mark.django_db
def test_wallet_affiliate_payout_uses_kyc_destination_and_five_percent(db):
    from apps.affiliates.models import AffiliateKYC, AffiliateProfile

    affiliate = User.objects.create_user(
        email='verified-payout-affiliate@example.com',
        username='verified-payout-affiliate',
        password='SenhaForte123!',
        is_verified=True,
        roles=['affiliate'],
    )
    profile = AffiliateProfile.objects.create(user=affiliate, referral_code='VERIFIED-PAYOUT')
    AffiliateKYC.objects.create(
        affiliate=profile,
        document_number='DOC-456',
        payout_phone='840000002',
        status='approved',
    )
    wallet = get_wallet(affiliate)
    credit(wallet, 1000, kind='payout', ref_type='system', ref_id=uuid.uuid4(),
           description='Comissões', txn_type='affiliate_commission')
    request = APIRequestFactory().post(
        '/api/v1/wallet/me/payouts/',
        {
            'role': 'affiliate',
            'amount': '500.00',
            'method': 'mpesa',
            'account_details': {'phone': '849999999'},
        },
        format='json',
    )
    force_authenticate(request, user=affiliate)

    response = WalletPayoutView.as_view()(request)

    assert response.status_code == 201
    assert response.data['fee_percent'] == '5.00'
    assert response.data['fee'] == '25.00'
    assert response.data['net_amount'] == Decimal('475.00')
    assert response.data['account_details'] == {'phone': '840000002'}


@pytest.mark.django_db
def test_wallet_affiliate_payout_allows_verified_seller_without_kyc(db):
    from apps.affiliates.models import AffiliateProfile
    from apps.stores.models import Store

    affiliate = User.objects.create_user(
        email='seller-payout-affiliate@example.com',
        username='seller-payout-affiliate',
        password='SenhaForte123!',
        is_verified=True,
        roles=['affiliate', 'seller'],
    )
    AffiliateProfile.objects.create(user=affiliate, referral_code='SELLER-PAYOUT')
    Store.objects.create(
        owner=affiliate,
        name='Loja aprovada wallet',
        description='Loja ativa para saque de afiliado',
        category='geral',
        phone='840000012',
        email=affiliate.email,
        location='Maputo',
        status='active',
    )
    wallet = get_wallet(affiliate)
    credit(wallet, 1000, kind='payout', ref_type='system', ref_id=uuid.uuid4(),
           description='Comissões', txn_type='affiliate_commission')
    request = APIRequestFactory().post(
        '/api/v1/wallet/me/payouts/',
        {
            'role': 'affiliate',
            'amount': '500.00',
            'method': 'mpesa',
            'account_details': {'phone': '849999997'},
        },
        format='json',
    )
    force_authenticate(request, user=affiliate)

    response = WalletPayoutView.as_view()(request)

    assert response.status_code == 201
    assert response.data['account_details'] == {'phone': '849999997'}


@pytest.mark.django_db
def test_admin_reconciliation_uses_paid_totals_and_does_not_double_count_reservations(
    user, admin, ref_id,
):
    seller = User.objects.create_user(
        email='seller-recon@example.com',
        username='seller-recon',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Recon',
        description='Loja para reconciliação',
        category='geral',
        product_type='physical',
        phone='840000001',
        email='recon@example.com',
        location='Maputo',
        status='active',
    )
    paid_order = Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        platform_fee=Decimal('8.00'),
        payment_method='mpesa',
        payment_status='completed',
        shipping_address={},
    )
    Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('500.00'),
        total=Decimal('500.00'),
        platform_fee=Decimal('40.00'),
        payment_method='mpesa',
        payment_status='pending',
        shipping_address={},
    )
    Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('30.00'),
        total=Decimal('30.00'),
        payment_method='wallet',
        payment_status='completed',
        shipping_address={},
    )
    Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('20.00'),
        total=Decimal('20.00'),
        payment_method='test',
        payment_status='completed',
        shipping_address={},
    )
    buyer_wallet = get_wallet(user)
    WalletTransaction.objects.create(
        wallet=buyer_wallet,
        type='refund',
        amount=Decimal('20.00'),
        balance_before=Decimal('0.00'),
        balance_after=Decimal('20.00'),
        reference_type='order',
        reference_id=paid_order.id,
        description='Reembolso de teste',
        status='completed',
    )
    credit(
        get_wallet(seller),
        1000,
        kind='payout',
        ref_type='order',
        ref_id=ref_id,
        description='Saldo do vendedor',
        txn_type='sale',
    )
    request_payout(
        seller,
        role='seller',
        amount=200,
        method='mpesa',
        account_details={'phone': '840000000'},
    )
    EscrowHolding.objects.create(order=paid_order, amount=Decimal('300.00'))

    affiliate = AffiliateProfile.objects.create(
        user=user,
        referral_code='RECON-AFFILIATE',
    )
    credited_commission = AffiliateCommission.objects.create(
        affiliate=affiliate,
        order=paid_order,
        amount=Decimal('5.00'),
        commission_rate=Decimal('5.00'),
        status='approved',
    )
    credit(
        buyer_wallet,
        5,
        kind='payout',
        ref_type='affiliate_commission',
        ref_id=credited_commission.id,
        description='Comissão já creditada',
        txn_type='affiliate_commission',
        idempotency_key=f'affiliate_commission:{credited_commission.id}:credit',
    )
    AffiliateCommission.objects.create(
        affiliate=affiliate,
        order=paid_order,
        amount=Decimal('7.00'),
        commission_rate=Decimal('7.00'),
        status='approved',
    )
    AffiliateCommission.objects.create(
        affiliate=affiliate,
        order=paid_order,
        amount=Decimal('9.00'),
        commission_rate=Decimal('9.00'),
        status='pending',
    )
    AffiliatePayout.objects.create(
        affiliate=affiliate,
        amount=Decimal('40.00'),
        method='mpesa',
        status='paid',
    )
    AffiliatePayout.objects.create(
        affiliate=affiliate,
        amount=Decimal('6.00'),
        method='mpesa',
        status='pending',
    )

    request = APIRequestFactory().get('/api/v1/wallet/admin/reconciliation/')
    force_authenticate(request, user=admin)
    response = AdminReconciliationView.as_view()(request)

    assert response.status_code == 200
    assert response.data['collected_total'] == 150.0
    assert response.data['gateway_collected_total'] == 100.0
    assert response.data['wallet_funded_total'] == 30.0
    assert response.data['simulated_test_total'] == 20.0
    assert response.data['refunds_total'] == 20.0
    assert response.data['net_collected'] == 130.0
    assert response.data['platform_fees'] == 8.0
    assert response.data['affiliate_commissions'] == 12.0
    assert response.data['affiliate_commissions_pending'] == 9.0
    assert response.data['affiliate_commissions_uncredited'] == 7.0
    assert response.data['payouts_paid'] == 40.0
    assert response.data['payouts_pending'] == 206.0
    assert response.data['wallets_payout_balance'] == 1005.0
    assert response.data['wallets_reserved_balance'] == 200.0
    assert response.data['wallets_buyer_balance'] == 0.0
    assert response.data['liabilities'] == 1312.0


@pytest.mark.django_db
def test_partial_refunds_are_idempotent_capped_and_do_not_fail_on_spent_affiliate_commission(
    user, ref_id,
):
    seller = User.objects.create_user(
        email='refund-seller@example.com',
        username='refund-seller',
        password='SenhaForte123!',
    )
    affiliate_user = User.objects.create_user(
        email='refund-affiliate@example.com',
        username='refund-affiliate',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Reembolso',
        description='Loja para reembolsos',
        category='geral',
        product_type='physical',
        phone='840000003',
        email='refund@example.com',
        location='Maputo',
        status='active',
    )
    order = Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        platform_fee=Decimal('8.00'),
        affiliate_commission=Decimal('10.00'),
        payment_method='mpesa',
        payment_status='completed',
        status='delivered',
        shipping_address={},
    )
    escrow = EscrowHolding.objects.create(
        order=order, amount=Decimal('82.00'), status='held',
    )
    affiliate = AffiliateProfile.objects.create(
        user=affiliate_user,
        referral_code='REFUND-AFFILIATE',
        total_commission=Decimal('10.00'),
        total_withdrawn=Decimal('10.00'),
    )
    commission = AffiliateCommission.objects.create(
        affiliate=affiliate,
        order=order,
        amount=Decimal('10.00'),
        commission_rate=Decimal('10.00'),
        status='approved',
    )

    first_refund_id = uuid.uuid4()
    process_refund(
        order, seller, user, Decimal('30.00'), 'Primeiro reembolso',
        refund_id=first_refund_id,
    )
    process_refund(
        order, seller, user, Decimal('30.00'), 'Repetição idempotente',
        refund_id=first_refund_id,
    )
    from apps.affiliates.services import reverse_commissions_for_refund
    reverse_commissions_for_refund(order, Decimal('30.00'), refund_id=first_refund_id)

    second_refund_id = uuid.uuid4()
    process_refund(
        order, seller, user, Decimal('30.00'), 'Segundo reembolso',
        refund_id=second_refund_id,
    )
    reverse_commissions_for_refund(order, Decimal('30.00'), refund_id=second_refund_id)

    escrow.refresh_from_db()
    commission.refresh_from_db()
    affiliate.refresh_from_db()
    assert get_refundable_amount(order) == Decimal('40.00')
    assert escrow.amount == Decimal('32.80')
    assert get_wallet(user).balance == Decimal('60.00')
    assert commission.reversed_amount == Decimal('6.00')
    assert commission.unrecovered_amount == Decimal('6.00')
    assert affiliate.total_commission == Decimal('4.00')

    followup_order = Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('40.00'),
        total=Decimal('40.00'),
        payment_method='mpesa',
        payment_status='completed',
        status='delivered',
        shipping_address={},
    )
    followup_commission = AffiliateCommission.objects.create(
        affiliate=affiliate,
        order=followup_order,
        amount=Decimal('4.00'),
        commission_rate=Decimal('10.00'),
        status='pending',
    )
    from apps.affiliates.services import approve_commission
    approve_commission(followup_commission)
    commission.refresh_from_db()
    wallet = get_wallet(affiliate_user)
    wallet.refresh_from_db()
    assert commission.unrecovered_amount == Decimal('2.00')
    assert wallet.payout_balance == Decimal('0.00')
    assert WalletTransaction.objects.filter(
        idempotency_key=f'affiliate_commission:{followup_commission.id}:credit',
        amount=Decimal('4.00'),
    ).exists()
    assert WalletTransaction.objects.filter(
        idempotency_key=f'affiliate_commission:{followup_commission.id}:debt-recovery',
        amount=Decimal('-4.00'),
    ).exists()

    with pytest.raises(ValueError, match='excede'):
        process_refund(
            order, seller, user, Decimal('41.00'), 'Excesso',
            refund_id=uuid.uuid4(),
        )


@pytest.mark.django_db
def test_refund_rejects_unpaid_order(user):
    seller = User.objects.create_user(
        email='unpaid-refund-seller@example.com',
        username='unpaid-refund-seller',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Não Paga',
        description='Loja para testar reembolso não pago',
        category='geral',
        product_type='physical',
        phone='840000004',
        email='unpaid-refund@example.com',
        location='Maputo',
        status='active',
    )
    order = Order.objects.create(
        buyer=user,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        payment_method='mpesa',
        payment_status='pending',
        shipping_address={},
    )

    with pytest.raises(ValueError, match='encomendas pagas'):
        process_refund(
            order, seller, user, Decimal('50.00'), 'Tentativa não paga',
            refund_id=uuid.uuid4(),
        )
