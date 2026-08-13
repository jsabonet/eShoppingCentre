from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.AffiliateRegisterView.as_view(), name='affiliate_register'),
    path('me/', views.MyAffiliateProfileView.as_view(), name='my_affiliate'),
    path('me/stats/', views.MyAffiliateStatsView.as_view(), name='affiliate_stats'),
    path('store/', views.StoreAffiliatesView.as_view(), name='store_affiliates'),
    path('links/', views.CreateAffiliateLinkView.as_view(), name='affiliate_link_create'),
    path('me/links/', views.MyAffiliateLinksView.as_view(), name='my_affiliate_links'),
    path('me/commissions/', views.MyCommissionsView.as_view(), name='my_commissions'),
    path('me/payouts/', views.AffiliatePayoutView.as_view(), name='affiliate_payout'),
    # Admin
    path('admin/affiliates/', views.AdminAffiliateListView.as_view(), name='admin_affiliate_list'),
    path('admin/affiliates/settings/', views.AdminAffiliateSettingsView.as_view(), name='admin_affiliate_settings'),
    path('admin/affiliates/commissions/', views.AdminAffiliateCommissionListView.as_view(), name='admin_affiliate_commissions'),
    path('admin/affiliates/commissions/<uuid:pk>/', views.AdminAffiliateCommissionActionView.as_view(), name='admin_affiliate_commission_action'),
    path('admin/affiliates/payouts/', views.AdminAffiliatePayoutListView.as_view(), name='admin_affiliate_payouts'),
    path('admin/affiliates/payouts/<uuid:pk>/', views.AdminAffiliatePayoutActionView.as_view(), name='admin_affiliate_payout_action'),
    path('admin/affiliates/<uuid:pk>/status/', views.AdminAffiliateStatusView.as_view(), name='admin_affiliate_status'),
]
