from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'phone', 'is_verified', 'is_staff')
    search_fields = ('email', 'username', 'phone')
    ordering = ('email',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Extra', {'fields': ('phone', 'avatar', 'roles', 'is_verified', 'bio')}),
    )
