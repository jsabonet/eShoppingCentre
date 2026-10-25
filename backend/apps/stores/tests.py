from datetime import timedelta
from decimal import Decimal
import csv
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.orders.models import Order, OrderItem
from apps.products.models import Category, Product
from apps.stores.models import Store, StoreReportExport
from apps.stores.views_earnings import StoreEarningsReportView, StoreStatsView
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
        status='confirmed',
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


@pytest.mark.django_db
def test_store_earnings_report_filters_dates_summarizes_and_audits():
    seller = User.objects.create_user(
        email='seller-report@example.com',
        username='seller-report',
        password='SenhaForte123!',
    )
    buyer = User.objects.create_user(
        email='buyer-report@example.com',
        username='buyer-report',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Relatório',
        description='Loja para relatórios',
        category='geral',
        product_type='physical',
        phone='840000000',
        email='report@example.com',
        location='Maputo',
        status='active',
    )
    category = Category.objects.create(name='Relatório', slug='relatorio')
    product = Product.objects.create(
        store=store,
        category=category,
        product_type='physical',
        name='Produto relatório',
        slug='produto-relatorio',
        description='Produto',
        price=Decimal('100.00'),
        stock=10,
        status='active',
    )
    order_date = timezone.now() - timedelta(days=2)
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        discount=Decimal('5.00'),
        shipping_cost=Decimal('5.00'),
        platform_fee=Decimal('10.00'),
        affiliate_commission=Decimal('5.00'),
        total=Decimal('100.00'),
        payment_method='vpay',
        payment_status='completed',
        status='confirmed',
        shipping_address={},
    )
    Order.objects.filter(pk=order.pk).update(created_at=order_date)
    OrderItem.objects.create(
        order=order,
        product=product,
        product_name='=HYPERLINK("https://example.com")',
        quantity=2,
        unit_price=Decimal('50.00'),
        total_price=Decimal('100.00'),
        product_type='physical',
    )
    out_of_period = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('30.00'),
        total=Decimal('30.00'),
        payment_method='vpay',
        payment_status='completed',
        status='confirmed',
        shipping_address={},
    )
    Order.objects.filter(pk=out_of_period.pk).update(
        created_at=order_date - timedelta(days=10),
    )
    Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('70.00'),
        total=Decimal('70.00'),
        payment_method='vpay',
        payment_status='pending',
        status='pending',
        shipping_address={},
    )
    cancelled_paid_order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('500.00'),
        total=Decimal('500.00'),
        payment_method='vpay',
        payment_status='completed',
        status='cancelled',
        shipping_address={},
    )
    Order.objects.filter(pk=cancelled_paid_order.pk).update(created_at=order_date)
    WalletTransaction.objects.create(
        wallet=get_wallet(buyer),
        type='refund',
        amount=Decimal('20.00'),
        balance_before=Decimal('0.00'),
        balance_after=Decimal('20.00'),
        reference_type='order',
        reference_id=order.id,
        description='Reembolso parcial',
        status='completed',
    )

    request = APIRequestFactory().get(
        '/api/v1/stores/me/earnings/report/',
        {'date_from': order_date.date().isoformat(),
         'date_to': order_date.date().isoformat()},
        HTTP_USER_AGENT='report-test',
    )
    force_authenticate(request, user=seller)
    response = StoreEarningsReportView.as_view()(request)

    assert response.status_code == 200
    assert response['Content-Type'].startswith('text/csv')
    assert response['Content-Disposition'].endswith(
        f'{order_date.date()}-{order_date.date()}.csv"'
    )
    assert response['X-Report-Audit-Id']
    assert response['Cache-Control'] == 'private, no-store'
    csv_rows = list(csv.reader(StringIO(response.content.decode('utf-8-sig'))))
    assert ['Vendas brutas', '100.00'] in csv_rows
    assert ['Reembolsos registados', '20.00'] in csv_rows
    assert ['Vendas líquidas após reembolsos', '80.00'] in csv_rows
    assert ['Receita bruta do vendedor antes de reembolsos', '85.00'] in csv_rows
    assert ['Parcela do vendedor revertida por reembolsos', '17.00'] in csv_rows
    assert ['Receita líquida estimada do vendedor', '68.00'] in csv_rows
    assert ["'=HYPERLINK(\"https://example.com\")"] in [
        row[5:6] for row in csv_rows if len(row) > 5
    ]
    audit = StoreReportExport.objects.get()
    assert audit.store == store
    assert audit.generated_by == seller
    assert audit.generated_by_email == seller.email
    assert audit.order_count == 1
    assert audit.item_count == 1
    assert audit.gross_sales == Decimal('100.00')
    assert audit.refunds == Decimal('20.00')
    assert audit.seller_net == Decimal('68.00')
    assert audit.criteria['date_basis'] == 'order.created_at'
    assert audit.ip_address == '127.0.0.1'
    assert audit.user_agent == 'report-test'


@pytest.mark.django_db
def test_store_earnings_report_rejects_invalid_periods():
    seller = User.objects.create_user(
        email='seller-invalid-report@example.com',
        username='seller-invalid-report',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja Relatório Inválido',
        description='Loja',
        category='geral',
        product_type='physical',
        phone='840000000',
        email='invalid-report@example.com',
        location='Maputo',
        status='active',
    )

    for params in (
        {'date_from': 'not-a-date', 'date_to': '2026-01-01'},
        {'date_from': '2026-02-01', 'date_to': '2026-01-01'},
        {'date_from': '2025-01-01', 'date_to': '2026-01-02'},
        {'date_from': '2026-01-01', 'date_to': '2026-01-31', 'status': 'pending'},
        {},
    ):
        request = APIRequestFactory().get(
            '/api/v1/stores/me/earnings/report/',
            params,
        )
        force_authenticate(request, user=seller)
        response = StoreEarningsReportView.as_view()(request)
        assert response.status_code == 400

    assert not StoreReportExport.objects.filter(store=store).exists()


@pytest.mark.django_db
def test_store_earnings_report_requires_store_owner():
    user = User.objects.create_user(
        email='buyer-no-store@example.com',
        username='buyer-no-store',
        password='SenhaForte123!',
    )
    request = APIRequestFactory().get(
        '/api/v1/stores/me/earnings/report/',
        {'date_from': '2026-01-01', 'date_to': '2026-01-31'},
    )
    force_authenticate(request, user=user)

    response = StoreEarningsReportView.as_view()(request)

    assert response.status_code == 403
    assert not StoreReportExport.objects.exists()
