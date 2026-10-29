from django.urls import path

from .views import (
    ActiveBannerCampaignListView,
    AdminBannerCampaignActivateNowView,
    AdminBannerCampaignDetailView,
    AdminBannerCampaignHistoryView,
    AdminBannerCampaignListCreateView,
    BannerCampaignMetricView,
)

urlpatterns = [
    path('active/', ActiveBannerCampaignListView.as_view(), name='active-banner-campaigns'),
    path(
        'metrics/<uuid:campaign_id>/<str:metric>/',
        BannerCampaignMetricView.as_view(),
        name='banner-campaign-metric',
    ),
    path('admin/', AdminBannerCampaignListCreateView.as_view(), name='admin-banner-campaign-list'),
    path(
        'admin/<uuid:pk>/activate-now/',
        AdminBannerCampaignActivateNowView.as_view(),
        name='admin-banner-campaign-activate-now',
    ),
    path(
        'admin/<uuid:pk>/',
        AdminBannerCampaignDetailView.as_view(),
        name='admin-banner-campaign-detail',
    ),
    path(
        'admin/<uuid:campaign_id>/history/',
        AdminBannerCampaignHistoryView.as_view(),
        name='admin-banner-campaign-history',
    ),
]
