"""Testes da validação de zonas de envio.

Uma zona sem províncias nunca é encontrada pela estimativa do checkout, pelo
que o vendedor criava uma tarifa inalcançável sem qualquer aviso.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.shipping.models import ShippingZone
from apps.stores.models import Store

User = get_user_model()

ZONES_URL = '/api/v1/shipping/zones/'


@pytest.fixture
def seller(db):
    return User.objects.create_user(
        email='vendedor-envio@example.com', username='vendedor-envio', password='SenhaForte123!'
    )


@pytest.fixture
def store(db, seller):
    return Store.objects.create(
        owner=seller,
        name='Loja Envio Teste',
        description='Loja para testes de envio',
        category='geral',
        product_type='physical',
        phone='840000000',
        email='loja-envio@example.com',
        location='Nampula',
        status='active',
    )


@pytest.fixture
def api(seller):
    api_client = APIClient()
    api_client.force_authenticate(user=seller)
    return api_client


def test_zone_without_provinces_is_rejected(api):
    res = api.post(ZONES_URL, {'name': 'Nampula', 'provinces': [], 'is_active': True}, format='json')
    assert res.status_code == 400
    assert 'provinces' in res.json()
    assert ShippingZone.objects.count() == 0


def test_zone_with_unknown_province_is_rejected(api):
    res = api.post(
        ZONES_URL, {'name': 'Fictícia', 'provinces': ['atlantida'], 'is_active': True}, format='json'
    )
    assert res.status_code == 400
    assert 'provinces' in res.json()


def test_zone_with_provinces_is_created(api, store):
    res = api.post(
        ZONES_URL,
        {'name': 'Zona Norte', 'provinces': ['nampula', 'cabo_delgado'], 'is_active': True},
        format='json',
    )
    assert res.status_code == 201
    zone = ShippingZone.objects.get()
    assert zone.provinces == ['nampula', 'cabo_delgado']
    assert zone.store_id == store.id


def test_partial_update_keeps_provinces(api, store):
    zone = ShippingZone.objects.create(store=store, name='Zona', provinces=['nampula'], is_active=True)
    res = api.patch(f'{ZONES_URL}{zone.id}/', {'name': 'Zona Renomeada'}, format='json')
    assert res.status_code == 200
    zone.refresh_from_db()
    assert zone.name == 'Zona Renomeada'
    assert zone.provinces == ['nampula']


def test_update_cannot_clear_provinces(api, store):
    zone = ShippingZone.objects.create(store=store, name='Zona', provinces=['nampula'], is_active=True)
    res = api.put(
        f'{ZONES_URL}{zone.id}/', {'name': 'Zona', 'provinces': [], 'is_active': True}, format='json'
    )
    assert res.status_code == 400
    zone.refresh_from_db()
    assert zone.provinces == ['nampula']
