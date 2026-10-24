from django.urls import path
from . import views

urlpatterns = [
    path('subscribe/', views.NewsletterSubscribeView.as_view(), name='newsletter_subscribe'),
    path('unsubscribe/', views.NewsletterUnsubscribeView.as_view(), name='newsletter_unsubscribe'),
]
