import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.products.models import SearchLog


class InventoryMetricsForResetCommandTests(TestCase):
    def test_command_reports_aggregate_metrics_without_mutating_them(self):
        SearchLog.objects.create(term='termo-de-teste')
        output = StringIO()

        call_command('inventory_metrics_for_reset', stdout=output)

        report = json.loads(output.getvalue())
        self.assertTrue(report['read_only'])
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['analytics_events']['search_events'], 1)
        self.assertEqual(SearchLog.objects.count(), 1)
        self.assertNotIn('termo-de-teste', output.getvalue())
