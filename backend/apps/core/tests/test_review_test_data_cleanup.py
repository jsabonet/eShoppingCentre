import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.orders.models import Order


class ReviewTestDataCleanupCommandTests(TestCase):
    def test_command_reports_test_payment_orders_without_mutating_or_disclosing_users(self):
        user = get_user_model().objects.create_user(
            email='real-buyer@example.com',
            username='real-buyer',
            password='SecurePassword123!',
        )
        test_order = Order.objects.create(
            buyer=user,
            order_number='PED-TEST001',
            status='delivered',
            subtotal='120.00',
            total='120.00',
            payment_method='test',
            payment_status='completed',
            shipping_address={},
        )
        real_order = Order.objects.create(
            buyer=user,
            order_number='PED-REAL001',
            status='pending',
            subtotal='50.00',
            total='50.00',
            payment_method='mpesa',
            payment_status='pending',
            shipping_address={},
        )
        output = StringIO()

        call_command('review_test_data_cleanup', stdout=output)

        report = json.loads(output.getvalue())
        self.assertEqual(report['mode'], 'dry_run_only')
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['test_orders']['count'], 1)
        candidate = report['test_orders']['orders'][0]
        self.assertEqual(candidate['id'], str(test_order.id))
        self.assertEqual(candidate['order_number'], 'PED-TEST001')
        self.assertTrue(candidate['review_risk']['completed_payment'])
        self.assertTrue(Order.objects.filter(pk=test_order.pk).exists())
        self.assertTrue(Order.objects.filter(pk=real_order.pk).exists())
        self.assertNotIn(user.email, output.getvalue())
