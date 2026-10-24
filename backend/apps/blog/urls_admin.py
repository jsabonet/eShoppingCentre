from django.urls import path
from .views_admin import (
    AdminBlogDetailView,
    AdminBlogImageUploadView,
    AdminBlogListCreateView,
)

urlpatterns = [
    path('', AdminBlogListCreateView.as_view(), name='admin_blog_list'),
    path('images/', AdminBlogImageUploadView.as_view(), name='admin_blog_image_upload'),
    path('<uuid:pk>/', AdminBlogDetailView.as_view(), name='admin_blog_detail'),
]
