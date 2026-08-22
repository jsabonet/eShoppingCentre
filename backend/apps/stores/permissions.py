from rest_framework import permissions


class IsStoreOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return hasattr(request.user, 'store') and obj.owner == request.user


class HasStore(permissions.BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'store') and request.user.store.status == 'active'


class CanManageProducts(permissions.BasePermission):
    """Bloqueia gestão de produtos/cursos quando a loja está suspensa, fechada ou rejeitada."""
    message = 'A sua loja não está activa. Não pode gerir produtos neste momento.'

    def has_permission(self, request, view):
        store = getattr(request.user, 'store', None)
        if not store:
            return False
        return store.status not in ('suspended', 'closed', 'rejected')
