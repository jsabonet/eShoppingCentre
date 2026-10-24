from time import perf_counter

from django.utils.functional import empty, SimpleLazyObject

from apps.core.models import AdminAuditEvent


class AdminAuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _is_admin_request(path, resolver_match):
        route_name = getattr(resolver_match, 'url_name', '') or ''
        return (
            path.startswith('/django-admin/')
            or 'admin' in path.strip('/').split('/')
            or route_name.startswith('admin_')
        )

    @staticmethod
    def _action_for_method(method):
        return {
            'GET': 'read',
            'HEAD': 'read',
            'OPTIONS': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }.get(method.upper(), 'action')

    def __call__(self, request):
        started_at = perf_counter()
        response = self.get_response(request)
        actor = request.__dict__.get('user')
        if isinstance(actor, SimpleLazyObject):
            actor = actor._wrapped
            if actor is empty:
                actor = None
        is_authenticated = bool(actor and actor.is_authenticated)
        is_admin_action = self._is_admin_request(
            request.path_info,
            getattr(request, 'resolver_match', None),
        ) or (is_authenticated and actor.is_staff)
        if not is_admin_action:
            return response

        AdminAuditEvent.objects.create(
            actor=actor if is_authenticated else None,
            actor_email=getattr(actor, 'email', '') if is_authenticated else '',
            action=self._action_for_method(request.method),
            method=request.method.upper()[:10],
            path=request.path_info[:500],
            status_code=response.status_code,
            outcome='success' if response.status_code < 400 else 'failure',
            ip_address=request.META.get('REMOTE_ADDR') or None,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            duration_ms=max(0, int((perf_counter() - started_at) * 1000)),
        )
        return response
