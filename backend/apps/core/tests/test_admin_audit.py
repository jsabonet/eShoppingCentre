from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from apps.core.middleware import AdminAuditMiddleware
from apps.core.models import AdminAuditEvent


User = get_user_model()


class AdminAuditMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = User.objects.create_user(
            email='admin@example.com',
            username='admin',
            password='StrongPassword123!',
            is_staff=True,
        )

    def test_records_admin_api_request_without_query_or_body(self):
        request = self.factory.patch(
            '/api/v1/wallet/admin/payouts/123/?token=must-not-be-stored',
            data={'password': 'must-not-be-stored'},
            content_type='application/json',
            HTTP_USER_AGENT='Audit test',
            REMOTE_ADDR='192.0.2.10',
        )
        request.user = self.admin
        middleware = AdminAuditMiddleware(lambda req: HttpResponse(status=403))

        response = middleware(request)

        self.assertEqual(response.status_code, 403)
        event = AdminAuditEvent.objects.get()
        self.assertEqual(event.actor, self.admin)
        self.assertEqual(event.actor_email, self.admin.email)
        self.assertEqual(event.action, 'update')
        self.assertEqual(event.method, 'PATCH')
        self.assertEqual(event.path, '/api/v1/wallet/admin/payouts/123/')
        self.assertEqual(event.status_code, 403)
        self.assertEqual(event.outcome, 'failure')
        self.assertEqual(event.ip_address, '192.0.2.10')
        self.assertEqual(event.user_agent, 'Audit test')
        self.assertNotIn('token=', event.path)
        self.assertNotIn('password', str(event.__dict__))

    def test_does_not_record_non_admin_requests(self):
        request = self.factory.get('/api/v1/products/')
        middleware = AdminAuditMiddleware(lambda req: HttpResponse(status=200))

        middleware(request)

        self.assertFalse(AdminAuditEvent.objects.exists())

    def test_records_admin_named_route_outside_admin_url_prefix(self):
        request = self.factory.post('/api/v1/products/coupons/example/toggle/')
        request.resolver_match = SimpleNamespace(url_name='admin_coupon_toggle')
        request.user = self.admin
        middleware = AdminAuditMiddleware(lambda req: HttpResponse(status=200))

        middleware(request)

        self.assertEqual(AdminAuditEvent.objects.get().path, request.path_info)

    def test_records_staff_actions_on_routes_without_admin_marker(self):
        request = self.factory.patch('/api/v1/orders/returns/example/resolve/')
        request.user = self.admin
        middleware = AdminAuditMiddleware(lambda req: HttpResponse(status=200))

        middleware(request)

        self.assertEqual(AdminAuditEvent.objects.get().path, request.path_info)


class AdminAuditEndpointTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            username='admin',
            password='StrongPassword123!',
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        AdminAuditEvent.objects.create(
            actor=self.admin,
            actor_email=self.admin.email,
            action='delete',
            method='DELETE',
            path='/api/v1/admin/users/example/',
            status_code=204,
            outcome='success',
            ip_address='192.0.2.10',
        )

    def test_admin_can_filter_audit_events(self):
        response = self.client.get(
            '/api/v1/admin/audit/events/',
            {'action': 'delete', 'outcome': 'success', 'search': 'admin/users'},
        )

        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['path'], '/api/v1/admin/users/example/')

    def test_non_admin_cannot_read_audit_events(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/v1/admin/audit/events/')

        self.assertEqual(response.status_code, 401)
