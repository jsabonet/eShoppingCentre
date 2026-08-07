from django.contrib import admin
from .models import Review, StoreReview, SellerRating

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'is_verified_purchase', 'report_count', 'is_hidden', 'created_at')
    list_filter = ('is_verified_purchase', 'is_hidden', 'rating')
    search_fields = ('user__email', 'product__name', 'comment')
    actions = ['hide_reviews', 'unhide_reviews']

    @admin.action(description='Esconder seleccionadas')
    def hide_reviews(self, request, queryset):
        queryset.update(is_hidden=True)

    @admin.action(description='Mostrar seleccionadas')
    def unhide_reviews(self, request, queryset):
        queryset.update(is_hidden=False)


@admin.register(StoreReview)
class StoreReviewAdmin(admin.ModelAdmin):
    list_display = ('store', 'user', 'overall_rating', 'report_count', 'created_at')
    list_filter = ('is_hidden',)
    search_fields = ('user__email', 'store__name')


@admin.register(SellerRating)
class SellerRatingAdmin(admin.ModelAdmin):
    list_display = ('user', 'avg_overall', 'total_reviews', 'response_rate')
