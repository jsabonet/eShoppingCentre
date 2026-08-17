from rest_framework.throttling import ScopedRateThrottle


class LoginRateThrottle(ScopedRateThrottle):
    """Throttle dedicado ao login — mitiga ataques de força bruta."""
    scope = 'login'
