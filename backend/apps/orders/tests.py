"""Testes da reserva de stock e cancelamento automático de encomendas não pagas."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.notifications.models import Notification
from apps.orders.models import Order, OrderItem
from apps.orders.services import cancel_order
from apps.orders.tasks import auto_release_unpaid_orders
from apps.payments.services.completion import complete_payment
from apps.products.models import Category, Product
from apps.stores.models import Store
from apps.wallet.services import get_wallet

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
