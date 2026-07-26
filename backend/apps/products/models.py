from django.db import models
from apps.core.models import BaseModel


class Category(BaseModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
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

    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default='physical')
    name = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500)
    description = models.TextField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    stock = models.PositiveIntegerField(default=0)
    sku = models.CharField(max_length=100, blank=True)
    is_featured = models.BooleanField(default=False)
    is_on_sale = models.BooleanField(default=False)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    review_count = models.PositiveIntegerField(default=0)
    sales_count = models.PositiveIntegerField(default=0)
    affiliate_commission = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    tags = models.JSONField(default=list)
    specifications = models.JSONField(default=dict)
    digital_file = models.FileField(upload_to='products/digital/', blank=True)
    digital_file_size = models.CharField(max_length=50, blank=True)
    download_limit = models.PositiveIntegerField(default=3)
    download_expiry_days = models.PositiveIntegerField(default=365)

    class Meta:
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status', 'product_type']),
            models.Index(fields=['store', 'status']),
        ]
        unique_together = [['store', 'slug']]

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
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='coupons')
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
