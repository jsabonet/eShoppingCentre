import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory

from apps.products.models import Category, Product
from apps.products.views import CategoryListView
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
