import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.orders.models import Order, OrderItem
from apps.payments.models import PaymentTransaction
from apps.products.models import Product
from apps.stores.models import Store


class PlanSelectedStoreCleanupCommandTests(TestCase):
    def test_command_reports_dependencies_and_preserves_owner_and_other_orders(self):
        user_model = get_user_model()
        owner = user_model.objects.create_user(
            email='private-owner@example.com',
            username='private-owner',
            password='SecurePassword123!',
        )
        other_owner = user_model.objects.create_user(
            email='another-owner@example.com',
            username='another-owner',
            password='SecurePassword123!',
        )
        store = Store.objects.create(
            owner=owner,
            name='Loja selecionada',
            description='Loja usada no teste.',
            category='geral',
            phone='840000000',
            email='store@example.com',
            location='Maputo',
            status='active',
        )
        other_store = Store.objects.create(
            owner=other_owner,
            name='Outra loja',
            description='Segunda loja.',
            category='geral',
            phone='840000001',
            email='other-store@example.com',
            location='Maputo',
            status='active',
        )
        product = Product.objects.create(
            store=store,
            name='Produto da loja',
            description='Produto para o teste.',
            price='120.00',
            status='active',
        )
        selected_order = Order.objects.create(
            buyer=other_owner,
            store=store,
            order_number='PED-SELECT001',
            subtotal='120.00',
            total='120.00',
            payment_method='test',
            payment_status='completed',
            shipping_address={},
        )
        OrderItem.objects.create(
            order=selected_order,
            product=product,
            product_name=product.name,
            quantity=1,
            unit_price='120.00',
            total_price='120.00',
        )
        owner_order = Order.objects.create(
            buyer=owner,
            store=other_store,
            order_number='PED-OWNER001',
            subtotal='30.00',
            total='30.00',
            payment_method='mpesa',
            payment_status='pending',
            shipping_address={},
        )
        transaction = PaymentTransaction.objects.create(
            order=selected_order,
            provider='vpay',
            amount='120.00',
            status='completed',
        )
        transaction.orders.add(selected_order, owner_order)
        output = StringIO()

        call_command(
            'plan_selected_store_cleanup',
            str(store.id),
            stdout=output,
        )

        report = json.loads(output.getvalue())
        self.assertTrue(report['read_only'])
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['metrics_plan'], 'inventory_only')
        store_report = report['stores'][0]
        self.assertEqual(store_report['products'][0]['id'], str(product.id))
        order_report = store_report['orders'][0]
        self.assertEqual(order_report['id'], str(selected_order.id))
        self.assertTrue(
            order_report['payment_transactions'][0]['shared_with_other_orders']
        )
        owner_report = store_report['owner']
        self.assertTrue(owner_report['account_preserved'])
        self.assertEqual(
            owner_report['orders_as_buyer_outside_selected_stores'][0]['id'],
            str(owner_order.id),
        )
        self.assertTrue(Store.objects.filter(pk=store.pk).exists())
        self.assertTrue(Product.objects.filter(pk=product.pk).exists())
        self.assertTrue(Order.objects.filter(pk=selected_order.pk).exists())
        self.assertTrue(Order.objects.filter(pk=owner_order.pk).exists())
        self.assertNotIn(owner.email, output.getvalue())

    def test_command_rejects_unknown_store_ids(self):
        with self.assertRaisesMessage(CommandError, 'Loja(s) não encontrada(s)'):
            call_command(
                'plan_selected_store_cleanup',
                '7595e91f-964c-44af-8479-9b3d368f3b7f',
                stdout=StringIO(),
            )
