"""Testes da reserva de stock e cancelamento automático de encomendas não pagas."""
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.courses.models import Course, Enrollment
from apps.notifications.models import Notification
from apps.orders.models import Order, OrderItem
from apps.orders.views import AdminAllOrdersView
from apps.orders.serializers import CreateOrderSerializer, ReturnRequestSerializer
from apps.orders.services import cancel_order
from apps.orders.tasks import auto_release_unpaid_orders
from apps.payments.services.completion import complete_payment
from apps.products.models import Category, Coupon, Product
from apps.products.models_digital import DigitalDownload
from apps.stores.models import Store
from apps.wallet.services import get_wallet
from apps.wallet.services import process_refund
from apps.affiliates.models import AffiliateCommission, AffiliateLink, AffiliateProfile

User = get_user_model()


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
        product_type='physical',
        phone='840000000',
        email='loja@example.com',
        location='Maputo',
        status='active',
    )


@pytest.fixture
def category(db):
    return Category.objects.create(name='Categoria', slug='categoria')


@pytest.fixture
def physical_product(db, store, category):
    return Product.objects.create(
        store=store,
        category=category,
        product_type='physical',
        name='Produto Físico',
        slug='produto-fisico',
        description='Descrição',
        price=Decimal('50.00'),
        stock=8,  # já deduzido de um stock original de 10 (2 unidades reservadas)
        status='active',
    )


@pytest.mark.django_db
def test_admin_order_list_filters_by_search_payment_and_date(buyer, store):
    admin = User.objects.create_superuser(
        email='orders-admin@example.com',
        username='orders-admin',
        password='Admin123!',
    )
    matching = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        payment_method='mpesa',
        payment_status='completed',
        status='confirmed',
        shipping_address={},
    )
    Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('50.00'),
        total=Decimal('50.00'),
        payment_method='wallet',
        payment_status='pending',
        status='pending',
        shipping_address={},
    )
    request = APIRequestFactory().get(
        '/api/v1/orders/admin/',
        {
            'search': matching.order_number,
            'payment_status': 'completed',
            'payment_method': 'mpesa',
            'date_from': timezone.localdate().isoformat(),
            'date_to': timezone.localdate().isoformat(),
        },
    )
    force_authenticate(request, user=admin)

    response = AdminAllOrdersView.as_view()(request)

    assert response.status_code == 200
    assert response.data['count'] == 1
    assert response.data['results'][0]['id'] == str(matching.id)


@pytest.fixture
def pending_order(db, buyer, store, physical_product):
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        payment_method='mpesa',
        payment_status='pending',
        status='pending',
        reserved_until=timezone.now() - timedelta(minutes=1),
        shipping_address={},
    )
    OrderItem.objects.create(
        order=order,
        product=physical_product,
        product_name='Produto Físico',
        quantity=2,
        unit_price=Decimal('50.00'),
        total_price=Decimal('100.00'),
        product_type='physical',
    )
    return order


@pytest.mark.django_db
def test_auto_release_restores_stock_and_cancels(pending_order, physical_product):
    result = auto_release_unpaid_orders()

    pending_order.refresh_from_db()
    physical_product.refresh_from_db()

    assert 'libertada' in result
    assert pending_order.status == 'cancelled'
    assert physical_product.stock == 10  # 8 + 2 restaurados
    assert Notification.objects.filter(user=pending_order.buyer, title='Reserva expirada').exists()


@pytest.mark.django_db
def test_auto_release_ignores_active_reservation(pending_order, physical_product):
    pending_order.reserved_until = timezone.now() + timedelta(minutes=10)
    pending_order.save(update_fields=['reserved_until'])

    auto_release_unpaid_orders()

    pending_order.refresh_from_db()
    physical_product.refresh_from_db()
    assert pending_order.status == 'pending'
    assert physical_product.stock == 8


@pytest.mark.django_db
def test_cancel_order_is_idempotent(pending_order, physical_product):
    first = cancel_order(pending_order, notes='teste')
    physical_product.refresh_from_db()
    assert first is True
    assert physical_product.stock == 10

    second = cancel_order(pending_order, notes='teste')
    physical_product.refresh_from_db()
    assert second is False
    assert physical_product.stock == 10  # sem dupla reposição


@pytest.mark.django_db
def test_complete_payment_after_cancel_does_not_settle(pending_order, seller):
    cancel_order(pending_order, notes='reserva expirada')

    order, created = complete_payment(
        pending_order.id, provider='vpay', provider_transaction_id='txn_late'
    )

    order.refresh_from_db()
    assert created is True
    assert order.payment_status == 'completed'
    assert order.status == 'cancelled'
    # Nenhuma liquidação ao vendedor (o dinheiro fica para reembolso manual)
    assert get_wallet(seller).payout_balance == Decimal('0.00')


