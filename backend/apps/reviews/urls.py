from django.urls import path
from . import views

urlpatterns = [
    path('', views.ReviewCreateView.as_view(), name='review_create'),
    path('product/', views.ProductReviewsView.as_view(), name='product_reviews'),
]
