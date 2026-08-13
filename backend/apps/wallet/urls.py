from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.MyWalletView.as_view(), name='my_wallet'),
    path('me/transactions/', views.MyTransactionsView.as_view(), name='my_transactions'),
    path('me/payouts/', views.WalletPayoutView.as_view(), name='wallet_payout'),
    # Admin
    path('admin/payouts/', views.AdminPayoutListView.as_view(), name='admin_payout_list'),
    path('admin/payouts/<uuid:pk>/approve/', views.AdminPayoutApproveView.as_view(), name='admin_payout_approve'),
    path('admin/payouts/<uuid:pk>/pay/', views.AdminPayoutPayView.as_view(), name='admin_payout_pay'),
    path('admin/payouts/<uuid:pk>/reject/', views.AdminPayoutRejectView.as_view(), name='admin_payout_reject'),
    path('admin/reconciliation/', views.AdminReconciliationView.as_view(), name='admin_reconciliation'),
]
