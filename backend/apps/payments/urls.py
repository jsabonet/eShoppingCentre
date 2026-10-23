from django.urls import path
from . import views

urlpatterns = [
    path('initiate/', views.PaymentsInitiateView.as_view(), name='payments_initiate'),
    path('status/', views.PaymentsStatusView.as_view(), name='payments_status'),
    path('webhook/vpay/', views.VPayWebhookView.as_view(), name='vpay_webhook'),
]
