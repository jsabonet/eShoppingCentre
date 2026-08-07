from django.urls import path
from . import views

urlpatterns = [
    path('', views.ConversationListView.as_view(), name='conversation_list'),
    path('unread-count/', views.UnreadCountView.as_view(), name='unread_count'),
    path('<uuid:pk>/', views.ConversationDetailView.as_view(), name='conversation_detail'),
    path('<uuid:conversation_id>/messages/', views.MessageCreateView.as_view(), name='message_create'),
    path('<uuid:conversation_id>/archive/', views.ConversationArchiveView.as_view(), name='conversation_archive'),
    path('<uuid:conversation_id>/unarchive/', views.ConversationArchiveView.as_view(), name='conversation_unarchive'),
]
