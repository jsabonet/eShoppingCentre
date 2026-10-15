from django.urls import path
from . import views

urlpatterns = [
    path('initiate/', views.PaymentsInitiateView.as_view(), name='payments_initiate'),
    path('status/', views.PaymentsStatusView.as_view(), name='payments_status'),
    path('gateway/', views.GatewayValidateView.as_view(), name='payments_gateway_validate'),
    path('reconcile/', views.PaymentsReconcileView.as_view(), name='payments_reconcile'),
    path('webhook/zumbopay/', views.ZumbopayWebhookView.as_view(), name='zumbopay_webhook'),
]
