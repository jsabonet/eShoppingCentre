from django.urls import path
from .views_admin import AdminCategoryListCreateView, AdminCategoryDetailView

urlpatterns = [
    path('', AdminCategoryListCreateView.as_view(), name='admin_category_list'),
    path('<uuid:pk>/', AdminCategoryDetailView.as_view(), name='admin_category_detail'),
]
