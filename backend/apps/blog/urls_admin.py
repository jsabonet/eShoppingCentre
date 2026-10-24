from django.urls import path
from .views_admin import (
    AdminBlogCategoryDetailView,
    AdminBlogCategoryListCreateView,
    AdminBlogCommentBulkView,
    AdminBlogCommentDetailView,
    AdminBlogCommentListView,
    AdminBlogDetailView,
    AdminBlogImageUploadView,
    AdminBlogListCreateView,
    AdminBlogNewsletterSendView,
    AdminNewsletterDetailView,
    AdminNewsletterListView,
)

urlpatterns = [
    path('categories/', AdminBlogCategoryListCreateView.as_view(), name='admin_blog_category_list'),
    path('categories/<uuid:pk>/', AdminBlogCategoryDetailView.as_view(), name='admin_blog_category_detail'),
    path('', AdminBlogListCreateView.as_view(), name='admin_blog_list'),
    path('images/', AdminBlogImageUploadView.as_view(), name='admin_blog_image_upload'),
    path('comments/', AdminBlogCommentListView.as_view(), name='admin_blog_comment_list'),
    path('comments/bulk/', AdminBlogCommentBulkView.as_view(), name='admin_blog_comment_bulk'),
    path('comments/<uuid:pk>/', AdminBlogCommentDetailView.as_view(), name='admin_blog_comment_detail'),
    path('newsletter/', AdminNewsletterListView.as_view(), name='admin_newsletter_list'),
    path('newsletter/<uuid:pk>/', AdminNewsletterDetailView.as_view(), name='admin_newsletter_detail'),
    path('<uuid:pk>/notify-subscribers/', AdminBlogNewsletterSendView.as_view(), name='admin_blog_notify_subscribers'),
    path('<uuid:pk>/', AdminBlogDetailView.as_view(), name='admin_blog_detail'),
]
