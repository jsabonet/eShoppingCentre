from django.urls import path
from . import views

urlpatterns = [
    path('', views.CreateOrderView.as_view(), name='order_create'),
    path('my/', views.MyOrdersView.as_view(), name='my_orders'),
    path('<uuid:pk>/', views.OrderDetailView.as_view(), name='order_detail'),
    path('<uuid:pk>/cancel/', views.CancelOrderView.as_view(), name='order_cancel'),
]
