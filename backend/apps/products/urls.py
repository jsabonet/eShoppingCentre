from django.urls import path
from . import views

urlpatterns = [
    path('', views.ProductListView.as_view(), name='product_list'),
    path('search/', views.ProductSearchView.as_view(), name='product_search'),
    path('<slug:slug>/', views.ProductDetailView.as_view(), name='product_detail'),
    path('<uuid:pk>/update/', views.ProductUpdateView.as_view(), name='product_update'),
    path('<uuid:pk>/delete/', views.ProductDeleteView.as_view(), name='product_delete'),
    path('<uuid:product_id>/images/', views.ProductImageView.as_view(), name='product_image'),
]
