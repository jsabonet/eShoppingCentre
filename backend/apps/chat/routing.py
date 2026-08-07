from django.urls import path


# Lazy import to avoid AppRegistryNotReady
def get_chat_consumer():
    from .consumers import ChatConsumer
    return ChatConsumer


websocket_urlpatterns = [
    path('ws/chat/<uuid:conversation_id>/', get_chat_consumer().as_asgi()),
]
