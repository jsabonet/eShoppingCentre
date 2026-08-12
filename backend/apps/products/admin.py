from django.contrib import admin
from .models import Category, Product, ProductImage, ProductVariant, ProductVariation, StockLog

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'sort_order')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'store', 'price', 'status', 'product_type', 'sales_count')
    list_filter = ('status', 'product_type', 'category')
    search_fields = ('name',)

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ('product', 'is_primary', 'sort_order')

@admin.register(ProductVariation)
class ProductVariationAdmin(admin.ModelAdmin):
    list_display = ('product', 'name', 'price_modifier', 'stock', 'is_active')


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('product', 'name', 'sku', 'price', 'stock', 'is_active')
    search_fields = ('name', 'sku')
    list_filter = ('is_active',)


@admin.register(StockLog)
class StockLogAdmin(admin.ModelAdmin):
    list_display = ('product', 'change_type', 'quantity', 'stock_before', 'stock_after', 'reference', 'changed_by', 'created_at')
    list_filter = ('change_type', 'created_at')
    search_fields = ('product__name', 'reference', 'notes')
    readonly_fields = ('product', 'change_type', 'quantity', 'stock_before', 'stock_after', 'reference', 'changed_by', 'notes', 'created_at')
