from django.urls import path
from . import views

urlpatterns = [
    path('webhook/mpesa/', views.MPesaWebhookView.as_view(), name='mpesa_webhook'),
    path('webhook/stripe/', views.StripeWebhookView.as_view(), name='stripe_webhook'),
]
