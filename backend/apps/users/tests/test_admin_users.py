from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User


class AdminUserListTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='admin-users@example.test',
            username='admin-users',
            password='test-password',
        )
        self.active_user = User.objects.create_user(
            email='active-user@example.test',
            username='active-user',
            password='test-password',
        )
        self.deleted_user = User.objects.create_user(
            email='deleted-user@example.test',
            username='deleted-user',
            password='test-password',
        )
        self.deleted_user.soft_delete()
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_list_hides_soft_deleted_users_by_default(self):
        response = self.client.get('/api/v1/admin/users/')

        self.assertEqual(response.status_code, 200)
        listed_ids = {str(item['id']) for item in response.data['results']}
        self.assertIn(str(self.active_user.id), listed_ids)
        self.assertNotIn(str(self.deleted_user.id), listed_ids)

    def test_admin_can_include_soft_deleted_users(self):
        response = self.client.get('/api/v1/admin/users/?include_deleted=true')

        self.assertEqual(response.status_code, 200)
        listed_ids = {str(item['id']) for item in response.data['results']}
        self.assertIn(str(self.deleted_user.id), listed_ids)

    def test_deleted_user_disappears_from_default_list(self):
        delete_response = self.client.delete(
            f'/api/v1/admin/users/{self.active_user.id}/'
        )

        self.assertEqual(delete_response.status_code, 200)
        list_response = self.client.get('/api/v1/admin/users/')
        listed_ids = {str(item['id']) for item in list_response.data['results']}
        self.assertNotIn(str(self.active_user.id), listed_ids)
