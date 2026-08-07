from django.urls import path
from . import views

urlpatterns = [
    path('', views.ReviewCreateView.as_view(), name='review_create'),
    path('product/', views.ProductReviewsView.as_view(), name='product_reviews'),
    path('<uuid:pk>/', views.ReviewDetailView.as_view(), name='review_detail'),
    path('<uuid:review_id>/reply/', views.ReviewReplyView.as_view(), name='review_reply'),
    path('<uuid:review_id>/report/', views.ReviewReportView.as_view(), name='review_report'),
    path('<uuid:review_id>/helpful/', views.ReviewHelpfulView.as_view(), name='review_helpful'),
]

