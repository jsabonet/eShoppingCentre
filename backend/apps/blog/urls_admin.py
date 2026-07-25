from django.urls import path
from .views_admin import AdminBlogListCreateView, AdminBlogDetailView

urlpatterns = [
    path('', AdminBlogListCreateView.as_view(), name='admin_blog_list'),
    path('<uuid:pk>/', AdminBlogDetailView.as_view(), name='admin_blog_detail'),
]
