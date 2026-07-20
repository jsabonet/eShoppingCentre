from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.MyWalletView.as_view(), name='my_wallet'),
    path('me/transactions/', views.MyTransactionsView.as_view(), name='my_transactions'),
    path('me/payouts/', views.WalletPayoutView.as_view(), name='wallet_payout'),
]
