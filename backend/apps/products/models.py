from django.db import models
from apps.core.models import BaseModel
from .storage import get_digital_file_storage


class Category(BaseModel):
    PRODUCT_TYPE_CHOICES = [
        ('physical', 'Produtos Físicos'),
        ('digital', 'Produtos Digitais'),
        ('course', 'Cursos'),
    ]
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default='physical',
                                    help_text='Filtrar categorias por tipo de produto')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Product(BaseModel):
    PRODUCT_TYPE_CHOICES = [
        ('physical', 'Produto Físico'),
        ('digital', 'Produto Digital'),
        ('course', 'Curso Online'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Rascunho'),
        ('active', 'Activo'),
        ('inactive', 'Inactivo'),
        ('deleted', 'Removido'),
    ]
    CONDITION_CHOICES = [
        ('new', 'Novo'),
        ('used', 'Usado'),
        ('refurbished', 'Recondicionado'),
    ]

    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default='physical')
    name = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, blank=True)
    description = models.TextField()
    short_description = models.CharField(max_length=300, blank=True, help_text='Descrição curta para cards/listagens')
    price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    stock = models.PositiveIntegerField(default=0)
    sku = models.CharField(max_length=100, blank=True)
    # ─── Novos campos físicos ───
    barcode = models.CharField(max_length=50, blank=True, help_text='GTIN, EAN, UPC ou ISBN')
    brand = models.CharField(max_length=255, blank=True, help_text='Marca ou fabricante')
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='new')
    weight = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, help_text='Peso em kg')
    height = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True, help_text='Altura em cm')
    width = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True, help_text='Largura em cm')
    length = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True, help_text='Comprimento em cm')
    allow_backorder = models.BooleanField(default=False, help_text='Permitir venda sem stock')
    min_order_quantity = models.PositiveIntegerField(default=1, help_text='Quantidade mínima por encomenda')
    # ─── SEO ───
    meta_title = models.CharField(max_length=200, blank=True, help_text='Título SEO (usa nome se vazio)')
    meta_description = models.TextField(max_length=320, blank=True, help_text='Descrição SEO (usa descrição se vazio)')
    # ─── Media extra ───
    video_url = models.URLField(blank=True, help_text='YouTube ou Vimeo')
    warranty_days = models.PositiveIntegerField(default=0, help_text='Dias de garantia (0 = sem garantia)')
    # ─── Campos existentes ───
    is_featured = models.BooleanField(default=False)
    is_on_sale = models.BooleanField(default=False)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    review_count = models.PositiveIntegerField(default=0)
    sales_count = models.PositiveIntegerField(default=0)
    affiliate_commission = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    affiliate_enabled = models.BooleanField(default=True, help_text='Produto disponível para o programa de afiliados')
    affiliate_cookie_days = models.PositiveIntegerField(null=True, blank=True, help_text='Janela de cookie específica (dias). Vazio = usa a global.')
    affiliate_terms = models.TextField(blank=True, help_text='Termos adicionais de afiliação definidos pelo vendedor')
    tags = models.JSONField(default=list)
    specifications = models.JSONField(default=dict)
    digital_file = models.FileField(upload_to='products/digital/', blank=True,
                                     storage=get_digital_file_storage)
    digital_file_size = models.CharField(max_length=50, blank=True)
    digital_format = models.CharField(max_length=20, blank=True, help_text='Formato: PDF, ZIP, MP3, MP4, etc.')
    digital_version = models.CharField(max_length=50, blank=True, help_text='Versão do produto digital (ex: v1.0)')
    digital_license = models.CharField(max_length=20, default='personal',
                                       choices=[('personal', 'Pessoal'), ('commercial', 'Comercial'), ('extended', 'Extended')],
                                       help_text='Tipo de licença')
    digital_compatibility = models.CharField(max_length=300, blank=True, help_text='Requisitos de sistema/software')
    download_limit = models.PositiveIntegerField(default=3)
    download_expiry_days = models.PositiveIntegerField(default=365)

    class Meta:
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status', 'product_type']),
            models.Index(fields=['store', 'status']),
        ]
        unique_together = [['store', 'slug']]

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        # Auto-calculate digital file size
        if self.digital_file and (not self.digital_file_size or self._state.adding):
            try:
                size_bytes = self.digital_file.size
                if size_bytes >= 1024 * 1024:
                    self.digital_file_size = f'{size_bytes / (1024 * 1024):.1f} MB'
                elif size_bytes >= 1024:
                    self.digital_file_size = f'{size_bytes / 1024:.1f} KB'
                else:
                    self.digital_file_size = f'{size_bytes} bytes'
            except Exception:
                pass
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductImage(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/images/')
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']


class ProductVariant(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=255, help_text='Ex: "Azul / M" ou "Vermelho"')
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                help_text='Preço específico da variante. Se vazio, usa o preço base do produto.')
    stock = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to='products/variants/', blank=True)
    attributes = models.JSONField(default=dict, help_text='{"Cor": "Azul", "Tamanho": "M"}')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['product', 'is_active']),
            models.Index(fields=['sku']),
        ]
        unique_together = [['product', 'sku']]

    def __str__(self):
        return f'{self.product.name} - {self.name}'

    @property
    def effective_price(self):
        return self.price if self.price is not None else self.product.price


