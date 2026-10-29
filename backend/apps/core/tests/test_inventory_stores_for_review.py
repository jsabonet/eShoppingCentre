import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.orders.models import Order
from apps.stores.models import Store


class InventoryStoresForReviewCommandTests(TestCase):
    def test_command_reports_store_and_owner_cross_store_orders_read_only(self):
        user_model = get_user_model()
        owner = user_model.objects.create_user(
            email='private-owner@example.com',
            username='private-owner',
            password='SecurePassword123!',
        )
        another_owner = user_model.objects.create_user(
            email='another-owner@example.com',
            username='another-owner',
            password='SecurePassword123!',
        )
        store = Store.objects.create(
            owner=owner,
            name='Loja para rever',
            description='Loja de teste do comando.',
            category='geral',
            phone='840000000',
            email='store@example.com',
            location='Maputo',
            status='active',
        )
        other_store = Store.objects.create(
            owner=another_owner,
            name='Outra loja',
            description='Segunda loja.',
            category='geral',
            phone='840000001',
            email='other-store@example.com',
            location='Maputo',
            status='active',
        )
        order_for_other_store = Order.objects.create(
            buyer=owner,
            store=other_store,
            order_number='PED-OTHER001',
            subtotal='20.00',
            total='20.00',
            payment_method='mpesa',
            payment_status='pending',
            shipping_address={},
        )
        output = StringIO()

        call_command('inventory_stores_for_review', stdout=output)

        report = json.loads(output.getvalue())
        self.assertTrue(report['read_only'])
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['store_count'], 2)
        store_row = next(row for row in report['stores'] if row['store_id'] == str(store.id))
        self.assertEqual(store_row['store_name'], 'Loja para rever')
        self.assertEqual(store_row['owner']['owner_orders_in_other_stores_as_buyer'], 1)
        self.assertTrue(Order.objects.filter(pk=order_for_other_store.pk).exists())
        self.assertNotIn(owner.email, output.getvalue())
