from django.urls import path
from .views_admin import (
    AdminStatsView, PendingStoresView, ApproveStoreView,
    PendingPayoutsView, ApprovePayoutView,
)

urlpatterns = [
    path('stats/', AdminStatsView.as_view(), name='admin_stats'),
    path('stores/pending/', PendingStoresView.as_view(), name='admin_pending_stores'),
    path('stores/<uuid:pk>/approve/', ApproveStoreView.as_view(), name='admin_approve_store'),
    path('payouts/pending/', PendingPayoutsView.as_view(), name='admin_pending_payouts'),
    path('payouts/<uuid:pk>/approve/', ApprovePayoutView.as_view(), name='admin_approve_payout'),
]