class ProductVariation(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variations')
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, blank=True)
    price_modifier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.product.name} - {self.name}'


class StockLog(BaseModel):
    """Regista cada alteração de stock de um produto (auditoria de inventário)."""
    TYPE_CHOICES = [
        ('sale', 'Venda'),
        ('restock', 'Reposição'),
        ('cancel', 'Cancelamento'),
        ('return', 'Devolução'),
        ('adjustment', 'Ajuste Manual'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_logs')
    change_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.IntegerField(help_text='Positivo = entrada, Negativo = saída')
    stock_before = models.PositiveIntegerField()
    stock_after = models.PositiveIntegerField()
    reference = models.CharField(max_length=255, blank=True, help_text='Ex: Order #PED-123, Ajuste manual')
    changed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='stock_changes')
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product', '-created_at']),
            models.Index(fields=['change_type']),
        ]

    def __str__(self):
        return f'{self.product.name}: {self.get_change_type_display()} ({self.quantity:+d})'


class WishlistItem(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='wishlist')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'product']]

    def __str__(self):
        return f'{self.user.email} - {self.product.name}'


class Coupon(BaseModel):
    DISCOUNT_TYPE_CHOICES = [
        ('percentage', 'Percentagem (%)'),
        ('fixed', 'Valor Fixo (MZN)'),
    ]
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='coupons', null=True, blank=True,
                              help_text='Loja dona do cupão. Null = cupão global da plataforma')
    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    min_purchase = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(default=0, help_text='0 = ilimitado')
    used_count = models.PositiveIntegerField(default=0)
    max_per_user = models.PositiveIntegerField(default=1)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True,
                                help_text='Restringir a um produto específico')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True,
                                 help_text='Restringir a uma categoria')

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['code']), models.Index(fields=['store', 'is_active'])]

    def __str__(self):
        return self.code

    @property
    def is_valid(self):
        from django.utils import timezone
        now = timezone.now()
        return (self.is_active and self.starts_at <= now <= self.ends_at and
                (self.max_uses == 0 or self.used_count < self.max_uses))


class CouponUsage(BaseModel):
    """Regista cada utilização de um cupão (para impor max_per_user e auditoria)."""
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='coupon_usages')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupon_usages')
    discount_applied = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['coupon', 'user']),
        ]

    def __str__(self):
        return f'{self.coupon.code} — {self.user.email}'

# Ensure DigitalDownload is registered with Django
from .models_digital import DigitalDownload  # noqa
