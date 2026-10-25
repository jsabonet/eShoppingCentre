from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission, AffiliateProfile
from apps.affiliates.tasks import auto_approve_affiliate_commissions
from apps.orders.models import Order
from apps.stores.models import Store
from apps.wallet.models import WalletTransaction
from apps.wallet.services import get_wallet

User = get_user_model()


@pytest.mark.django_db
def test_auto_approved_affiliate_commission_is_credited_to_payout_wallet():
    seller = User.objects.create_user(
        email='commission-seller@example.com',
        username='commission-seller',
        password='SenhaForte123!',
    )
    affiliate_user = User.objects.create_user(
        email='commission-affiliate@example.com',
        username='commission-affiliate',
        password='SenhaForte123!',
    )
    buyer = User.objects.create_user(
        email='commission-buyer@example.com',
        username='commission-buyer',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Comissão',
        description='Loja para teste de comissão',
        category='geral',
        product_type='physical',
        phone='840000002',
        email='commission@example.com',
        location='Maputo',
        status='active',
    )
    delivered_at = timezone.now() - timedelta(days=8)
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        payment_method='mpesa',
        payment_status='completed',
        status='delivered',
        confirmed_at=delivered_at,
        delivered_at=delivered_at,
        shipping_address={},
    )
    affiliate = AffiliateProfile.objects.create(
        user=affiliate_user,
        referral_code='AUTO-COMMISSION',
    )
    commission = AffiliateCommission.objects.create(
        affiliate=affiliate,
        order=order,
        amount=Decimal('12.50'),
        commission_rate=Decimal('12.50'),
        status='pending',
    )

    result = auto_approve_affiliate_commissions()

    commission.refresh_from_db()
    affiliate.refresh_from_db()
    wallet = get_wallet(affiliate_user)
    wallet.refresh_from_db()

    assert '1 comissão' in result
    assert commission.status == 'approved'
    assert affiliate.total_commission == Decimal('12.50')
    assert wallet.payout_balance == Decimal('12.50')
    assert WalletTransaction.objects.filter(
        idempotency_key=f'affiliate_commission:{commission.id}:credit',
    ).count() == 1
