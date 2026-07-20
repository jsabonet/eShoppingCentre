from django.contrib import admin
from .models import Order, OrderItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product_name', 'unit_price', 'total_price')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'buyer', 'store', 'status', 'total', 'payment_method')
    list_filter = ('status', 'payment_method')
    search_fields = ('order_number', 'buyer__email')
    inlines = [OrderItemInline]
