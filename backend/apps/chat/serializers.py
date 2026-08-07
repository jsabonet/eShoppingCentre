from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_id = serializers.UUIDField(source='sender.id', read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            'id', 'sender_id', 'sender_name', 'body', 'attachment',
            'is_read', 'read_at', 'is_mine', 'created_at',
        )
        read_only_fields = ('is_read', 'read_at')

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return request and request.user == obj.sender

    def get_sender_name(self, obj):
        name = obj.sender.first_name
        if name:
            return name
        email = obj.sender.email
        return email.split('@')[0] if '@' in email else email


class ConversationListSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    buyer_name = serializers.SerializerMethodField()
    seller_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source='product.name', read_only=True, allow_null=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True, allow_null=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            'id', 'subject', 'store_name', 'store_slug', 'buyer_name',
            'seller_name', 'product_name', 'product_slug', 'order_id',
            'last_message', 'unread_count', 'is_archived_by_buyer',
            'is_archived_by_seller', 'last_message_at', 'created_at',
        )

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return {
                'body': last.body[:200],
                'sender_name': last.sender.first_name,
                'created_at': last.created_at.isoformat(),
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()

    def get_buyer_name(self, obj):
        name = obj.buyer.first_name
        if name:
            return name
        email = obj.buyer.email
        return email.split('@')[0] if '@' in email else email

    def get_seller_name(self, obj):
        name = obj.seller.first_name
        if name:
            return name
        email = obj.seller.email
        return email.split('@')[0] if '@' in email else email


class ConversationDetailSerializer(ConversationListSerializer):
    messages = serializers.SerializerMethodField()

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ('messages',)

    def get_messages(self, obj):
        qs = obj.messages.filter(is_deleted=False).order_by('created_at')
        return MessageSerializer(qs, many=True, context=self.context).data
