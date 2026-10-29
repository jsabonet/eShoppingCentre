import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase


class InventoryTestDataCommandTests(TestCase):
    def test_command_reports_counts_without_mutating_or_disclosing_users(self):
        user = get_user_model().objects.create_user(
            email='real-user@example.com',
            username='real-user',
            password='SecurePassword123!',
            is_verified=True,
        )
        output = StringIO()

        call_command('inventory_test_data', stdout=output)

        report = json.loads(output.getvalue())
        self.assertTrue(report['read_only'])
        self.assertEqual(report['users']['total'], 1)
        self.assertEqual(report['users']['verified'], 1)
        self.assertEqual(report['orders']['total'], 0)
        self.assertTrue(get_user_model().objects.filter(pk=user.pk).exists())
        self.assertNotIn(user.email, output.getvalue())
