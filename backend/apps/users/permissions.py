from rest_framework.permissions import BasePermission


class IsVerified(BasePermission):
    """Bloqueia contas cujo email ainda não foi verificado."""

    message = 'Verifica o teu email para poderes usar esta funcionalidade.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, 'is_verified', False)
        )
