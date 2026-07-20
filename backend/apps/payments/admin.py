from django.contrib import admin
from .models import PaymentTransaction

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ('provider', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('provider', 'status')
