from django.urls import path
from . import views

urlpatterns = [
    path('password/change/', views.ChangePasswordView.as_view(), name='change_password'),
]

urlpatterns += [
    path('me/', views.UserProfileView.as_view(), name='user_profile'),
    path('me/addresses/', views.AddressListView.as_view(), name='address_list'),
    path('me/addresses/<uuid:pk>/', views.AddressDetailView.as_view(), name='address_detail'),
    path('me/orders/', views.MyOrdersView.as_view(), name='my_orders'),
    path('me/downloads/', views.MyDownloadsView.as_view(), name='my_downloads'),
    path('me/wishlist/', views.WishlistView.as_view(), name='my_wishlist'),
    path('me/wishlist/<uuid:pk>/', views.WishlistDeleteView.as_view(), name='wishlist_delete'),
]

urlpatterns += [
    path('admin/stats/', views.AdminStatsView.as_view(), name='admin_stats'),
    path('admin/stores/pending/', views.PendingStoresView.as_view(), name='admin_pending_stores'),
    path('admin/stores/<uuid:pk>/approve/', views.ApproveStoreView.as_view(), name='admin_approve_store'),
    path('admin/payouts/pending/', views.PendingPayoutsView.as_view(), name='admin_pending_payouts'),
    path('admin/payouts/<uuid:pk>/approve/', views.ApprovePayoutView.as_view(), name='admin_approve_payout'),
]
