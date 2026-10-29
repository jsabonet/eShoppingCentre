from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase

from apps.stores.featured import (
    FEATURED_STORES_CACHE_KEY,
    get_featured_stores,
)
from apps.stores.models import Store


class FeaturedStoresCacheTests(TestCase):
    def setUp(self):
        owner = get_user_model().objects.create_user(
            email='featured-owner@example.com',
            username='featured-owner',
            password='SecurePassword123!',
        )
        self.store = Store.objects.create(
            owner=owner,
            name='Loja em destaque',
            description='Loja de teste.',
            category='geral',
            phone='840000000',
            email='featured@example.com',
            location='Maputo',
            status='active',
        )

    def tearDown(self):
        cache.delete(FEATURED_STORES_CACHE_KEY)

    def _prime_stale_cache(self):
        cache.set(
            FEATURED_STORES_CACHE_KEY,
            [{'id': str(self.store.pk), 'name': self.store.name}],
            3600,
        )

    def test_deleting_store_invalidates_featured_stores_cache(self):
        self._prime_stale_cache()

        with self.captureOnCommitCallbacks(execute=True):
            self.store.delete()

        self.assertEqual(get_featured_stores(), [])

    def test_status_queryset_update_invalidates_featured_stores_cache(self):
        self._prime_stale_cache()

        with self.captureOnCommitCallbacks(execute=True):
            Store.objects.filter(pk=self.store.pk).update(status='closed')

        self.assertEqual(get_featured_stores(), [])

    def test_status_model_save_invalidates_featured_stores_cache(self):
        self._prime_stale_cache()
        self.store.status = 'suspended'

        with self.captureOnCommitCallbacks(execute=True):
            self.store.save(update_fields=['status'])

        self.assertEqual(get_featured_stores(), [])
