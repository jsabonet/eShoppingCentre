from django.db import models
from apps.core.models import BaseModel


class DigitalDownload(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE)
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE)
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE)
    download_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['user', 'product', 'order']]


class DownloadAuditLog(BaseModel):
    """Registo de cada download individual — para auditoria e anti-abuso."""
    download = models.ForeignKey(
        DigitalDownload, on_delete=models.CASCADE, related_name='audit_logs'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    file_size_bytes = models.PositiveIntegerField(default=0, help_text='Tamanho do ficheiro em bytes')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['download', '-created_at']),
            models.Index(fields=['ip_address', '-created_at']),
        ]
        verbose_name = 'Registo de Download'
        verbose_name_plural = 'Registos de Downloads'

    def __str__(self):
        return f'{self.download.user.email} → {self.download.product.name} [{self.created_at:%d/%m/%Y %H:%M}]'
