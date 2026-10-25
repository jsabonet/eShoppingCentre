from django.contrib import admin
from .models import Store, StoreReportExport

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'status', 'rating', 'total_sales', 'location')
    list_filter = ('status', 'category')
    search_fields = ('name', 'owner__email')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(StoreReportExport)
class StoreReportExportAdmin(admin.ModelAdmin):
    list_display = (
        'created_at', 'store_name', 'generated_by_email', 'date_from', 'date_to',
        'order_count', 'gross_sales', 'refunds', 'net_sales',
    )
    list_filter = ('store', 'date_from', 'date_to')
    search_fields = ('store_name', 'generated_by_email')
    readonly_fields = tuple(field.name for field in StoreReportExport._meta.fields)
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False
