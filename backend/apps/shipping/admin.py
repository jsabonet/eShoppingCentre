from django.contrib import admin
from .models import ShippingSettings, ShippingZone, ShippingMethod, ShippingRate


@admin.register(ShippingSettings)
class ShippingSettingsAdmin(admin.ModelAdmin):
    list_display = ('fallback_enabled', 'fallback_label', 'default_rate')
    fieldsets = (
        ('Frete de Fallback', {
            'fields': ('fallback_enabled', 'fallback_label', 'fallback_days_min', 'fallback_days_max'),
        }),
        ('Taxas por Província', {
            'fields': ('default_rate', 'province_rates'),
            'description': 'Taxa fixa em MZN por província (usa os slugs: maputo_cidade, maputo_provincia, gaza, inhambane, sofala, manica, tete, zambezia, nampula, cabo_delgado, niassa).',
        }),
    )


@admin.register(ShippingZone)
class ShippingZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'store', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'store__name')


@admin.register(ShippingMethod)
class ShippingMethodAdmin(admin.ModelAdmin):
    list_display = ('name', 'store', 'method_type', 'is_active')
    list_filter = ('method_type', 'is_active')
    search_fields = ('name', 'store__name')


@admin.register(ShippingRate)
class ShippingRateAdmin(admin.ModelAdmin):
    list_display = ('method', 'zone', 'base_price', 'per_kg_price', 'is_active')
    list_filter = ('is_active',)
