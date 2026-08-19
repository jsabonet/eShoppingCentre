from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


def _blacklist_user_tokens(user):
    """Revoga os refresh tokens existentes do utilizador (termina sessões ativas)."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            OutstandingToken,
            BlacklistedToken,
        )
        for token in OutstandingToken.objects.filter(user_id=user.id):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass


@admin.action(description='✅ Verificar utilizadores selecionados')
def verify_users(modeladmin, request, queryset):
    updated = queryset.update(is_verified=True)
    modeladmin.message_user(request, f'{updated} utilizador(es) verificado(s).', messages.SUCCESS)


@admin.action(description='❌ Desverificar utilizadores selecionados')
def unverify_users(modeladmin, request, queryset):
    updated = queryset.update(is_verified=False)
    modeladmin.message_user(request, f'{updated} utilizador(es) desverificado(s).', messages.SUCCESS)


@admin.action(description='🚫 Bloquear utilizadores selecionados (termina sessões)')
def block_users(modeladmin, request, queryset):
    count = 0
    for user in queryset:
        _blacklist_user_tokens(user)
        user.is_active = False
        user.save(update_fields=['is_active'])
        count += 1
    modeladmin.message_user(
        request,
        f'{count} utilizador(es) bloqueado(s). As sessões ativas foram revogadas.',
        messages.SUCCESS,
    )


@admin.action(description='🔓 Ativar (desbloquear) utilizadores selecionados')
def activate_users(modeladmin, request, queryset):
    updated = queryset.update(is_active=True)
    modeladmin.message_user(request, f'{updated} utilizador(es) ativado(s).', messages.SUCCESS)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email', 'username', 'phone',
        'is_verified', 'is_active', 'is_staff', 'auth_provider', 'date_joined',
    )
    list_filter = ('is_verified', 'is_active', 'is_staff', 'auth_provider')
    search_fields = ('email', 'username', 'phone', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    actions = [verify_users, unverify_users, block_users, activate_users]
    readonly_fields = BaseUserAdmin.readonly_fields + ('firebase_uid',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Verificação e autenticação', {
            'fields': ('is_verified', 'auth_provider', 'firebase_uid', 'phone', 'avatar', 'roles', 'bio'),
        }),
    )
