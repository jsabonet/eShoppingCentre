from django.urls import path
from . import views

urlpatterns = [
    path('', views.BlogPostListView.as_view(), name='blog_list'),
    path('<slug:slug>/', views.BlogPostDetailView.as_view(), name='blog_detail'),
]
