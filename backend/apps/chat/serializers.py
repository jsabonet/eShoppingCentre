from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.first_name', read_only=True)
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


class ConversationListSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    buyer_name = serializers.CharField(source='buyer.first_name', read_only=True)
    seller_name = serializers.CharField(source='seller.first_name', read_only=True)
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


class ConversationDetailSerializer(ConversationListSerializer):
    messages = serializers.SerializerMethodField()

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ('messages',)

    def get_messages(self, obj):
        qs = obj.messages.all().order_by('created_at')
        return MessageSerializer(qs, many=True, context=self.context).data
