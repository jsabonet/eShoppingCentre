from django.db import models
from apps.core.models import BaseModel
from apps.core.fields import EncryptedTextField


class Conversation(BaseModel):
    buyer = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='conversations_as_buyer'
    )
    seller = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='conversations_as_seller'
    )
    store = models.ForeignKey(
        'stores.Store', on_delete=models.CASCADE, related_name='conversations'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.SET_NULL, null=True, blank=True
    )
    order = models.ForeignKey(
        'orders.Order', on_delete=models.SET_NULL, null=True, blank=True
    )
    subject = models.CharField(max_length=500)
    last_message_at = models.DateTimeField(auto_now=True)
    is_archived_by_buyer = models.BooleanField(default=False)
    is_archived_by_seller = models.BooleanField(default=False)

    class Meta:
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['buyer', 'is_archived_by_buyer']),
            models.Index(fields=['seller', 'is_archived_by_seller']),
        ]

    def __str__(self):
        return f'{self.buyer.email} ↔ {self.seller.email}: {self.subject[:60]}'


class Message(BaseModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages'
    )
    sender = models.ForeignKey('users.User', on_delete=models.CASCADE)
    body = EncryptedTextField()  # AES-encrypted at rest
    attachment = models.FileField(
        upload_to='chat/%Y/%m/', blank=True,
        help_text='Imagem ou documento (max 10MB)'
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    # Security
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deleted_messages',
    )

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        preview = self.body[:80] if self.body else ''
        return f'{self.sender.email}: {preview}'

    def soft_delete(self, user):
        self.is_deleted = True
        self.deleted_at = models.DateTimeField.now()
        self.deleted_by = user
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])


class ConversationAccessLog(BaseModel):
    """Registo de quem acedeu a cada conversa e quando."""
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='access_logs'
    )
    user = models.ForeignKey('users.User', on_delete=models.CASCADE)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} acedeu a {self.conversation_id} em {self.created_at}'
