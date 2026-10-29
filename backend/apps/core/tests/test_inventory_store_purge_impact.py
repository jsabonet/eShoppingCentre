import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.stores.models import Store


class InventoryStorePurgeImpactCommandTests(TestCase):
    def test_reports_transitive_shared_payment_order_impact_read_only(self):
        user_model = get_user_model()
        store_owner = user_model.objects.create_user(
            email='owner@example.com',
            username='owner',
            password='SecurePassword123!',
        )
        buyer = user_model.objects.create_user(
            email='buyer@example.com',
            username='buyer',
            password='SecurePassword123!',
        )
        selected_store = Store.objects.create(
            owner=store_owner,
            name='Loja selecionada',
            description='Loja usada no teste.',
            category='geral',
            phone='840000000',
            email='selected@example.com',
            location='Maputo',
            status='active',
        )
        external_store = Store.objects.create(
            owner=buyer,
            name='Outra loja',
            description='Loja externa.',
            category='geral',
            phone='840000001',
            email='external@example.com',
            location='Maputo',
            status='active',
        )
        selected_order = Order.objects.create(
            buyer=buyer,
            store=selected_store,
            order_number='PED-SELECT001',
            subtotal='120.00',
            total='120.00',
            payment_method='test',
            payment_status='completed',
            shipping_address={},
        )
        external_order = Order.objects.create(
            buyer=store_owner,
            store=external_store,
            order_number='PED-EXTERNAL1',
            subtotal='30.00',
            total='30.00',
            payment_method='mpesa',
            payment_status='completed',
            shipping_address={},
        )
        third_order = Order.objects.create(
            buyer=buyer,
            store=external_store,
            order_number='PED-EXTERNAL2',
            subtotal='40.00',
            total='40.00',
            payment_method='mpesa',
            payment_status='pending',
            shipping_address={},
        )
        first_transaction = PaymentTransaction.objects.create(
            order=selected_order,
            provider='vpay',
            amount='120.00',
            status='completed',
        )
        first_transaction.orders.add(external_order)
        second_transaction = PaymentTransaction.objects.create(
            order=external_order,
            provider='vpay',
            amount='30.00',
            status='pending',
        )
        second_transaction.orders.add(third_order)
        output = StringIO()

        call_command(
            'inventory_store_purge_impact',
            str(selected_store.id),
            stdout=output,
        )

        report = json.loads(output.getvalue())
        self.assertTrue(report['read_only'])
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['direct_store_order_count'], 1)
        self.assertEqual(report['connected_order_count'], 3)
        self.assertEqual(report['connected_external_order_count'], 2)
        self.assertEqual(report['connected_payment_transaction_count'], 2)
        self.assertEqual(report['affected_buyer_count'], 2)
        self.assertEqual(
            {row['id'] for row in report['affected_orders']},
            {str(selected_order.id), str(external_order.id), str(third_order.id)},
        )
        self.assertTrue(
            next(
                row for row in report['affected_orders']
                if row['id'] == str(external_order.id)
            )['buyer_is_selected_store_owner']
        )
        self.assertEqual(
            len(report['impact_sha256']),
            64,
        )
        self.assertTrue(Store.objects.filter(pk=selected_store.pk).exists())
        self.assertTrue(Order.objects.filter(pk=selected_order.pk).exists())
        self.assertTrue(Order.objects.filter(pk=external_order.pk).exists())
        self.assertTrue(Order.objects.filter(pk=third_order.pk).exists())

    def test_rejects_unknown_store_ids(self):
        with self.assertRaisesMessage(CommandError, 'Loja(s) não encontrada(s)'):
            call_command(
                'inventory_store_purge_impact',
                '7595e91f-964c-44af-8479-9b3d368f3b7f',
                stdout=StringIO(),
            )
