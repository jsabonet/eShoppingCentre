from django.urls import path
from .views_admin import (
    AdminStatsView, PendingStoresView, ApproveStoreView,
    PendingPayoutsView, ApprovePayoutView,
    AdminUserListView, AdminUserDetailView,
    AdminAllStoresView, AdminStoreManageView, AdminAllOrdersView,
    AdminStoreConversationsView, AdminStoreFollowersView, AdminStoreReviewsView,
    AdminStoreReviewModerateView,
)

urlpatterns = [
    path('stats/', AdminStatsView.as_view(), name='admin_stats'),
    path('stores/pending/', PendingStoresView.as_view(), name='admin_pending_stores'),
    path('stores/<uuid:pk>/approve/', ApproveStoreView.as_view(), name='admin_approve_store'),
    path('stores/all/', AdminAllStoresView.as_view(), name='admin_all_stores'),
    path('stores/<uuid:pk>/manage/', AdminStoreManageView.as_view(), name='admin_store_manage'),
    path('orders/all/', AdminAllOrdersView.as_view(), name='admin_all_orders'),
    path('payouts/pending/', PendingPayoutsView.as_view(), name='admin_pending_payouts'),
    path('payouts/<uuid:pk>/approve/', ApprovePayoutView.as_view(), name='admin_approve_payout'),
    path('users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('users/<pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    # Store data for admin
    path('stores/<uuid:store_id>/conversations/', AdminStoreConversationsView.as_view(), name='admin_store_conversations'),
    path('stores/<uuid:store_id>/followers/', AdminStoreFollowersView.as_view(), name='admin_store_followers'),
    path('stores/<uuid:store_id>/reviews/', AdminStoreReviewsView.as_view(), name='admin_store_reviews'),
    path('reviews/<uuid:review_id>/', AdminStoreReviewModerateView.as_view(), name='admin_review_moderate'),
]
