import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from apps.notifications.routing import websocket_urlpatterns as notif_ws
from apps.chat.routing import websocket_urlpatterns as chat_ws

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': URLRouter(notif_ws + chat_ws),
})
