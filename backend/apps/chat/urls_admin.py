from django.urls import path
from apps.chat.views import AdminConversationListView, AdminConversationDetailView

urlpatterns = [
    path('', AdminConversationListView.as_view(), name='admin_chat_list'),
    path('<uuid:pk>/', AdminConversationDetailView.as_view(), name='admin_chat_detail'),
]
