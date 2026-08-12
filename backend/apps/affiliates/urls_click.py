from django.urls import path
from . import views

urlpatterns = [
    path('<str:code>/', views.affiliate_click, name='affiliate_click'),
]
