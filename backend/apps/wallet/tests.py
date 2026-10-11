"""Testes do circuito da carteira — movimentos, idempotência e saques manuais."""
import uuid

import pytest
from django.contrib.auth import get_user_model

from apps.wallet.models import WalletTransaction, WalletEntry
from apps.wallet.services import (
    credit,
    debit,
    get_wallet,
    request_payout,
    approve_payout,
    pay_payout,
    reject_payout,
    InsufficientFunds,
)

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

    approve_payout(payout, admin)
    assert payout.status == 'approved'

    pay_payout(payout, admin, reference='TX-123')

    wallet.refresh_from_db()
    payout.refresh_from_db()
    assert payout.status == 'paid'
    assert payout.admin_reference == 'TX-123'
    assert wallet.payout_balance == 700
    assert wallet.reserved_balance == 0
    assert wallet.total_withdrawn == 300

    txn = WalletTransaction.objects.get(idempotency_key=f'payout:{payout.id}:pay')
    assert txn.amount == -300
    assert txn.type == 'withdrawal'
    entry = txn.entries.get()
    assert entry.counterparty == 'external'
    assert entry.direction == 'debit'


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
