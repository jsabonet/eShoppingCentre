from django.urls import path
from . import views

urlpatterns = [
    # Estimate (público)
    path('estimate/', views.ShippingEstimateView.as_view(), name='shipping_estimate'),

    # Zones (seller)
    path('zones/', views.ZoneListCreateView.as_view(), name='zone_list'),
    path('zones/<uuid:pk>/', views.ZoneDetailView.as_view(), name='zone_detail'),

    # Methods (seller)
    path('methods/', views.MethodListCreateView.as_view(), name='method_list'),
    path('methods/<uuid:pk>/', views.MethodDetailView.as_view(), name='method_detail'),

    # Rates (seller)
    path('rates/', views.RateListCreateView.as_view(), name='rate_list'),
    path('rates/<uuid:pk>/', views.RateDetailView.as_view(), name='rate_detail'),
]
