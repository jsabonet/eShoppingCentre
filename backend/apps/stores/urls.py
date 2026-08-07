from django.urls import path
from . import views
from .views_earnings import StoreStatsView, StoreEarningsView
from .views_follow import StoreFollowView, StoreUnfollowView, StoreFollowStatusView
from apps.reviews.views import (
    StoreReviewListView, StoreReviewDetailView,
    StoreReviewReplyView, SellerRatingView,
)

urlpatterns = [
    path('', views.StoreListView.as_view(), name='store_list'),
    path('register/', views.StoreRegisterView.as_view(), name='store_register'),
    path('me/', views.MyStoreView.as_view(), name='my_store'),
    path('me/stats/', StoreStatsView.as_view(), name='store_stats'),
    path('me/earnings/', StoreEarningsView.as_view(), name='store_earnings'),
    # Follow
    path('<slug:slug>/follow/', StoreFollowView.as_view(), name='store_follow'),
    path('<slug:slug>/unfollow/', StoreUnfollowView.as_view(), name='store_unfollow'),
    path('<slug:slug>/follow-status/', StoreFollowStatusView.as_view(), name='store_follow_status'),
    # Store reviews
    path('<slug:slug>/reviews/', StoreReviewListView.as_view(), name='store_reviews'),
    path('reviews/<uuid:pk>/', StoreReviewDetailView.as_view(), name='store_review_detail'),
    path('reviews/<uuid:review_id>/reply/', StoreReviewReplyView.as_view(), name='store_review_reply'),
    # Seller rating
    path('sellers/<uuid:user_id>/rating/', SellerRatingView.as_view(), name='seller_rating'),
    path('<slug:slug>/', views.StoreDetailView.as_view(), name='store_detail'),
]

