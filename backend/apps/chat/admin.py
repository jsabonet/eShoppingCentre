from django.contrib import admin
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('subject', 'buyer', 'seller', 'store', 'last_message_at', 'is_archived_by_buyer', 'is_archived_by_seller')
    list_filter = ('store',)
    search_fields = ('subject', 'buyer__email', 'seller__email')
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'sender', 'body_preview', 'is_read', 'created_at')
    list_filter = ('is_read',)

    @admin.display(description='Mensagem')
    def body_preview(self, obj):
        return obj.body[:100]
