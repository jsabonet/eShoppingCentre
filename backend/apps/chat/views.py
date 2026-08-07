from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from .models import Conversation, Message
from .serializers import (
    ConversationListSerializer, ConversationDetailSerializer, MessageSerializer,
)


class ConversationListView(generics.ListCreateAPIView):
    """GET /api/v1/chat/ — Lista conversas do utilizador. POST — inicia nova."""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ConversationDetailSerializer
        return ConversationListSerializer

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(buyer=user, is_archived_by_buyer=False) |
            Q(seller=user, is_archived_by_seller=False)
        ).select_related('store', 'buyer', 'seller', 'product')

    def perform_create(self, serializer):
        store_id = self.request.data.get('store_id')
        from apps.stores.models import Store
        store = get_object_or_404(Store, id=store_id)

        # Prevent buyer from messaging themselves
        if store.owner == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Nao pode enviar mensagens para a sua propria loja.')

        product_id = self.request.data.get('product_id')
        order_id = self.request.data.get('order_id')
        product = None
        order = None

        if product_id:
            from apps.products.models import Product
            product = get_object_or_404(Product, id=product_id, store=store)

        if order_id:
            from apps.orders.models import Order
            order = get_object_or_404(
                Order, id=order_id,
                buyer=self.request.user, store=store,
            )

        subject = self.request.data.get('subject', f'Duvida sobre {product.name}' if product else 'Contacto')

        serializer.save(
            buyer=self.request.user,
            seller=store.owner,
            store=store,
            product=product,
            order=order,
            subject=subject[:500],
        )

        # Auto-create first message if body provided
        body = self.request.data.get('body', '').strip()
        if body:
            serializer.instance.messages.create(
                sender=self.request.user,
                body=body,
            )


class ConversationDetailView(generics.RetrieveAPIView):
    """GET /api/v1/chat/{id}/ — Detalhe da conversa + mensagens."""
    serializer_class = ConversationDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(buyer=user) | Q(seller=user)
        ).select_related('store', 'buyer', 'seller', 'product').prefetch_related('messages')

    def retrieve(self, request, *args, **kwargs):
        conversation = self.get_object()

        # Mark unread messages as read (only those NOT sent by current user)
        conversation.messages.filter(is_read=False).exclude(
            sender=request.user
        ).update(is_read=True, read_at=timezone.now())

        return super().retrieve(request, *args, **kwargs)


class MessageCreateView(generics.CreateAPIView):
    """POST /api/v1/chat/{conversation_id}/messages/ — Envia mensagem."""
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        conversation = get_object_or_404(
            Conversation,
            id=self.kwargs['conversation_id'],
        )
        user = self.request.user

        if user != conversation.buyer and user != conversation.seller:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao pertence a esta conversa.')

        serializer.save(conversation=conversation, sender=user)


class ConversationArchiveView(APIView):
    """PATCH /api/v1/chat/{id}/archive/ ou /unarchive/"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, conversation_id):
        conversation = get_object_or_404(
            Conversation,
            id=conversation_id,
        )
        user = request.user
        archive = 'unarchive' not in request.path

        if user == conversation.buyer:
            conversation.is_archived_by_buyer = archive
        elif user == conversation.seller:
            conversation.is_archived_by_seller = archive
        else:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao pertence a esta conversa.')

        conversation.save()
        return Response({'archived': archive})


class UnreadCountView(APIView):
    """GET /api/v1/chat/unread-count/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        count = Message.objects.filter(
            is_read=False,
            conversation__buyer=user,
            conversation__is_archived_by_buyer=False,
        ).exclude(sender=user).count()
        count += Message.objects.filter(
            is_read=False,
            conversation__seller=user,
            conversation__is_archived_by_seller=False,
        ).exclude(sender=user).count()
        return Response({'unread_count': count})


# ─── Admin ───

class AdminConversationListView(generics.ListAPIView):
    """GET /api/v1/admin/chat/ — Admin ve todas as conversas."""
    serializer_class = ConversationListSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return Conversation.objects.select_related(
            'store', 'buyer', 'seller', 'product',
        ).order_by('-last_message_at')


class AdminConversationDetailView(generics.RetrieveAPIView):
    """GET /api/v1/admin/chat/{id}/ — Admin ve detalhe de conversa (read-only)."""
    serializer_class = ConversationDetailSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return Conversation.objects.select_related(
            'store', 'buyer', 'seller', 'product',
        ).prefetch_related('messages')
