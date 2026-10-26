from datetime import datetime, time
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.products.models import Category, Product
from apps.products.views_admin import AdminProductListView
from apps.stores.models import Store
from apps.users.views_admin import AdminAllStoresView

User = get_user_model()


@pytest.mark.django_db
def test_admin_store_list_filters_search_status_and_creation_period():
    admin = User.objects.create_superuser(
        email='admin-store-report@example.com',
        username='admin-store-report',
        password='SenhaForte123!',
    )
    owner = User.objects.create_user(
        email='store-report-owner@example.com',
        username='store-report-owner',
        first_name='Loja',
        password='SenhaForte123!',
    )
    matching = Store.objects.create(
        owner=owner,
        name='Loja Relatório',
        description='Loja para teste',
        category='Livros',
        product_type='physical',
        phone='840000001',
        email='store-report@example.com',
        location='Maputo',
        status='active',
    )
    Store.objects.create(
        owner=User.objects.create_user(
            email='other-store-owner@example.com',
            username='other-store-owner',
            password='SenhaForte123!',
        ),
        name='Outra Loja',
        description='Fora do filtro',
        category='Livros',
        product_type='physical',
        phone='840000002',
        email='other-store@example.com',
        location='Maputo',
        status='pending',
    )
    today = timezone.localdate()
    Store.objects.filter(pk=matching.pk).update(
        created_at=timezone.make_aware(datetime.combine(today, time(hour=12)))
    )

    request = APIRequestFactory().get('/api/v1/admin/stores/all/', {
        'search': 'store-report-owner@example.com',
        'status': 'active',
        'date_from': today.isoformat(),
        'date_to': today.isoformat(),
    })
    force_authenticate(request, user=admin)
    response = AdminAllStoresView.as_view()(request)

    assert response.status_code == 200
    assert response.data['count'] == 1
    assert response.data['results'][0]['id'] == str(matching.id)


@pytest.mark.django_db
def test_admin_product_list_filters_search_status_type_and_creation_period():
    admin = User.objects.create_superuser(
        email='admin-product-report@example.com',
        username='admin-product-report',
        password='SenhaForte123!',
    )
    owner = User.objects.create_user(
        email='product-report-owner@example.com',
        username='product-report-owner',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=owner,
        name='Loja Produtos',
        description='Loja para teste',
        category='Livros',
        product_type='physical',
        phone='840000003',
        email='product-report-store@example.com',
        location='Maputo',
        status='active',
    )
    category = Category.objects.create(name='Livros', slug='livros-report')
    matching = Product.objects.create(
        store=store,
        category=category,
        product_type='digital',
        name='Produto Relatório',
        slug='produto-relatorio-admin',
        description='Produto para teste',
        price=Decimal('125.00'),
        stock=3,
        status='active',
    )
    Product.objects.create(
        store=store,
        category=category,
        product_type='physical',
        name='Outro Produto',
        slug='outro-produto-relatorio-admin',
        description='Fora do filtro',
        price=Decimal('50.00'),
        stock=1,
        status='draft',
    )
    today = timezone.localdate()
    Product.objects.filter(pk=matching.pk).update(
        created_at=timezone.make_aware(datetime.combine(today, time(hour=12)))
    )

    request = APIRequestFactory().get('/api/v1/admin/products/', {
        'search': 'Produto Relatório',
        'status': 'active',
        'product_type': 'digital',
        'date_from': today.isoformat(),
        'date_to': today.isoformat(),
    })
    force_authenticate(request, user=admin)
    response = AdminProductListView.as_view()(request)

    assert response.status_code == 200
    assert response.data['count'] == 1
    assert response.data['results'][0]['id'] == str(matching.id)
    assert response.data['results'][0]['category_name'] == 'Livros'
