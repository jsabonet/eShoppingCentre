from django.db import models
from apps.core.models import BaseModel
import uuid


class Order(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmada'),
        ('processing', 'Em Processamento'),
        ('shipped', 'Enviada'),
        ('delivered', 'Entregue'),
        ('cancelled', 'Cancelada'),
        ('refunded', 'Reembolsada'),
    ]

    buyer = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='orders')
    store = models.ForeignKey('stores.Store', null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    store_name = models.CharField(max_length=255, blank=True, help_text='Nome da loja no momento do pedido (preservado se loja for eliminada)')
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    affiliate = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='affiliate_orders')
    affiliate_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=50)
    payment_status = models.CharField(max_length=20, default='pending')
    payment_id = models.CharField(max_length=255, blank=True)
    shipping_address = models.JSONField()
    shipping_method = models.CharField(max_length=100, blank=True)
    tracking_code = models.CharField(max_length=100, blank=True)
    estimated_delivery = models.DateField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True, help_text='Data em que o vendedor marcou como enviado')
    confirmed_at = models.DateTimeField(null=True, blank=True, help_text='Data em que o comprador confirmou a receção')
    delivered_at = models.DateTimeField(null=True, blank=True)
    shipping_notes = models.TextField(blank=True, help_text='Descrição de como/quem entregou (ex: "motorista João, tel 84xxx")')
    shipping_evidence = models.ImageField(upload_to='orders/evidence/', blank=True, help_text='Foto do pacote/envio como prova')
    buyer_notes = models.TextField(blank=True)
    seller_notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['buyer', 'status']),
            models.Index(fields=['store', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f'PED-{uuid.uuid4().hex[:8].upper()}'
        if self.store and not self.store_name:
            self.store_name = self.store.name
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class OrderStatusHistory(BaseModel):
    """Regista cada mudança de status de uma encomenda (auditoria)."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    previous_status = models.CharField(max_length=20, choices=Order.STATUS_CHOICES)
    new_status = models.CharField(max_length=20, choices=Order.STATUS_CHOICES)
    changed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='status_changes')
    notes = models.CharField(max_length=500, blank=True, help_text='Motivo/nota da mudança')

    class Meta:
        verbose_name_plural = 'Order status histories'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', '-created_at']),
        ]

    def __str__(self):
        return f'{self.order.order_number}: {self.previous_status} → {self.new_status}'


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, related_name='order_items')
    product_name = models.CharField(max_length=500)
    product_image = models.URLField(blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    variation_data = models.JSONField(default=dict)

    def __str__(self):
        return f'{self.product_name} x{self.quantity}'


class ReturnRequest(BaseModel):
    STATUS_CHOICES = [
        ('requested', 'Solicitada'),
        ('approved', 'Aprovada'),
        ('rejected', 'Rejeitada'),
        ('disputed', 'Em Disputa'),
        ('shipped', 'Devolução Enviada'),
        ('received', 'Recebida'),
        ('refunded', 'Reembolsada'),
    ]
    REASON_CHOICES = [
        ('defective', 'Produto com defeito'),
        ('not_as_described', 'Produto diferente do anunciado'),
        ('not_satisfied', 'Não serviu / Não gostei'),
        ('damaged', 'Embalagem danificada'),
        ('wrong_item', 'Item errado enviado'),
        ('other', 'Outro'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='returns')
    buyer = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='returns')
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='returns')
    reason = models.TextField()
    reason_type = models.CharField(max_length=30, choices=REASON_CHOICES, default='other', help_text='Tipo de motivo da devolução')
    rma_number = models.CharField(max_length=30, unique=True, blank=True, help_text='Número único de autorização (ex: RMA-2026-001)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    vendor_notes = models.TextField(blank=True, help_text='Notas do vendedor (instruções de devolução, etc.)')
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    return_instructions = models.TextField(blank=True, help_text='Instruções de devolução para o comprador (morada, etc.)')
    return_address = models.TextField(blank=True, help_text='Morada para onde o comprador deve enviar a devolução')
    buyer_tracking_code = models.CharField(max_length=100, blank=True, help_text='Código de rastreio ou referência da devolução (opcional)')
    shipping_notes = models.TextField(blank=True, help_text='Descrição de como o comprador enviou a devolução (ex: transportadora, contacto)')
    admin_notes = models.TextField(blank=True, help_text='Notas internas do admin (não visíveis para comprador/vendedor)')
    reviewed_by = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_returns', help_text='Admin que reviu/interveio nesta devolução')
    disputed_at = models.DateTimeField(null=True, blank=True, help_text='Data em que o comprador escalou para o admin')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['buyer', 'status']),
            models.Index(fields=['rma_number']),
            models.Index(fields=['status', 'disputed_at']),
        ]

    def __str__(self):
        return f'{self.rma_number or self.id} - {self.order.order_number}'

    def save(self, *args, **kwargs):
        if not self.rma_number:
            from django.utils import timezone
            year = timezone.now().year
            last = ReturnRequest.objects.filter(
                rma_number__startswith=f'RMA-{year}-'
            ).order_by('-rma_number').first()
            if last:
                try:
                    seq = int(last.rma_number.split('-')[-1]) + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
            self.rma_number = f'RMA-{year}-{seq:04d}'
        super().save(*args, **kwargs)


class ReturnImage(BaseModel):
    """Fotos anexadas a uma devolução como prova visual."""
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='returns/%Y/%m/')
    caption = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Imagem da Devolução'
        verbose_name_plural = 'Imagens das Devoluções'

    def __str__(self):
        return f'Imagem para {self.return_request.rma_number}'
