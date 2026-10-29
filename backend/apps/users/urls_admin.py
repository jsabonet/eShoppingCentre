from django.urls import path
from .views_admin import (
    AdminStatsView, PendingStoresView, ApproveStoreView,
    AdminUserListView, AdminUserDetailView,
    AdminAllStoresView, AdminStoreManageView, AdminAllOrdersView,
    AdminStoreCreateView, AdminStoreOwnerListView,
    AdminStoreConversationsView, AdminStoreFollowersView, AdminStoreReviewsView,
    AdminStoreReviewModerateView,
)
from apps.products.views_admin import (
    AdminStoreProductDetailView,
    AdminStoreProductImageDeleteView,
    AdminStoreProductImageListCreateView,
    AdminStoreProductListCreateView,
)

urlpatterns = [
    path('stats/', AdminStatsView.as_view(), name='admin_stats'),
    path('stores/pending/', PendingStoresView.as_view(), name='admin_pending_stores'),
    path('stores/<uuid:pk>/approve/', ApproveStoreView.as_view(), name='admin_approve_store'),
    path('stores/all/', AdminAllStoresView.as_view(), name='admin_all_stores'),
    path('stores/create/', AdminStoreCreateView.as_view(), name='admin_store_create'),
    path('stores/owners/', AdminStoreOwnerListView.as_view(), name='admin_store_owners'),
    path('stores/<uuid:pk>/manage/', AdminStoreManageView.as_view(), name='admin_store_manage'),
    path('stores/<uuid:store_id>/products/', AdminStoreProductListCreateView.as_view(), name='admin_store_products'),
    path('stores/<uuid:store_id>/products/<uuid:pk>/', AdminStoreProductDetailView.as_view(), name='admin_store_product_detail'),
    path('stores/<uuid:store_id>/products/<uuid:product_id>/images/', AdminStoreProductImageListCreateView.as_view(), name='admin_store_product_images'),
    path('stores/<uuid:store_id>/products/<uuid:product_id>/images/<uuid:pk>/', AdminStoreProductImageDeleteView.as_view(), name='admin_store_product_image_delete'),
    path('orders/all/', AdminAllOrdersView.as_view(), name='admin_all_orders'),
    path('users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('users/<pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    # Store data for admin
    path('stores/<uuid:store_id>/conversations/', AdminStoreConversationsView.as_view(), name='admin_store_conversations'),
    path('stores/<uuid:store_id>/followers/', AdminStoreFollowersView.as_view(), name='admin_store_followers'),
    path('stores/<uuid:store_id>/reviews/', AdminStoreReviewsView.as_view(), name='admin_store_reviews'),
    path('reviews/<uuid:review_id>/', AdminStoreReviewModerateView.as_view(), name='admin_review_moderate'),
]
