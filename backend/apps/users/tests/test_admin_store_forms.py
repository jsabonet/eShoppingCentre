import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.stores.models import Store
from apps.stores.views import StoreDetailView
from apps.users.views_admin import (
    AdminStoreCreateView,
    AdminStoreManageView,
    AdminStoreOwnerListView,
)
from apps.stores.views import MyStoreView

User = get_user_model()


def create_admin_and_user():
    admin = User.objects.create_user(
        email='store-form-admin@example.com',
        username='store-form-admin',
        password='SenhaForte123!',
        is_staff=True,
    )
    owner = User.objects.create_user(
        email='store-form-owner@example.com',
        username='store-form-owner',
        password='SenhaForte123!',
    )
    return admin, owner


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('product_type', 'commission', 'stock_threshold'),
    [('physical', 10, 5), ('digital', 15, 0), ('course', 20, 0)],
)
def test_admin_store_creation_accepts_store_form_fields_and_type_defaults(
    product_type, commission, stock_threshold,
):
    admin, owner = create_admin_and_user()
    request = APIRequestFactory().post(
        '/api/v1/admin/stores/create/',
        {
            'owner': str(owner.id),
            'name': f'Loja Admin {product_type}',
            'description': 'Descrição da loja',
            'about': 'Sobre a loja',
            'tagline': 'Slogan da loja',
            'category': 'eletronicos' if product_type == 'physical' else 'ebooks',
            'product_type': product_type,
            'status': 'pending',
            'location': 'Maputo',
            'phone': '840000000',
            'email': f'{product_type}@store.example.com',
            'shipping_policy': 'Política de envio',
            'return_policy': 'Política de devolução',
            'theme_color': '#2563eb',
        },
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreCreateView.as_view()(request)

    assert response.status_code == 201
    store = Store.objects.get(id=response.data['id'])
    owner.refresh_from_db()
    assert store.owner == owner
    assert store.product_type == product_type
    assert store.default_affiliate_commission == commission
    assert store.low_stock_threshold == stock_threshold
    assert store.about == 'Sobre a loja'
    assert store.shipping_policy == 'Política de envio'
    assert 'seller' in owner.roles


@pytest.mark.django_db
def test_admin_store_owner_picker_excludes_users_who_already_have_a_store():
    admin, owner = create_admin_and_user()
    Store.objects.create(
        owner=owner,
        name='Loja existente',
        description='Já associada',
        category='moda',
        phone='840000000',
        email='existing-store@example.com',
        location='Maputo',
    )
    available_owner = User.objects.create_user(
        email='available-owner@example.com',
        username='available-owner',
        password='SenhaForte123!',
    )
    request = APIRequestFactory().get('/api/v1/admin/stores/owners/')
    force_authenticate(request, user=admin)

    response = AdminStoreOwnerListView.as_view()(request)

    assert response.status_code == 200
    owner_ids = {str(item['id']) for item in response.data['results']}
    assert str(available_owner.id) in owner_ids
    assert str(owner.id) not in owner_ids


@pytest.mark.django_db
def test_admin_store_edit_accepts_the_same_profile_and_policy_fields():
    admin, owner = create_admin_and_user()
    store = Store.objects.create(
        owner=owner,
        name='Loja para editar',
        description='Descrição inicial',
        category='moda',
        phone='840000000',
        email='edit-store@example.com',
        location='Maputo',
    )
    request = APIRequestFactory().patch(
        f'/api/v1/admin/stores/{store.id}/manage/',
        {
            'tagline': 'Novo slogan',
            'about': 'Sobre actualizada',
            'category': 'eletronicos',
            'website': 'https://example.com',
            'shipping_policy': 'Novo envio',
            'return_policy': 'Nova devolução',
            'theme_color': '#16a34a',
        },
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreManageView.as_view()(request, pk=store.id)

    assert response.status_code == 200
    store.refresh_from_db()
    assert store.tagline == 'Novo slogan'
    assert store.about == 'Sobre actualizada'
    assert store.category == 'eletronicos'
    assert store.website == 'https://example.com'
    assert store.shipping_policy == 'Novo envio'
    assert store.return_policy == 'Nova devolução'
    assert store.theme_color == '#16a34a'


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('view', 'method', 'path', 'kwargs'),
    [
        (AdminStoreCreateView, 'post', '/api/v1/admin/stores/create/', {}),
        (AdminStoreOwnerListView, 'get', '/api/v1/admin/stores/owners/', {}),
        (AdminStoreManageView, 'get', '/api/v1/admin/stores/example/manage/', {'pk': '00000000-0000-0000-0000-000000000001'}),
    ],
)
def test_admin_store_endpoints_reject_anonymous_users(view, method, path, kwargs):
    request = getattr(APIRequestFactory(), method)(path)

    response = view.as_view()(request, **kwargs)

    assert response.status_code in (401, 403)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('view', 'method', 'path', 'kwargs'),
    [
        (AdminStoreCreateView, 'post', '/api/v1/admin/stores/create/', {}),
        (AdminStoreOwnerListView, 'get', '/api/v1/admin/stores/owners/', {}),
        (AdminStoreManageView, 'get', '/api/v1/admin/stores/example/manage/', {'pk': '00000000-0000-0000-0000-000000000001'}),
    ],
)
def test_admin_store_endpoints_reject_authenticated_non_staff_users(view, method, path, kwargs):
    user = User.objects.create_user(
        email='non-admin@example.com',
        username='non-admin',
        password='SenhaForte123!',
    )
    request = getattr(APIRequestFactory(), method)(path)
    force_authenticate(request, user=user)

    response = view.as_view()(request, **kwargs)

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_store_creation_rejects_assigned_owner_and_invalid_commission():
    admin, owner = create_admin_and_user()
    Store.objects.create(
        owner=owner,
        name='Loja já existente',
        description='Descrição',
        category='moda',
        phone='840000000',
        email='assigned@example.com',
        location='Maputo',
    )
    request = APIRequestFactory().post(
        '/api/v1/admin/stores/create/',
        {
            'owner': str(owner.id),
            'name': 'Loja nova',
            'description': 'Descrição',
            'category': 'moda',
            'product_type': 'physical',
            'phone': '840000000',
            'email': 'new-store@example.com',
            'location': 'Maputo',
        },
        format='json',
    )
    force_authenticate(request, user=admin)

    assigned_owner_response = AdminStoreCreateView.as_view()(request)

    assert assigned_owner_response.status_code == 400
    assert Store.objects.filter(name='Loja nova').count() == 0

    available_owner = User.objects.create_user(
        email='commission-owner@example.com',
        username='commission-owner',
        password='SenhaForte123!',
    )
    request = APIRequestFactory().post(
        '/api/v1/admin/stores/create/',
        {
            'owner': str(available_owner.id),
            'name': 'Loja comissão inválida',
            'description': 'Descrição',
            'category': 'moda',
            'product_type': 'physical',
            'default_affiliate_commission': '75.00',
            'phone': '840000000',
            'email': 'invalid-commission@example.com',
            'location': 'Maputo',
        },
        format='json',
    )
    force_authenticate(request, user=admin)

    commission_response = AdminStoreCreateView.as_view()(request)

    assert commission_response.status_code == 400
    assert Store.objects.filter(name='Loja comissão inválida').count() == 0


