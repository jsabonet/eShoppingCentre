from django.contrib import admin
from .models import Store

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'status', 'rating', 'total_sales', 'location')
    list_filter = ('status', 'category')
    search_fields = ('name', 'owner__email')
    prepopulated_fields = {'slug': ('name',)}
