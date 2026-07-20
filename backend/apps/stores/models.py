from django.db import models
from apps.core.models import BaseModel


class Store(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('active', 'Activa'),
        ('suspended', 'Suspensa'),
        ('closed', 'Fechada'),
    ]

    owner = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='store')
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField()
    about = models.TextField(blank=True)
    logo = models.ImageField(upload_to='stores/logos/', blank=True)
    banner = models.ImageField(upload_to='stores/banners/', blank=True)
    category = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    location = models.CharField(max_length=255)
    website = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_sales = models.PositiveIntegerField(default=0)
    total_products = models.PositiveIntegerField(default=0)
    default_affiliate_commission = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    shipping_policy = models.TextField(blank=True)
    return_policy = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['slug']),
        ]

    def __str__(self):
        return self.name
