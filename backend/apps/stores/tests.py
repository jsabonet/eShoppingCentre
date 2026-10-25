from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.orders.models import Order, OrderItem
from apps.products.models import Category, Product
from apps.stores.models import Store
from apps.stores.views_earnings import StoreStatsView
from apps.wallet.models import WalletTransaction
from apps.wallet.services import get_wallet

User = get_user_model()


@pytest.mark.django_db
def test_store_stats_include_only_paid_sales_and_use_order_item_values():
    seller = User.objects.create_user(
        email='seller-stats@example.com',
        username='seller-stats',
        password='SenhaForte123!',
    )
    buyer = User.objects.create_user(
        email='buyer-stats@example.com',
        username='buyer-stats',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Stats',
        description='Loja para estatísticas',
        category='geral',
        product_type='physical',
        phone='840000000',
        email='stats@example.com',
        location='Maputo',
        status='active',
    )
    category = Category.objects.create(name='Stats', slug='stats')
    product = Product.objects.create(
        store=store,
        category=category,
        product_type='physical',
        name='Produto de teste',
        slug='produto-stats',
        description='Produto',
        price=Decimal('100.00'),
        stock=10,
        status='active',
    )
    paid_order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('40.00'),
        total=Decimal('40.00'),
        payment_method='mpesa',
        payment_status='completed',
        shipping_address={},
    )
    OrderItem.objects.create(
        order=paid_order,
        product=product,
        product_name=product.name,
        quantity=4,
        unit_price=Decimal('10.00'),
        total_price=Decimal('40.00'),
        product_type='physical',
    )
    unpaid_order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('50.00'),
        total=Decimal('50.00'),
        payment_method='mpesa',
        payment_status='pending',
        shipping_address={},
    )
    OrderItem.objects.create(
        order=unpaid_order,
        product=product,
        product_name=product.name,
        quantity=5,
        unit_price=Decimal('10.00'),
        total_price=Decimal('50.00'),
        product_type='physical',
    )
    buyer_wallet = get_wallet(buyer)
    WalletTransaction.objects.create(
        wallet=buyer_wallet,
        type='refund',
        amount=Decimal('10.00'),
        balance_before=Decimal('0.00'),
        balance_after=Decimal('10.00'),
        reference_type='order',
        reference_id=paid_order.id,
        description='Reembolso parcial de teste',
        status='completed',
    )

    request = APIRequestFactory().get('/api/v1/stores/me/stats/')
    force_authenticate(request, user=seller)
    response = StoreStatsView.as_view()(request)

    assert response.status_code == 200
    assert response.data['today_sales'] == 1
    assert response.data['today_revenue'] == 30.0
    assert response.data['total_revenue'] == 30.0
    assert response.data['total_orders'] == 2
    assert response.data['top_products'][0]['sales'] == 4
    assert response.data['top_products'][0]['revenue'] == 40.0
