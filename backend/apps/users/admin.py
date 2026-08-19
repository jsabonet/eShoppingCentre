from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
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


def _soft_delete_user(user):
    """Eliminação suave (soft-delete): desativa a conta e, em cascata,
    suspende a loja e inativa os produtos — sem remover nenhum dado."""
    from apps.stores.models import Store

    _blacklist_user_tokens(user)
    user.is_active = False
    user.deleted_at = timezone.now()
    user.save(update_fields=['is_active', 'deleted_at'])

    store = Store.objects.filter(owner=user).first()
    if store is not None:
        store.status = 'suspended'
        store.save(update_fields=['status'])
        store.products.update(status='inactive')


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
    updated = queryset.update(is_active=True, deleted_at=None)
    modeladmin.message_user(request, f'{updated} utilizador(es) ativado(s).', messages.SUCCESS)


@admin.action(description='🗑️ Eliminar (soft-delete) utilizadores selecionados')
def soft_delete_users(modeladmin, request, queryset):
    count = 0
    for user in queryset:
        _soft_delete_user(user)
        count += 1
    modeladmin.message_user(
        request,
        f'{count} conta(s) eliminada(s) em modo suave: conta, loja e produtos desativados. '
        'Nenhum dado foi removido.',
        messages.WARNING,
    )


class DeletedFilter(admin.SimpleListFilter):
    """Filtra contas eliminadas (soft-delete) vs. ativas/bloqueadas."""
    title = 'Eliminado (soft)'
    parameter_name = 'deleted'

    def lookups(self, request, model_admin):
        return [
            ('yes', 'Sim'),
            ('no', 'Não'),
        ]

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.filter(deleted_at__isnull=False)
        if self.value() == 'no':
            return queryset.filter(deleted_at__isnull=True)
        return queryset


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email', 'username', 'phone',
        'is_verified', 'is_active', 'is_staff', 'is_deleted', 'auth_provider', 'date_joined',
    )
    list_filter = ('is_verified', 'is_active', 'is_staff', DeletedFilter, 'auth_provider')
    search_fields = ('email', 'username', 'phone', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    actions = [verify_users, unverify_users, block_users, activate_users, soft_delete_users]
    readonly_fields = BaseUserAdmin.readonly_fields + ('firebase_uid',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Verificação e autenticação', {
            'fields': ('is_verified', 'auth_provider', 'firebase_uid', 'phone', 'avatar', 'roles', 'bio'),
        }),
    )

    @admin.display(boolean=True, description='Eliminado (soft)')
    def is_deleted(self, obj):
        return obj.deleted_at is not None

    # ─── Soft-delete: o botão "Eliminar" deixa de apagar dados ───
    def delete_model(self, request, obj):
        _soft_delete_user(obj)
        self.message_user(
            request,
            f'Conta {obj.email} eliminada em modo suave: conta, loja e produtos desativados. '
            'Nenhum dado foi removido.',
            messages.WARNING,
        )

    def delete_queryset(self, request, queryset):
        for user in queryset:
            _soft_delete_user(user)
        self.message_user(
            request,
            f'{queryset.count()} conta(s) eliminada(s) em modo suave. Nenhum dado foi removido.',
            messages.WARNING,
        )
