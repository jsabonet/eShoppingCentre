import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.affiliates.models import AffiliateKYC, AffiliatePayout, AffiliateProfile
from apps.affiliates.views import AffiliatePayoutView, AdminAffiliatePayoutActionView
from apps.wallet.models import WalletTransaction
from apps.wallet.services import credit, get_wallet

User = get_user_model()


@pytest.fixture
def affiliate_user(db):
    user = User.objects.create_user(
        email='payout-affiliate@example.com',
        username='payout-affiliate',
        password='SenhaForte123!',
        is_verified=True,
        roles=['affiliate'],
    )
    profile = AffiliateProfile.objects.create(user=user, referral_code='PAYOUT-TEST')
    AffiliateKYC.objects.create(
        affiliate=profile,
        document_number='DOC-123',
        payout_phone='840000001',
        status='approved',
    )
    wallet = get_wallet(user)
    credit(
        wallet,
        Decimal('1500.00'),
        kind='payout',
        ref_type='system',
        ref_id=uuid.uuid4(),
        description='Comissões aprovadas',
        txn_type='affiliate_commission',
    )
    return user, profile, wallet


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(
        email='payout-admin@example.com',
        username='payout-admin',
        password='Admin123!',
    )


@pytest.mark.django_db
def test_affiliate_payout_deducts_five_percent_and_reserves_gross(affiliate_user):
    user, _, wallet = affiliate_user
    request = APIRequestFactory().post(
        '/api/v1/affiliates/me/payouts/',
        {'amount': '1000.00', 'method': 'mpesa', 'account_details': {'phone': '849999999'}},
        format='json',
    )
    force_authenticate(request, user=user)

    response = AffiliatePayoutView.as_view()(request)

    wallet.refresh_from_db()
    payout = AffiliatePayout.objects.get()
    assert response.status_code == 201
    assert payout.amount == Decimal('1000.00')
    assert payout.fee == Decimal('50.00')
    assert payout.net_amount == Decimal('950.00')
    assert payout.account_details == {'phone': '840000001'}
    assert wallet.payout_balance == Decimal('1500.00')
    assert wallet.reserved_balance == Decimal('1000.00')


@pytest.mark.django_db
def test_affiliate_payout_requires_approval_then_manual_payment(affiliate_user, admin):
    user, profile, wallet = affiliate_user
    payout = AffiliatePayout.objects.create(
        affiliate=profile,
        amount=Decimal('1000.00'),
        fee=Decimal('50.00'),
        method='mpesa',
        account_details={'phone': '840000001'},
    )
    wallet.reserved_balance = payout.amount
    wallet.save(update_fields=['reserved_balance'])
    factory = APIRequestFactory()

    approve_request = factory.patch(
        f'/api/v1/affiliates/admin/affiliates/payouts/{payout.id}/',
        {'action': 'approve'},
        format='json',
    )
    force_authenticate(approve_request, user=admin)
    approve_response = AdminAffiliatePayoutActionView.as_view()(approve_request, pk=payout.id)

    wallet.refresh_from_db()
    payout.refresh_from_db()
    assert approve_response.status_code == 200
    assert payout.status == 'approved'
    assert wallet.payout_balance == Decimal('1500.00')
    assert wallet.reserved_balance == Decimal('1000.00')

    pay_request = factory.patch(
        f'/api/v1/affiliates/admin/affiliates/payouts/{payout.id}/',
        {'action': 'pay', 'reference': 'BANK-TRANSFER-01'},
        format='json',
    )
    force_authenticate(pay_request, user=admin)
    pay_response = AdminAffiliatePayoutActionView.as_view()(pay_request, pk=payout.id)

    wallet.refresh_from_db()
    profile.refresh_from_db()
    payout.refresh_from_db()
    assert pay_response.status_code == 200
    assert payout.status == 'paid'
    assert payout.admin_reference == 'BANK-TRANSFER-01'
    assert payout.paid_by == admin
    assert wallet.payout_balance == Decimal('500.00')
    assert wallet.reserved_balance == Decimal('0.00')
    assert wallet.total_withdrawn == Decimal('1000.00')
    assert profile.total_withdrawn == Decimal('1000.00')
    assert WalletTransaction.objects.get(
        idempotency_key=f'affiliate_payout:{payout.id}:transfer',
    ).amount == Decimal('-950.00')
    assert WalletTransaction.objects.get(
        idempotency_key=f'affiliate_payout:{payout.id}:fee',
    ).amount == Decimal('-50.00')


@pytest.mark.django_db
def test_rejecting_affiliate_payout_releases_reserved_balance(affiliate_user, admin):
    user, profile, wallet = affiliate_user
    payout = AffiliatePayout.objects.create(
        affiliate=profile,
        amount=Decimal('1000.00'),
        fee=Decimal('50.00'),
    )
    wallet.reserved_balance = payout.amount
    wallet.save(update_fields=['reserved_balance'])
    request = APIRequestFactory().patch(
        f'/api/v1/affiliates/admin/affiliates/payouts/{payout.id}/',
        {'action': 'reject', 'notes': 'Conta inválida'},
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminAffiliatePayoutActionView.as_view()(request, pk=payout.id)

    wallet.refresh_from_db()
    payout.refresh_from_db()
    assert response.status_code == 200
    assert payout.status == 'rejected'
    assert wallet.reserved_balance == Decimal('0.00')
    assert wallet.payout_balance == Decimal('1500.00')