@pytest.mark.django_db
def test_admin_store_creation_rejects_duplicate_slug():
    admin, owner = create_admin_and_user()
    existing_owner = User.objects.create_user(
        email='slug-owner@example.com',
        username='slug-owner',
        password='SenhaForte123!',
    )
    Store.objects.create(
        owner=existing_owner,
        name='Loja com slug',
        slug='slug-em-uso',
        description='Descrição',
        category='moda',
        phone='840000000',
        email='slug-existing@example.com',
        location='Maputo',
    )
    request = APIRequestFactory().post(
        '/api/v1/admin/stores/create/',
        {
            'owner': str(owner.id),
            'name': 'Outra loja',
            'slug': 'slug-em-uso',
            'description': 'Descrição',
            'category': 'moda',
            'product_type': 'physical',
            'phone': '840000000',
            'email': 'slug-new@example.com',
            'location': 'Maputo',
        },
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreCreateView.as_view()(request)

    assert response.status_code == 400
    assert Store.objects.count() == 1


@pytest.mark.django_db
def test_admin_store_create_rejects_invalid_image_upload():
    from django.core.files.uploadedfile import SimpleUploadedFile

    admin, owner = create_admin_and_user()
    request = APIRequestFactory().post(
        '/api/v1/admin/stores/create/',
        {
            'owner': str(owner.id),
            'name': 'Loja imagem inválida',
            'description': 'Descrição',
            'category': 'moda',
            'product_type': 'physical',
            'phone': '840000000',
            'email': 'bad-image@example.com',
            'location': 'Maputo',
            'logo': SimpleUploadedFile('logo.png', b'not an image', content_type='image/png'),
        },
        format='multipart',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreCreateView.as_view()(request)

    assert response.status_code == 400
    assert Store.objects.filter(name='Loja imagem inválida').count() == 0


@pytest.mark.django_db
def test_admin_clear_documents_rejects_invalid_document_field_names():
    admin, owner = create_admin_and_user()
    store = Store.objects.create(
        owner=owner,
        name='Loja documentos',
        description='Descrição',
        category='moda',
        phone='840000000',
        email='documents@example.com',
        location='Maputo',
    )
    request = APIRequestFactory().patch(
        f'/api/v1/admin/stores/{store.id}/manage/',
        {'action': 'clear_documents', 'documents': ['owner', 'email']},
        format='json',
    )
    force_authenticate(request, user=admin)

    response = AdminStoreManageView.as_view()(request, pk=store.id)

    assert response.status_code == 400


@pytest.mark.django_db
def test_public_store_detail_does_not_expose_private_admin_or_owner_data():
    _, owner = create_admin_and_user()
    store = Store.objects.create(
        owner=owner,
        name='Loja pública',
        description='Descrição pública',
        category='moda',
        phone='840000000',
        email='public@example.com',
        location='Maputo',
        status='active',
        admin_notes='Nota confidencial',
        rejection_reason='Motivo interno',
    )
    request = APIRequestFactory().get(f'/api/v1/stores/{store.slug}/')

    response = StoreDetailView.as_view()(request, slug=store.slug)

    assert response.status_code == 200
    assert response.data['name'] == store.name
    assert 'admin_notes' not in response.data
    assert 'rejection_reason' not in response.data
    assert 'owner_email' not in response.data
    assert 'identity_document' not in response.data


@pytest.mark.django_db
def test_store_owner_cannot_edit_admin_notes_or_status():
    _, owner = create_admin_and_user()
    store = Store.objects.create(
        owner=owner,
        name='Loja do vendedor',
        description='Descrição',
        category='moda',
        phone='840000000',
        email='seller-store@example.com',
        location='Maputo',
        status='pending',
        admin_notes='Nota interna',
    )
    request = APIRequestFactory().patch(
        '/api/v1/stores/me/',
        {'admin_notes': 'alterada', 'status': 'active'},
        format='json',
    )
    force_authenticate(request, user=owner)

    response = MyStoreView.as_view()(request)

    assert response.status_code == 200
    store.refresh_from_db()
    assert store.admin_notes == 'Nota interna'
    assert store.status == 'pending'
