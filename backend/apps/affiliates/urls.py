from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.AffiliateRegisterView.as_view(), name='affiliate_register'),
    path('me/', views.MyAffiliateProfileView.as_view(), name='my_affiliate'),
    path('me/stats/', views.MyAffiliateStatsView.as_view(), name='affiliate_stats'),
    path('links/', views.CreateAffiliateLinkView.as_view(), name='affiliate_link_create'),
    path('me/links/', views.MyAffiliateLinksView.as_view(), name='my_affiliate_links'),
    path('me/commissions/', views.MyCommissionsView.as_view(), name='my_commissions'),
    path('me/payouts/', views.AffiliatePayoutView.as_view(), name='affiliate_payout'),
]
