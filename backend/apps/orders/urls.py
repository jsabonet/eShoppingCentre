from django.urls import path
from . import views

urlpatterns = [
    path('', views.CreateOrderView.as_view(), name='order_create'),
    path('my/', views.MyOrdersView.as_view(), name='my_orders'),
    path('store/', views.StoreOrdersView.as_view(), name='store_orders'),
    # Returns
    path('returns/', views.CreateReturnView.as_view(), name='return_create'),
    path('returns/my/', views.MyReturnsView.as_view(), name='my_returns'),
    path('returns/store/', views.StoreReturnsView.as_view(), name='store_returns'),
    path('returns/admin/', views.AdminAllReturnsView.as_view(), name='admin_all_returns'),
    path('returns/<uuid:pk>/resolve/', views.ResolveReturnView.as_view(), name='return_resolve'),
    path('returns/<uuid:pk>/ship/', views.ShipReturnView.as_view(), name='return_ship'),
    path('returns/<uuid:pk>/receive/', views.ReceiveReturnView.as_view(), name='return_receive'),
    path('returns/<uuid:pk>/refund/', views.RefundReturnView.as_view(), name='return_refund'),
    path('returns/<uuid:pk>/dispute/', views.DisputeReturnView.as_view(), name='return_dispute'),
    path('returns/<uuid:pk>/admin-override/', views.AdminOverrideView.as_view(), name='return_admin_override'),
    path('returns/<uuid:pk>/images/', views.UploadReturnImageView.as_view(), name='return_upload_image'),
    # Orders
    path('<uuid:pk>/', views.OrderDetailView.as_view(), name='order_detail'),
    path('<uuid:pk>/cancel/', views.CancelOrderView.as_view(), name='order_cancel'),
    path('<uuid:pk>/update-status/', views.UpdateOrderStatusView.as_view(), name='order_update_status'),
]
