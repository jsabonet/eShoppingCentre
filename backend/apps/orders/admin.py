from django.contrib import admin
from django.utils.html import format_html
from .models import Order, OrderItem, ReturnRequest, OrderStatusHistory, SupportTicket


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product_name', 'unit_price', 'total_price')


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ('previous_status', 'new_status', 'changed_by', 'notes', 'created_at')
    can_delete = False
    ordering = ('-created_at',)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'buyer', 'store', 'status', 'total', 'payment_method', 'created_at')
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('order_number', 'buyer__email', 'store__name')
    inlines = [OrderItemInline, OrderStatusHistoryInline]
    readonly_fields = ('order_number', 'subtotal', 'shipping_cost', 'platform_fee', 'total')


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('order', 'previous_status', 'new_status', 'changed_by', 'notes', 'created_at')
    list_filter = ('new_status', 'created_at')
    search_fields = ('order__order_number', 'changed_by__email', 'notes')
    readonly_fields = ('order', 'previous_status', 'new_status', 'changed_by', 'notes', 'created_at')


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = ('rma_number', 'order_link', 'buyer_name', 'store_name', 'status_badge', 'refund_amount', 'disputed_badge', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('rma_number', 'order__order_number', 'buyer__email', 'store__name')
    readonly_fields = ('rma_number', 'order', 'buyer', 'store', 'created_at', 'disputed_at')
    fieldsets = (
        ('Informação Geral', {
            'fields': ('rma_number', 'order', 'status', 'reason_type', 'reason')
        }),
        ('Partes', {
            'fields': ('buyer', 'store')
        }),
        ('Financeiro', {
            'fields': ('refund_amount',)
        }),
        ('Logística', {
            'fields': ('buyer_tracking_code', 'shipping_notes', 'return_address', 'return_instructions')
        }),
        ('Administração', {
            'fields': ('admin_notes', 'reviewed_by', 'disputed_at', 'vendor_notes')
        }),
    )
    actions = ['approve_return', 'reject_return', 'force_refund']

    def order_link(self, obj):
        url = f'/admin/orders/order/{obj.order_id}/change/'
        return format_html('<a href="{}">{}</a>', url, obj.order.order_number)
    order_link.short_description = 'Pedido'
    order_link.admin_order_field = 'order__order_number'

    def buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email
    buyer_name.short_description = 'Comprador'
    buyer_name.admin_order_field = 'buyer__email'

    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = 'Loja'
    store_name.admin_order_field = 'store__name'

    def status_badge(self, obj):
        colors = {
            'requested': 'orange', 'approved': 'blue', 'rejected': 'red',
            'disputed': 'purple', 'shipped': 'teal', 'received': 'indigo', 'refunded': 'green',
        }
        return format_html(
            '<span style="background:{}; color:white; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">{}</span>',
            colors.get(obj.status, 'gray'), obj.get_status_display()
        )
    status_badge.short_description = 'Estado'

    def disputed_badge(self, obj):
        if obj.status == 'disputed':
            return format_html('<span style="color:red; font-weight:bold;">⚠ DISPUTA</span>')
        return ''
    disputed_badge.short_description = 'Disputa'

    @admin.action(description='✅ Aprovar devoluções selecionadas')
    def approve_return(self, request, queryset):
        for r in queryset.filter(status__in=['requested', 'disputed']):
            r.status = 'approved'
            r.admin_notes = f'Aprovado pelo admin {request.user.email}'
            r.reviewed_by = request.user
            r.save()
        self.message_user(request, f'{queryset.count()} devolução(ões) aprovada(s).')

    @admin.action(description='❌ Rejeitar devoluções selecionadas')
    def reject_return(self, request, queryset):
        for r in queryset.filter(status__in=['requested', 'disputed']):
            r.status = 'rejected'
            r.admin_notes = f'Rejeitado pelo admin {request.user.email}'
            r.reviewed_by = request.user
            r.vendor_notes = f'[Admin] Devolução rejeitada.'
            r.save()
        self.message_user(request, f'{queryset.count()} devolução(ões) rejeitada(s).')

    @admin.action(description='💰 Forçar reembolso')
    def force_refund(self, request, queryset):
        count = 0
        for r in queryset.filter(status__in=['received', 'disputed']):
            r.status = 'refunded'
            r.admin_notes = f'Reembolso forçado pelo admin {request.user.email}'
            r.reviewed_by = request.user
            r.save()
            count += 1
        self.message_user(request, f'{count} devolução(ões) reembolsada(s).')


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'buyer', 'order', 'category', 'status', 'assigned_to', 'created_at')
    list_filter = ('status', 'category', 'created_at')
    search_fields = ('subject', 'description', 'buyer__email', 'order__order_number')
    readonly_fields = ('buyer', 'order', 'created_at', 'resolved_at')
