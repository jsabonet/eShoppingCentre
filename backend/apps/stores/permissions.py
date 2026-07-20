from rest_framework import permissions


class IsStoreOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return hasattr(request.user, 'store') and obj.owner == request.user


class HasStore(permissions.BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'store') and request.user.store.status == 'active'
