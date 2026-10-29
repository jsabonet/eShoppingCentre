import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.courses.models import Course
from apps.products.models import Category, Product, StockLog
from apps.products.views import CategoryListView
from apps.products.views_admin import (
    AdminStoreProductDetailView,
    AdminStoreProductListCreateView,
)
from apps.stores.models import Store


@pytest.mark.django_db
def test_category_list_home_filter_keeps_image_or_active_product_categories():
    with_image = Category.objects.create(
        name='Categoria com imagem',
        slug='categoria-com-imagem',
        image='categories/imagem.jpg',
    )
    with_product = Category.objects.create(
        name='Categoria com produto',
        slug='categoria-com-produto',
    )
    Category.objects.create(
        name='Categoria vazia',
        slug='categoria-vazia',
    )

    seller = get_user_model().objects.create_user(
        email='seller-category-filter@example.com',
        username='seller-category-filter',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=seller,
        name='Loja filtro de categorias',
        description='Loja para teste do filtro de categorias',
        category='geral',
        phone='840000000',
        email='store-category-filter@example.com',
        location='Maputo',
        status='active',
    )
    Product.objects.create(
        store=store,
        category=with_product,
        name='Produto ativo',
        slug='produto-ativo-categoria',
        description='Produto para teste',
        price='100.00',
        stock=1,
        status='active',
    )

    request = APIRequestFactory().get(
        '/api/v1/categories/',
        {
            'root': 'true',
            'with_image_or_products': 'true',
            'sort': 'most_products',
            'page_size': '12',
        },
    )
    response = CategoryListView.as_view()(request)

    assert response.status_code == 200
    assert {item['slug'] for item in response.data['results']} == {
        with_image.slug,
        with_product.slug,
    }


def create_admin_store(product_type='physical'):
    user_model = get_user_model()
    admin = user_model.objects.create_user(
        email=f'admin-{product_type}@example.com',
        username=f'admin-{product_type}',
        password='SenhaForte123!',
        is_staff=True,
    )
    owner = user_model.objects.create_user(
        email=f'owner-{product_type}@example.com',
        username=f'owner-{product_type}',
        password='SenhaForte123!',
    )
    store = Store.objects.create(
        owner=owner,
        name=f'Loja {product_type}',
        description='Loja para testes admin',
        category='geral',
        product_type=product_type,
        phone='840000000',
        email=f'store-{product_type}@example.com',
        location='Maputo',
        status='active',
    )
    return admin, owner, store


@pytest.mark.django_db
@pytest.mark.parametrize('product_type', ['physical', 'digital', 'course'])
def test_admin_store_products_create_for_store_type(product_type):
    admin, _owner, store = create_admin_store(product_type)
    request = APIRequestFactory().post(
        f'/api/v1/admin/stores/{store.id}/products/',
        {
            'name': f'Produto {product_type}',
            'description': 'Produto criado pelo admin',
            'price': '125.00',
            'status': 'draft',
            'course_level': 'intermediate',
            'course_duration': '8 horas',
            'total_lessons': 4,
        },
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreProductListCreateView.as_view()(request, store_id=store.id)

    assert response.status_code == 201
    product = Product.objects.get(id=response.data['id'])
    assert product.store_id == store.id
    assert product.product_type == product_type
    if product_type == 'course':
        course = Course.objects.get(product=product)
        assert course.level == 'intermediate'
        assert course.duration == '8 horas'
        assert course.total_lessons == 4


@pytest.mark.django_db
def test_admin_store_product_crud_is_scoped_and_uses_soft_delete():
    admin, _owner, store = create_admin_store()
    _other_admin, _other_owner, other_store = create_admin_store('digital')
    product = Product.objects.create(
        store=store,
        name='Produto da loja',
        slug='produto-da-loja',
        description='Produto para CRUD',
        price='100.00',
        status='active',
    )
    request = APIRequestFactory().patch(
        f'/api/v1/admin/stores/{store.id}/products/{product.id}/',
        {'status': 'inactive', 'price': '90.00'},
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreProductDetailView.as_view()(request, store_id=store.id, pk=product.id)

    assert response.status_code == 200
    product.refresh_from_db()
    assert product.status == 'inactive'
    assert str(product.price) == '90.00'

    out_of_scope_request = APIRequestFactory().delete(
        f'/api/v1/admin/stores/{other_store.id}/products/{product.id}/'
    )
    force_authenticate(out_of_scope_request, user=admin)
    out_of_scope_response = AdminStoreProductDetailView.as_view()(
        out_of_scope_request, store_id=other_store.id, pk=product.id
    )

    assert out_of_scope_response.status_code == 404
    delete_request = APIRequestFactory().delete(
        f'/api/v1/admin/stores/{store.id}/products/{product.id}/'
    )
    force_authenticate(delete_request, user=admin)
    delete_response = AdminStoreProductDetailView.as_view()(
        delete_request, store_id=store.id, pk=product.id
    )

    assert delete_response.status_code == 204
    product.refresh_from_db()
    assert product.status == 'deleted'


@pytest.mark.django_db
def test_admin_store_product_stock_changes_are_logged():
    admin, _owner, store = create_admin_store()
    product = Product.objects.create(
        store=store,
        name='Produto com stock',
        slug='produto-com-stock-admin',
        description='Produto para auditoria de stock',
        price='100.00',
        stock=3,
    )
    request = APIRequestFactory().patch(
        f'/api/v1/admin/stores/{store.id}/products/{product.id}/',
        {'stock': 8},
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreProductDetailView.as_view()(request, store_id=store.id, pk=product.id)

    assert response.status_code == 200
    log = StockLog.objects.get(product=product, changed_by=admin)
    assert log.change_type == 'adjustment'
    assert log.quantity == 5
    assert log.stock_before == 3
    assert log.stock_after == 8
    assert log.changed_by == admin