@pytest.mark.django_db
def test_cancel_paid_order_refunds_both_sides(pending_order, buyer, seller):
    pending_order.items.all().delete()
    complete_payment(
        pending_order.id,
        provider='vpay',
        provider_transaction_id='txn_paid_before_cancel',
    )

    assert get_wallet(seller).payout_balance == Decimal('100.00')
    assert cancel_order(pending_order, notes='cancelamento após pagamento')

    pending_order.refresh_from_db()
    assert pending_order.status == 'cancelled'
    assert pending_order.payment_status == 'completed'
    assert get_wallet(seller).payout_balance == Decimal('0.00')
    assert get_wallet(buyer).balance == Decimal('100.00')


@pytest.mark.django_db
def test_cancel_paid_order_refunds_only_balance_left_after_partial_refund(
        pending_order, buyer, seller):
    pending_order.items.all().delete()
    complete_payment(
        pending_order.id,
        provider='vpay',
        provider_transaction_id='txn_partial_before_cancel',
    )
    process_refund(
        pending_order,
        seller,
        buyer,
        Decimal('30.00'),
        'Reembolso parcial',
        refund_id='partial-return',
    )

    assert cancel_order(pending_order, notes='cancelamento após reembolso parcial')

    pending_order.refresh_from_db()
    assert pending_order.status == 'cancelled'
    assert get_wallet(seller).payout_balance == Decimal('0.00')
    assert get_wallet(buyer).balance == Decimal('100.00')
    assert get_wallet(buyer).transactions.filter(
        reference_type='order',
        reference_id=pending_order.id,
        type='refund',
    ).count() == 2


@pytest.mark.django_db
def test_full_paid_cancellation_expires_order_delivery(pending_order, buyer, seller,
                                                       physical_product):
    pending_order.items.all().delete()
    complete_payment(
        pending_order.id,
        provider='vpay',
        provider_transaction_id='txn_access_revocation',
    )
    download = DigitalDownload.objects.create(
        user=buyer,
        product=physical_product,
        order=pending_order,
    )
    course = Course.objects.create(
        product=physical_product,
        instructor=seller,
        duration='1 hora',
    )
    enrollment = Enrollment.objects.create(
        user=buyer,
        course=course,
        order=pending_order,
    )

    assert cancel_order(pending_order, notes='cancelamento com reembolso integral')

    download.refresh_from_db()
    enrollment.refresh_from_db()
    assert download.expires_at is not None
    assert download.expires_at <= timezone.now()
    assert enrollment.has_access is False


@pytest.mark.django_db
def test_checkout_rejects_physical_product_below_minimum(buyer, physical_product):
    physical_product.min_order_quantity = 3
    physical_product.save(update_fields=['min_order_quantity'])

    serializer = CreateOrderSerializer(
        data={
            'items': [{'product_id': str(physical_product.id), 'quantity': 2}],
            'payment_method': 'mpesa',
        },
        context={'request': SimpleNamespace(user=buyer)},
    )

    assert not serializer.is_valid()
    assert 'quantidade mínima de 3' in str(serializer.errors)


@pytest.mark.django_db
def test_checkout_accepts_physical_product_at_minimum(buyer, physical_product):
    physical_product.min_order_quantity = 3
    physical_product.save(update_fields=['min_order_quantity'])

    serializer = CreateOrderSerializer(
        data={
            'items': [{'product_id': str(physical_product.id), 'quantity': 3}],
            'payment_method': 'mpesa',
        },
        context={'request': SimpleNamespace(user=buyer)},
    )

    assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
def test_checkout_sums_duplicate_product_lines_for_minimum(buyer, physical_product):
    physical_product.min_order_quantity = 3
    physical_product.save(update_fields=['min_order_quantity'])

    serializer = CreateOrderSerializer(
        data={
            'items': [
                {'product_id': str(physical_product.id), 'quantity': 1},
                {'product_id': str(physical_product.id), 'quantity': 1},
            ],
            'payment_method': 'mpesa',
        },
        context={'request': SimpleNamespace(user=buyer)},
    )

    assert not serializer.is_valid()
    assert 'quantidade mínima de 3' in str(serializer.errors)


@pytest.mark.django_db
def test_return_request_rejects_order_owned_by_another_buyer(buyer, seller, store):
    another_buyer = User.objects.create_user(
        email='outro-comprador@example.com',
        username='outro-comprador',
        password='SenhaForte123!',
    )
    order = Order.objects.create(
        buyer=another_buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        payment_method='mpesa',
        payment_status='completed',
        status='delivered',
        shipping_address={},
    )
    serializer = ReturnRequestSerializer(
        data={'order': str(order.id), 'reason': 'Produto com defeito'},
        context={'request': SimpleNamespace(user=buyer)},
    )

    assert not serializer.is_valid()
    assert 'não pertence' in str(serializer.errors)


