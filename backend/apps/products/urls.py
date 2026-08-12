from django.urls import path
from . import views
from . import views_downloads

urlpatterns = [
    path('', views.ProductListView.as_view(), name='product_list'),
    path('my/', views.MyProductListView.as_view(), name='my_products'),
    path('search/', views.ProductSearchView.as_view(), name='product_search'),
    # ─── Downloads Digitais ───
    path('downloads/', views_downloads.MyDownloadsView.as_view(), name='my_downloads'),
    path('downloads/<uuid:download_id>/token/', views_downloads.DownloadTokenView.as_view(), name='download_token'),
    path('downloads/<uuid:download_id>/file/', views_downloads.DownloadFileView.as_view(), name='download_file'),
    # ─── Coupons ───
    path('coupons/', views.CouponListView.as_view(), name='coupon_list'),
    path('coupons/validate/', views.ValidateCouponView.as_view(), name='coupon_validate'),
    path('coupons/admin/', views.AdminCouponListView.as_view(), name='admin_coupon_list'),
    path('coupons/<uuid:pk>/toggle/', views.AdminCouponToggleView.as_view(), name='admin_coupon_toggle'),
    path('coupons/<uuid:pk>/', views.CouponDetailView.as_view(), name='coupon_detail'),
    path('<slug:slug>/', views.ProductDetailView.as_view(), name='product_detail'),
    path('<uuid:pk>/update/', views.ProductUpdateView.as_view(), name='product_update'),
    path('<uuid:pk>/delete/', views.ProductDeleteView.as_view(), name='product_delete'),
    path('<uuid:product_id>/images/', views.ProductImageView.as_view(), name='product_image'),
    path('<uuid:product_id>/images/<uuid:pk>/', views.ProductImageDeleteView.as_view(), name='product_image_delete'),
    path('<uuid:product_id>/variants/', views.ProductVariantListView.as_view(), name='product_variants'),
    path('<uuid:product_id>/variants/<uuid:pk>/', views.ProductVariantDetailView.as_view(), name='product_variant_detail'),
    path('<uuid:pk>/restock/', views.RestockProductView.as_view(), name='product_restock'),
]
