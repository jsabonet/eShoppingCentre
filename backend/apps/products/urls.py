from django.urls import path
from . import views

urlpatterns = [
    path('', views.ProductListView.as_view(), name='product_list'),
    path('my/', views.MyProductListView.as_view(), name='my_products'),
    path('search/', views.ProductSearchView.as_view(), name='product_search'),
    path('coupons/', views.CouponListView.as_view(), name='coupon_list'),
    path('coupons/validate/', views.ValidateCouponView.as_view(), name='coupon_validate'),
    path('coupons/<uuid:pk>/', views.CouponDetailView.as_view(), name='coupon_detail'),
    path('<slug:slug>/', views.ProductDetailView.as_view(), name='product_detail'),
    path('<uuid:pk>/update/', views.ProductUpdateView.as_view(), name='product_update'),
    path('<uuid:pk>/delete/', views.ProductDeleteView.as_view(), name='product_delete'),
    path('<uuid:product_id>/images/', views.ProductImageView.as_view(), name='product_image'),
    path('<uuid:product_id>/images/<uuid:pk>/', views.ProductImageDeleteView.as_view(), name='product_image_delete'),
    path('<uuid:product_id>/variants/', views.ProductVariantListView.as_view(), name='product_variants'),
    path('<uuid:product_id>/variants/<uuid:pk>/', views.ProductVariantDetailView.as_view(), name='product_variant_detail'),
]
