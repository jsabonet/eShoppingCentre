from django.contrib import admin
from .models import PaymentTransaction

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ('provider', 'order', 'amount', 'currency', 'status', 'provider_transaction_id', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('provider_transaction_id', 'idempotency_key', 'order__order_number')
