from django.urls import path
from .views_admin import (
    AdminBlogCommentBulkView,
    AdminBlogCommentDetailView,
    AdminBlogCommentListView,
    AdminBlogDetailView,
    AdminBlogImageUploadView,
    AdminBlogListCreateView,
    AdminNewsletterDetailView,
    AdminNewsletterListView,
)

urlpatterns = [
    path('', AdminBlogListCreateView.as_view(), name='admin_blog_list'),
    path('images/', AdminBlogImageUploadView.as_view(), name='admin_blog_image_upload'),
    path('comments/', AdminBlogCommentListView.as_view(), name='admin_blog_comment_list'),
    path('comments/bulk/', AdminBlogCommentBulkView.as_view(), name='admin_blog_comment_bulk'),
    path('comments/<uuid:pk>/', AdminBlogCommentDetailView.as_view(), name='admin_blog_comment_detail'),
    path('newsletter/', AdminNewsletterListView.as_view(), name='admin_newsletter_list'),
    path('newsletter/<uuid:pk>/', AdminNewsletterDetailView.as_view(), name='admin_newsletter_detail'),
    path('<uuid:pk>/', AdminBlogDetailView.as_view(), name='admin_blog_detail'),
]
