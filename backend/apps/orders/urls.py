from django.urls import path
from . import views

urlpatterns = [
    path('', views.CreateOrderView.as_view(), name='order_create'),
    path('my/', views.MyOrdersView.as_view(), name='my_orders'),
    path('store/', views.StoreOrdersView.as_view(), name='store_orders'),
    path('returns/', views.CreateReturnView.as_view(), name='return_create'),
    path('returns/store/', views.StoreReturnsView.as_view(), name='store_returns'),
    path('returns/<uuid:pk>/manage/', views.ManageReturnView.as_view(), name='manage_return'),
    path('<uuid:pk>/', views.OrderDetailView.as_view(), name='order_detail'),
    path('<uuid:pk>/cancel/', views.CancelOrderView.as_view(), name='order_cancel'),
    path('<uuid:pk>/update-status/', views.UpdateOrderStatusView.as_view(), name='order_update_status'),
]
