from django.db import models
from apps.core.models import BaseModel


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
    body = models.TextField()
    attachment = models.FileField(
        upload_to='chat/%Y/%m/', blank=True,
        help_text='Imagem ou documento (max 10MB)'
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.email}: {self.body[:80]}'
