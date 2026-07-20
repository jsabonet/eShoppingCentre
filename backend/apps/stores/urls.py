from django.urls import path
from . import views
from .views_earnings import StoreStatsView, StoreEarningsView

urlpatterns = [
    path('', views.StoreListView.as_view(), name='store_list'),
    path('register/', views.StoreRegisterView.as_view(), name='store_register'),
    path('me/', views.MyStoreView.as_view(), name='my_store'),
    path('me/stats/', StoreStatsView.as_view(), name='store_stats'),
    path('me/earnings/', StoreEarningsView.as_view(), name='store_earnings'),
    path('<slug:slug>/', views.StoreDetailView.as_view(), name='store_detail'),
]
