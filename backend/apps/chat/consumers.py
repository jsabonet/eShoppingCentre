import json
import re
from html import escape
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async


def sanitize_message(body):
    clean = re.sub(r'<[^>]*>', '', body)
    clean = escape(clean)
    return clean[:5000]


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer para chat em tempo real."""

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = await self.get_user_from_token()

        if self.user is None or not await self.is_participant():
            await self.close(code=4003)
            return

        # Join room
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive_json(self, content):
        """Recebe mensagem do cliente, guarda na BD e retransmite."""
        body = content.get('body', '').strip()
        body = sanitize_message(body)
        if not body:
            return

        message = await self.save_message(body)
        if message is None:
            return

        # Broadcast to all room participants (including sender)
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'chat_message',
            'message': message,
        })

    async def chat_message(self, event):
        """Envia mensagem para o WebSocket do cliente."""
        await self.send_json(event['message'])

    @database_sync_to_async
    def get_user_from_token(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model
        User = get_user_model()
        token = None
        # Try query string first, then header
        query_string = self.scope.get('query_string', b'').decode()
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = param[6:]
                break

        if not token:
            # Try Authorization header
            headers = dict(self.scope.get('headers', []))
            auth = headers.get(b'authorization', b'').decode()
            if auth.startswith('Bearer '):
                token = auth[7:]

        if not token:
            return None

        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)
        except Exception:
            return None

    @database_sync_to_async
    def is_participant(self):
        from apps.chat.models import Conversation
        try:
            conv = Conversation.objects.get(id=self.conversation_id)
            return self.user in (conv.buyer, conv.seller)
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, body):
        from apps.chat.models import Conversation, Message
        try:
            conv = Conversation.objects.get(id=self.conversation_id)
            msg = Message.objects.create(
                conversation=conv,
                sender=self.user,
                body=body[:5000],
            )
            # Mark others as read
            Message.objects.filter(
                conversation=conv, is_read=False,
            ).exclude(sender=self.user).update(is_read=True)

            email = self.user.email
            return {
                'id': str(msg.id),
                'sender_id': str(self.user.id),
                'sender_name': self.user.first_name or email.split('@')[0],
                'body': msg.body,
                'is_read': True,
                'is_mine': True,
                'created_at': msg.created_at.isoformat(),
            }
        except Conversation.DoesNotExist:
            return None
