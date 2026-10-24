from django.urls import path
from . import views

urlpatterns = [
    path('', views.BlogPostListView.as_view(), name='blog_list'),
    path('<slug:slug>/comments/', views.BlogCommentListCreateView.as_view(), name='blog_comments'),
    path('<slug:slug>/like/', views.BlogLikeToggleView.as_view(), name='blog_like'),
    path('<slug:slug>/', views.BlogPostDetailView.as_view(), name='blog_detail'),
]