@pytest.mark.django_db
def test_return_request_rejects_unpaid_order(buyer, store):
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('100.00'),
        total=Decimal('100.00'),
        payment_method='mpesa',
        payment_status='pending',
        shipping_address={},
    )
    serializer = ReturnRequestSerializer(
        data={'order': str(order.id), 'reason': 'Produto com defeito'},
        context={'request': SimpleNamespace(user=buyer)},
    )

    assert not serializer.is_valid()
    assert 'encomendas pagas' in str(serializer.errors)


@pytest.mark.django_db
def test_split_checkout_calculates_affiliate_commission_per_store_after_coupon(
    buyer, seller, store, physical_product, category,
):
    second_seller = User.objects.create_user(
        email='segundo-vendedor@example.com',
        username='segundo-vendedor',
        password='SenhaForte123!',
    )
    second_store = Store.objects.create(
        owner=second_seller,
        name='Segunda Loja',
        description='Segunda loja para checkout',
        category='geral',
        product_type='physical',
        phone='840000005',
        email='segunda-loja@example.com',
        location='Maputo',
        status='active',
    )
    first_product = physical_product
    first_product.price = Decimal('100.00')
    first_product.affiliate_commission = Decimal('10.00')
    first_product.save(update_fields=['price', 'affiliate_commission'])
    second_product = Product.objects.create(
        store=second_store,
        category=category,
        product_type='physical',
        name='Produto Segunda Loja',
        slug='produto-segunda-loja',
        description='Produto de teste',
        price=Decimal('200.00'),
        stock=5,
        status='active',
        affiliate_commission=Decimal('20.00'),
    )
    affiliate_user = User.objects.create_user(
        email='afiliado-checkout@example.com',
        username='afiliado-checkout',
        password='SenhaForte123!',
    )
    affiliate = AffiliateProfile.objects.create(
        user=affiliate_user,
        referral_code='SPLIT-AFFILIATE',
    )
    link = AffiliateLink.objects.create(
        affiliate=affiliate,
        product=first_product,
        code='SPLIT-CHECKOUT',
    )
    coupon = Coupon.objects.create(
        code='GLOBAL10',
        discount_type='percentage',
        discount_value=Decimal('10.00'),
        starts_at=timezone.now() - timedelta(days=1),
        ends_at=timezone.now() + timedelta(days=1),
        max_per_user=1,
    )

    serializer = CreateOrderSerializer(
        data={
            'items': [
                {'product_id': str(first_product.id), 'quantity': 1},
                {'product_id': str(second_product.id), 'quantity': 1},
            ],
            'payment_method': 'mpesa',
            'affiliate_code': link.code,
            'coupon_code': coupon.code,
        },
        context={'request': SimpleNamespace(user=buyer, COOKIES={})},
    )
    assert serializer.is_valid(), serializer.errors
    orders = serializer.save()

    orders_by_store = {order.store_id: order for order in orders}
    assert orders_by_store[store.id].affiliate_commission == Decimal('9.00')
    assert orders_by_store[second_store.id].affiliate_commission == Decimal('36.00')
    assert set(
        AffiliateCommission.objects.filter(affiliate=affiliate).values_list('amount', flat=True)
    ) == {Decimal('9.00'), Decimal('36.00')}
    affiliate.refresh_from_db()
    link.refresh_from_db()
    assert affiliate.total_sales == 0
    assert link.conversions == 0


@pytest.mark.django_db
def test_affiliate_conversion_is_recorded_only_after_payment(buyer, seller, store, physical_product):
    affiliate_user = User.objects.create_user(
        email='affiliate-conversion@example.com',
        username='affiliate-conversion',
        password='SenhaForte123!',
    )
    affiliate = AffiliateProfile.objects.create(
        user=affiliate_user,
        referral_code='PAYMENT-CONVERSION',
    )
    link = AffiliateLink.objects.create(
        affiliate=affiliate,
        product=physical_product,
        code='PAID-CONVERSION',
    )
    order = Order.objects.create(
        buyer=buyer,
        store=store,
        subtotal=Decimal('50.00'),
        total=Decimal('50.00'),
        affiliate=affiliate_user,
        affiliate_commission=Decimal('5.00'),
        payment_method='mpesa',
        payment_status='pending',
        status='pending',
        shipping_address={},
    )
    commission = AffiliateCommission.objects.create(
        affiliate=affiliate,
        affiliate_link=link,
        order=order,
        product=physical_product,
        amount=Decimal('5.00'),
        commission_rate=Decimal('10.00'),
    )

    affiliate.refresh_from_db()
    link.refresh_from_db()
    assert affiliate.total_sales == 0
    assert link.conversions == 0
    assert commission.conversion_recorded is False

    complete_payment(order.id, provider='vpay', provider_transaction_id='conversion-txn')

    affiliate.refresh_from_db()
    link.refresh_from_db()
    commission.refresh_from_db()
    assert affiliate.total_sales == 1
    assert link.conversions == 1
    assert commission.conversion_recorded is True
