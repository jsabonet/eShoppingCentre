# 🖥️ Plano de Desenvolvimento do Backend — eShoppingCentre

## Marketplace Híbrido Multi-Vendedor com Afiliados + E-Learning

---

## ÍNDICE

1. [Arquitectura e Stack Tecnológica](#1-arquitectura-e-stack-tecnológica)
2. [Estrutura do Projecto](#2-estrutura-do-projecto)
3. [Modelo de Dados Completo](#3-modelo-de-dados-completo)
4. [API Endpoints (REST)](#4-api-endpoints-rest)
5. [Fase 1: Setup e Fundação](#5-fase-1-setup-e-fundação)
6. [Fase 2: Autenticação e Utilizadores](#6-fase-2-autenticação-e-utilizadores)
7. [Fase 3: Produtos e Catálogo](#7-fase-3-produtos-e-catálogo)
8. [Fase 4: Multi-Vendor — Lojas](#8-fase-4-multi-vendor--lojas)
9. [Fase 5: Carrinho e Checkout](#9-fase-5-carrinho-e-checkout)
10. [Fase 6: Pagamentos (M-Pesa, e-Mola, Stripe)](#10-fase-6-pagamentos-m-pesa-e-mola-stripe)
11. [Fase 7: Sistema de Afiliados](#11-fase-7-sistema-de-afiliados)
12. [Fase 8: Produtos Digitais e Cursos](#12-fase-8-produtos-digitais-e-cursos)
13. [Fase 9: Carteira Virtual e Financeiro](#13-fase-9-carteira-virtual-e-financeiro)
14. [Fase 10: Notificações, Email e WebSockets](#14-fase-10-notificações-email-e-websockets)
15. [Fase 11: Admin Dashboard Backend](#15-fase-11-admin-dashboard-backend)
16. [Fase 12: Segurança, Performance e Deploy](#16-fase-12-segurança-performance-e-deploy)
17. [Cronograma e Marcos](#17-cronograma-e-marcos)

---

## 1. ARQUITECTURA E STACK TECNOLÓGICA

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENTE                                │
│  Next.js 15 (Frontend) · React Native (Mobile futuro)    │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS / REST API
┌──────────────────────▼───────────────────────────────────┐
│                 BACKEND (Django 5 + DRF)                  │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Auth     │ │ Products │ │ Stores   │ │ Orders     │ │
│  │ (JWT)    │ │ Catalog  │ │ (Vendors)│ │ Checkout   │ │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────┤ │
│  │ Payments │ │ Affiliate│ │ Wallet   │ │ Courses    │ │
│  │ M-Pesa   │ │ System   │ │ Finance  │ │ E-Learning │ │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────┤ │
│  │ Search   │ │ Reviews  │ │ Shipping │ │ Analytics  │ │
│  │ (pgvector)│ │ Ratings  │ │ Tracking │ │ Reports    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│                    SERVIÇOS                               │
│  PostgreSQL 16 · Redis · Celery · AWS S3 / Cloudflare R2 │
│  SendGrid/Mailgun · Vimeo/Bunny.net · Stripe             │
└──────────────────────────────────────────────────────────┘
```

### Stack Completa

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Linguagem** | Python | 3.12+ |
| **Framework** | Django | 5.1+ |
| **API** | Django REST Framework | 3.15+ |
| **Autenticação** | Simple JWT + OAuth2 | - |
| **Base de Dados** | PostgreSQL | 16 |
| **Cache** | Redis | 7+ |
| **Filas/Tarefas** | Celery + Redis | 5.4+ |
| **Armazenamento** | AWS S3 / Cloudflare R2 | - |
| **Email** | SendGrid / Mailgun | - |
| **Pesquisa** | pgvector + Django Full-Text Search | - |
| **WebSockets** | Django Channels + Redis | 4+ |
| **Documentação API** | drf-spectacular (Swagger) | - |
| **Testes** | pytest + pytest-django | - |
| **CI/CD** | GitHub Actions | - |
| **Deploy** | Docker + Railway / Render / VPS | - |

---

## 2. ESTRUTURA DO PROJECT

```
backend/
├── manage.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── pyproject.toml
│
├── config/                          # Configuração Django
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py                  # Configurações base
│   │   ├── development.py           # Dev (SQLite/Postgres local)
│   │   └── production.py            # Produção
│   ├── urls.py                      # URL raiz
│   ├── wsgi.py
│   └── asgi.py                      # WebSockets
│
├── apps/                            # Aplicações Django
│   ├── users/                       # Utilizadores e Autenticação
│   │   ├── models.py                # User, UserProfile
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── tests/
│   │
│   ├── stores/                      # Lojas (Multi-Vendor)
│   │   ├── models.py                # Store, StoreSettings
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── permissions.py           # IsStoreOwner, etc.
│   │
│   ├── products/                    # Produtos e Catálogo
│   │   ├── models.py                # Product, Category, ProductImage,
│   │   │                            # ProductVariation, DigitalProduct
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── filters.py               # django-filter
│   │   └── search.py                # Full-text search
│   │
│   ├── orders/                      # Encomendas e Checkout
│   │   ├── models.py                # Order, OrderItem, Shipping
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── signals.py               # Atualizar stock após venda
│   │
│   ├── payments/                    # Pagamentos
│   │   ├── models.py                # Transaction, PaymentMethod
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── mpesa.py             # Integração M-Pesa
│   │   │   ├── emola.py             # Integração e-Mola
│   │   │   └── stripe.py            # Integração Stripe
│   │   ├── views.py                 # Webhooks de pagamento
│   │   └── urls.py
│   │
│   ├── affiliates/                  # Sistema de Afiliados
│   │   ├── models.py                # AffiliateLink, AffiliateCommission
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── middleware.py            # Rastrear cliques de afiliados
│   │
│   ├── wallet/                      # Carteira Virtual
│   │   ├── models.py                # Wallet, Transaction
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── services.py              # Cálculo de comissões
│   │
│   ├── courses/                     # E-Learning
│   │   ├── models.py                # Course, Module, Lesson, Enrollment,
│   │   │                            # LessonProgress, Certificate
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── permissions.py           # IsEnrolled
│   │
│   ├── reviews/                     # Avaliações
│   │   ├── models.py                # Review, Rating
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── blog/                        # Blog
│   │   ├── models.py                # Post, Category
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── notifications/               # Notificações
│   │   ├── models.py                # Notification
│   │   ├── consumers.py             # WebSocket consumers
│   │   ├── routing.py
│   │   └── tasks.py                 # Celery tasks (email, SMS)
│   │
│   └── core/                        # Utilitários partilhados
│       ├── models.py                # BaseModel (UUID, timestamps)
│       ├── pagination.py            # CustomPagination
│       ├── permissions.py           # Base permissions
│       ├── utils.py                 # Funções auxiliares
│       └── throttling.py            # Rate limiting
│
├── media/                           # Uploads (dev apenas)
└── static/                          # Static files (dev apenas)
```

---

## 3. MODELO DE DADOS COMPLETO

### 3.1 Users (apps/users/models.py)

```python
from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.core.models import BaseModel

class User(AbstractUser):
    """Utilizador base com múltiplos papéis"""
    ROLE_CHOICES = [
        ('buyer', 'Comprador'),
        ('seller', 'Vendedor'),
        ('affiliate', 'Afiliado'),
        ('admin', 'Administrador'),
    ]
    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    roles = models.JSONField(default=list)  # ['buyer', 'seller', 'affiliate']
    is_verified = models.BooleanField(default=False)
    date_of_birth = models.DateField(null=True, blank=True)
    bio = models.TextField(blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

class UserProfile(BaseModel):
    """Perfil estendido do utilizador"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    document_type = models.CharField(max_length=20, blank=True)  # BI, Passaporte, NUIT
    document_number = models.CharField(max_length=50, blank=True)
    document_file = models.FileField(upload_to='documents/', blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    notification_preferences = models.JSONField(default=dict)

class Address(BaseModel):
    """Endereços de entrega do utilizador"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50)  # Casa, Trabalho, etc.
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
```

### 3.2 Stores (apps/stores/models.py)

```python
class Store(BaseModel):
    """Loja de um vendedor"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('active', 'Activa'),
        ('suspended', 'Suspensa'),
        ('closed', 'Fechada'),
    ]

    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='store')
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

    # Configurações
    default_affiliate_commission = models.DecimalField(
        max_digits=5, decimal_places=2, default=10.00
    )  # 10% padrão
    shipping_policy = models.TextField(blank=True)
    return_policy = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['slug']),
        ]
```

### 3.3 Products (apps/products/models.py)

```python
class Category(BaseModel):
    """Categoria de produtos"""
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True)
    parent = models.ForeignKey('self', null=True, blank=True,
                                on_delete=models.SET_NULL, related_name='children')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['sort_order', 'name']

class Product(BaseModel):
    """Produto (físico ou digital)"""
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

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL,
                                  null=True, related_name='products')
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES,
                                     default='physical')
    name = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500)
    description = models.TextField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_price = models.DecimalField(max_digits=12, decimal_places=2,
                                         null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    stock = models.PositiveIntegerField(default=0)  # NULL para digitais
    sku = models.CharField(max_length=100, blank=True)
    is_featured = models.BooleanField(default=False)
    is_on_sale = models.BooleanField(default=False)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    review_count = models.PositiveIntegerField(default=0)
    sales_count = models.PositiveIntegerField(default=0)
    affiliate_commission = models.DecimalField(
        max_digits=5, decimal_places=2, default=10.00
    )  # Comissão para afiliados (%)

    # Metadados
    tags = models.JSONField(default=list)  # ['smartphone', 'android', '5g']
    specifications = models.JSONField(default=dict)  # {'cor': 'Preto', 'peso': '200g'}

    # Campos para produtos digitais
    digital_file = models.FileField(upload_to='products/digital/', blank=True)
    digital_file_size = models.CharField(max_length=50, blank=True)  # '12.5 MB'
    download_limit = models.PositiveIntegerField(default=3)  # Máx descarregamentos
    download_expiry_days = models.PositiveIntegerField(default=365)

    class Meta:
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status', 'product_type']),
            models.Index(fields=['store', 'status']),
        ]
        unique_together = [['store', 'slug']]

class ProductImage(BaseModel):
    """Imagens do produto (múltiplas por produto)"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/images/')
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

class ProductVariation(BaseModel):
    """Variações do produto (tamanho, cor, etc.)"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variations')
    name = models.CharField(max_length=255)  # '32GB', 'Vermelho'
    sku = models.CharField(max_length=100, blank=True)
    price_modifier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

class WishlistItem(BaseModel):
    """Item da lista de desejos"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wishlist')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
```

### 3.4 Orders (apps/orders/models.py)

```python
class Order(BaseModel):
    """Encomenda"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('confirmed', 'Confirmada'),
        ('processing', 'Em Processamento'),
        ('shipped', 'Enviada'),
        ('delivered', 'Entregue'),
        ('cancelled', 'Cancelada'),
        ('refunded', 'Reembolsada'),
    ]

    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Valores
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    # Afiliado (se aplicável)
    affiliate = models.ForeignKey(User, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='affiliate_orders')
    affiliate_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Pagamento
    payment_method = models.CharField(max_length=50)
    payment_status = models.CharField(max_length=20, default='pending')
    payment_id = models.CharField(max_length=255, blank=True)

    # Envio
    shipping_address = models.JSONField()
    shipping_method = models.CharField(max_length=100, blank=True)
    tracking_code = models.CharField(max_length=100, blank=True)
    estimated_delivery = models.DateField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    # Notas
    buyer_notes = models.TextField(blank=True)
    seller_notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['buyer', 'status']),
            models.Index(fields=['store', 'status']),
        ]

class OrderItem(BaseModel):
    """Item da encomenda"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL,
                                 null=True, related_name='order_items')
    product_name = models.CharField(max_length=500)
    product_image = models.URLField(blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    variation_data = models.JSONField(default=dict)
```

### 3.5 Payments (apps/payments/models.py)

```python
class PaymentTransaction(BaseModel):
    """Transação de pagamento"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('processing', 'Em Processamento'),
        ('completed', 'Concluída'),
        ('failed', 'Falhou'),
        ('refunded', 'Reembolsada'),
    ]
    PROVIDER_CHOICES = [
        ('mpesa', 'M-Pesa'),
        ('emola', 'e-Mola'),
        ('stripe', 'Stripe'),
        ('paypal', 'PayPal'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='transactions')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_transaction_id = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='MZN')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    provider_response = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
```

### 3.6 Affiliates (apps/affiliates/models.py)

```python
class AffiliateProfile(BaseModel):
    """Perfil de afiliado"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='affiliate_profile')
    referral_code = models.CharField(max_length=50, unique=True)
    total_clicks = models.PositiveIntegerField(default=0)
    total_sales = models.PositiveIntegerField(default=0)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

class AffiliateLink(BaseModel):
    """Link de afiliado para um produto"""
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE,
                                   related_name='links')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='affiliate_links')
    code = models.CharField(max_length=50, unique=True)
    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)

class AffiliateClick(BaseModel):
    """Registo de clique de afiliado"""
    link = models.ForeignKey(AffiliateLink, on_delete=models.CASCADE, related_name='click_events')
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    referrer = models.URLField(blank=True)
    converted = models.BooleanField(default=False)

class AffiliateCommission(BaseModel):
    """Comissão gerada por uma venda de afiliado"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('approved', 'Aprovada'),
        ('paid', 'Paga'),
        ('rejected', 'Rejeitada'),
    ]

    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE,
                                   related_name='commissions')
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

class AffiliatePayout(BaseModel):
    """Saque de comissões pelo afiliado"""
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('processing', 'Em Processamento'),
        ('completed', 'Concluído'),
        ('failed', 'Falhou'),
    ]

    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE,
                                   related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=50)  # mpesa, emola, bank
    account_details = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
```

### 3.7 Wallet (apps/wallet/models.py)

```python
class Wallet(BaseModel):
    """Carteira virtual do utilizador"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_withdrawn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

class WalletTransaction(BaseModel):
    """Transação na carteira"""
    TYPE_CHOICES = [
        ('sale', 'Venda'),
        ('commission', 'Comissão'),
        ('affiliate_commission', 'Comissão Afiliado'),
        ('withdrawal', 'Saque'),
        ('fee', 'Taxa Plataforma'),
        ('refund', 'Reembolso'),
        ('bonus', 'Bónus'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('completed', 'Concluída'),
        ('failed', 'Falhou'),
    ]

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference_type = models.CharField(max_length=50)  # order, commission, payout
    reference_id = models.UUIDField()
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

class SellerPayout(BaseModel):
    """Saque do vendedor"""
    STATUS_CHOICES = [('pending', 'Pendente'), ('completed', 'Concluído')]
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=50)
    account_details = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
```

### 3.8 Courses (apps/courses/models.py)

```python
class Course(BaseModel):
    """Curso online"""
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='course')
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses_teaching')
    level = models.CharField(max_length=50, default='beginner')
    duration = models.CharField(max_length=50)  # '20 horas'
    total_lessons = models.PositiveIntegerField(default=0)
    certificate_enabled = models.BooleanField(default=True)
    preview_video_url = models.URLField(blank=True)

class CourseModule(BaseModel):
    """Módulo do curso"""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

class CourseLesson(BaseModel):
    """Aula individual"""
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    video_url = models.URLField()
    video_provider = models.CharField(max_length=50, default='vimeo')  # vimeo, youtube, bunny
    duration = models.CharField(max_length=20)  # '15:30'
    content = models.TextField(blank=True)  # Markdown/HTML adicional
    is_free_preview = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

class Enrollment(BaseModel):
    """Matrícula do aluno no curso"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True)
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    certificate_url = models.URLField(blank=True)

class LessonProgress(BaseModel):
    """Progresso do aluno em cada aula"""
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='lesson_progress')
    lesson = models.ForeignKey(CourseLesson, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    watched_duration = models.PositiveIntegerField(default=0)  # segundos
```

### 3.9 Reviews (apps/reviews/models.py)

```python
class Review(BaseModel):
    """Avaliação de produto"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True)
    rating = models.PositiveSmallIntegerField()  # 1-5
    title = models.CharField(max_length=255, blank=True)
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    helpful_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [['user', 'product']]
```

---

## 4. API ENDPOINTS (REST)

### Estrutura de URLs

```
/api/v1/

├── auth/
│   ├── POST   register/               # Registo
│   ├── POST   login/                  # Login (JWT)
│   ├── POST   token/refresh/          # Refresh token
│   ├── POST   token/verify/           # Verify token
│   ├── POST   password/reset/         # Solicitar reset
│   └── POST   password/reset/confirm/ # Confirmar reset
│
├── users/
│   ├── GET    me/                     # Perfil próprio
│   ├── PATCH  me/                     # Actualizar perfil
│   ├── GET    me/orders/              # Minhas encomendas
│   ├── GET    me/downloads/           # Meus downloads
│   ├── GET    me/addresses/           # Meus endereços
│   ├── POST   me/addresses/           # Adicionar endereço
│   └── GET    me/wishlist/            # Lista de desejos
│
├── stores/
│   ├── GET    /                       # Lista lojas
│   ├── GET    /{slug}/               # Detalhe loja
│   ├── POST   register/              # Registar loja
│   ├── GET/PATCH me/                  # Minha loja
│   ├── GET    me/stats/              # Stats da loja
│   └── GET    me/earnings/           # Ganhos da loja
│
├── products/
│   ├── GET    /                       # Lista produtos (com filtros)
│   ├── GET    /{slug}/               # Detalhe produto
│   ├── POST   /                       # Criar produto [seller]
│   ├── PATCH  /{id}/                 # Editar produto [owner]
│   ├── DELETE /{id}/                 # Remover produto [owner]
│   ├── POST   /{id}/images/          # Upload imagem
│   └── GET    /search/               # Pesquisa
│
├── categories/
│   ├── GET    /                       # Lista categorias
│   └── GET    /{slug}/               # Detalhe categoria
│
├── orders/
│   ├── POST   /                       # Criar encomenda
│   ├── GET    /{id}/                 # Detalhe encomenda
│   ├── PATCH  /{id}/                 # Actualizar status [seller]
│   └── POST   /{id}/cancel/          # Cancelar [buyer]
│
├── affiliates/
│   ├── POST   register/              # Registar como afiliado
│   ├── GET    me/                     # Meu perfil afiliado
│   ├── GET    me/stats/              # Estatísticas
│   ├── POST   links/                 # Gerar link
│   ├── GET    me/links/              # Meus links
│   ├── GET    me/commissions/        # Minhas comissões
│   └── POST   me/payouts/            # Solicitar saque
│
├── courses/
│   ├── GET    /                       # Lista cursos
│   ├── GET    /{slug}/               # Detalhe curso
│   ├── GET    me/enrollments/        # Meus cursos
│   ├── GET    me/enrollments/{id}/   # Progresso
│   ├── PATCH  me/lessons/{id}/       # Marcar aula concluída
│   └── GET    me/certificates/       # Certificados
│
├── reviews/
│   ├── POST   /                       # Criar avaliação
│   ├── GET    /?product={id}          # Avaliações de produto
│   └── PATCH  /{id}/                 # Editar avaliação
│
├── wallet/
│   ├── GET    me/                     # Saldo
│   ├── GET    me/transactions/       # Histórico
│   └── POST   me/payouts/            # Solicitar saque
│
├── blog/
│   ├── GET    /                       # Posts
│   └── GET    /{slug}/               # Detalhe post
│
└── admin/                            # Endpoints admin (is_staff)
    ├── GET    stats/                 # Estatísticas globais
    ├── GET    stores/pending/        # Lojas pendentes
    ├── PATCH  stores/{id}/approve/   # Aprovar loja
    ├── GET    payouts/pending/       # Saques pendentes
    └── PATCH  payouts/{id}/approve/  # Aprovar saque
```

---

## 5. FASE 1: SETUP E FUNDAÇÃO

### Passo 1.1 — Criar o Projecto Django

```bash
# 1. Criar ambiente virtual
mkdir backend && cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 2. Instalar Django e DRF
pip install django djangorestframework django-cors-headers python-decouple

# 3. Criar projecto
django-admin startproject config .

# 4. Criar apps base
python manage.py startapp core apps/core
python manage.py startapp users apps/users
```

### Passo 1.2 — Configurar `requirements.txt`

```
Django>=5.1,<5.2
djangorestframework>=3.15,<3.16
django-cors-headers>=4.5
django-filter>=24.0
djangorestframework-simplejwt>=5.4
django-storages>=1.14
drf-spectacular>=0.28
python-decouple>=3.8
psycopg2-binary>=2.9
celery>=5.4
redis>=5.2
channels>=4.1
daphne>=4.1
Pillow>=11.0
boto3>=1.35
stripe>=10.0
requests>=2.32
gunicorn>=23.0
pytest>=8.3
pytest-django>=4.9
factory-boy>=3.3
faker>=30.0
```

### Passo 1.3 — `docker-compose.yml`

```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: eshoppingcentre
      POSTGRES_USER: eshopping
      POSTGRES_PASSWORD: eshopping123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    env_file:
      - .env

  celery:
    build: .
    command: celery -A config worker -l info
    volumes:
      - .:/app
    depends_on:
      - db
      - redis
    env_file:
      - .env

volumes:
  postgres_data:
```

### Passo 1.4 — Configurar `config/settings/base.py`

```python
import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY', default='dev-secret-key-change-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'channels',
    # Apps
    'apps.core',
    'apps.users',
    'apps.stores',
    'apps.products',
    'apps.orders',
    'apps.payments',
    'apps.affiliates',
    'apps.wallet',
    'apps.courses',
    'apps.reviews',
    'apps.blog',
    'apps.notifications',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.affiliates.middleware.AffiliateClickMiddleware',
]

ROOT_URLCONF = 'config.urls'

AUTH_USER_MODEL = 'users.User'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='eshoppingcentre'),
        'USER': config('DB_USER', default='eshopping'),
        'PASSWORD': config('DB_PASSWORD', default='eshopping123'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
}

# JWT
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS
CORS_ALLOWED_ORIGINS = config('CORS_ORIGINS',
    default='http://localhost:3000').split(',')

# Redis & Celery
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = CELERY_BROKER_URL

# Channels
ASGI_APPLICATION = 'config.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [('127.0.0.1', 6379)]},
    },
}

# Media & Static
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# AWS S3 (Produção)
if not DEBUG:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='auto')
    AWS_S3_ENDPOINT_URL = config('AWS_S3_ENDPOINT_URL', default=None)

LANGUAGE_CODE = 'pt'
TIME_ZONE = 'Africa/Maputo'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

### Passo 1.5 — Configurar URLs Raiz

```python
# config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.users.urls_auth')),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/stores/', include('apps.stores.urls')),
    path('api/v1/products/', include('apps.products.urls')),
    path('api/v1/categories/', include('apps.products.urls_categories')),
    path('api/v1/orders/', include('apps.orders.urls')),
    path('api/v1/payments/', include('apps.payments.urls')),
    path('api/v1/affiliates/', include('apps.affiliates.urls')),
    path('api/v1/wallet/', include('apps.wallet.urls')),
    path('api/v1/courses/', include('apps.courses.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
    path('api/v1/blog/', include('apps.blog.urls')),
    # Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

---

## 6. FASE 2: AUTENTICAÇÃO E UTILIZADORES

### Passo 2.1 — Modelo User Customizado

Implementar `apps/users/models.py` como especificado acima (seção 3.1).

### Passo 2.2 — Serializers

```python
# apps/users/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import UserProfile, Address

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password2', 'phone', 'first_name', 'last_name')

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'As passwords não coincidem'})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        user.roles = ['buyer']  # Papel padrão
        user.save()
        UserProfile.objects.create(user=user)
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'phone', 'first_name', 'last_name',
                  'avatar', 'roles', 'is_verified', 'date_of_birth', 'bio')
        read_only_fields = ('id', 'email', 'roles', 'is_verified')

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ('user',)
```

### Passo 2.3 — Views e URLs

```python
# apps/users/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class AddressListView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
```

### Passo 2.4 — Testes de Autenticação

```python
# apps/users/tests/test_auth.py
import pytest
from django.urls import reverse
from rest_framework import status

@pytest.mark.django_db
def test_register_user(api_client):
    url = reverse('register')
    data = {
        'email': 'teste@email.com',
        'username': 'teste',
        'password': 'SenhaForte123!',
        'password2': 'SenhaForte123!',
        'first_name': 'Teste',
        'last_name': 'Silva',
    }
    response = api_client.post(url, data)
    assert response.status_code == status.HTTP_201_CREATED
    assert 'access' in response.data

@pytest.mark.django_db
def test_login_user(api_client, user):
    url = reverse('token_obtain_pair')
    data = {'email': user.email, 'password': 'testpass123'}
    response = api_client.post(url, data)
    assert response.status_code == status.HTTP_200_OK
    assert 'access' in response.data
```

---

## 7. FASE 3: PRODUTOS E CATÁLOGO

### Passo 3.1 — Modelos (já definidos na secção 3.3)

### Passo 3.2 — Serializers

```python
# apps/products/serializers.py
class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'image', 'alt_text', 'is_primary', 'sort_order')

class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'name', 'slug', 'price', 'compare_price',
                  'discount_percentage', 'primary_image', 'product_type',
                  'rating', 'review_count', 'sales_count', 'is_on_sale',
                  'store_name', 'store_slug', 'created_at')

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first()
        return self.context['request'].build_absolute_uri(img.image.url) if img else None

    def get_discount_percentage(self, obj):
        if obj.compare_price and obj.compare_price > 0:
            return round((1 - obj.price / obj.compare_price) * 100)
        return None

class ProductDetailSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    store = serializers.SerializerMethodField()
    variations = ProductVariationSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def get_store(self, obj):
        return {
            'id': obj.store.id,
            'name': obj.store.name,
            'slug': obj.store.slug,
            'logo': self.context['request'].build_absolute_uri(obj.store.logo.url) if obj.store.logo else None,
            'rating': str(obj.store.rating),
            'total_sales': obj.store.total_sales,
        }
```

### Passo 3.3 — Filtros e Pesquisa

```python
# apps/products/filters.py
import django_filters
from .models import Product

class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    category = django_filters.CharFilter(field_name='category__slug')
    store = django_filters.CharFilter(field_name='store__slug')
    is_on_sale = django_filters.BooleanFilter()
    min_rating = django_filters.NumberFilter(field_name='rating', lookup_expr='gte')

    class Meta:
        model = Product
        fields = ['product_type', 'status', 'category', 'store',
                  'min_price', 'max_price', 'is_on_sale', 'min_rating']
```

---

## 8. FASE 4: MULTI-VENDOR — LOJAS

### Passo 8.1 — Permissões Customizadas

```python
# apps/stores/permissions.py
from rest_framework import permissions

class IsStoreOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.store.owner == request.user

class HasStore(permissions.BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'store') and request.user.store.status == 'active'

class IsStoreOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user
```

### Passo 8.2 — Views da Loja

```python
# apps/stores/views.py
class StoreListView(generics.ListAPIView):
    queryset = Store.objects.filter(status='active')
    serializer_class = StoreSerializer
    permission_classes = [permissions.AllowAny]

class StoreDetailView(generics.RetrieveAPIView):
    queryset = Store.objects.filter(status='active')
    serializer_class = StoreDetailSerializer
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]

class StoreRegisterView(generics.CreateAPIView):
    serializer_class = StoreRegisterSerializer
    permission_classes = [permissions.IsAuthenticated]

class MyStoreView(generics.RetrieveUpdateAPIView):
    serializer_class = StoreSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.store
```

---

## 9. FASE 5: CARRINHO E CHECKOUT

### Nota: O carrinho actualmente persiste no localStorage do frontend. No backend, apenas processamos o checkout.

### Passo 9.1 — Criar Encomenda

```python
# apps/orders/views.py
class CreateOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # Iniciar pagamento se necessário
        payment_method = serializer.validated_data.get('payment_method')
        if payment_method:
            payment_service = get_payment_service(payment_method)
            payment_result = payment_service.initiate_payment(order)

            return Response({
                'order': OrderSerializer(order).data,
                'payment': payment_result,
            }, status=status.HTTP_201_CREATED)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
```

---

## 10. FASE 6: PAGAMENTOS

### Passo 10.1 — Serviço de Pagamento Abstracto

```python
# apps/payments/services/base.py
from abc import ABC, abstractmethod

class BasePaymentService(ABC):
    @abstractmethod
    def initiate_payment(self, order) -> dict:
        """Inicia o pagamento e retorna dados para o frontend"""
        pass

    @abstractmethod
    def process_callback(self, data: dict) -> bool:
        """Processa callback/webhook do provedor"""
        pass

    @abstractmethod
    def verify_payment(self, transaction_id: str) -> bool:
        """Verifica o status do pagamento"""
        pass
```

### Passo 10.2 — M-Pesa (Moçambique)

```python
# apps/payments/services/mpesa.py
class MPesaService(BasePaymentService):
    BASE_URL = config('MPESA_BASE_URL', default='https://api.vodacom.co.mz')
    API_KEY = config('MPESA_API_KEY')
    PUBLIC_KEY = config('MPESA_PUBLIC_KEY')
    SERVICE_PROVIDER_CODE = config('MPESA_SP_CODE')

    def initiate_payment(self, order) -> dict:
        payload = {
            'input_ServiceProviderCode': self.SERVICE_PROVIDER_CODE,
            'input_TransactionReference': order.order_number,
            'input_Amount': str(order.total),
            'input_ThirdPartyReference': str(order.id),
            'input_CustomerMSISDN': order.buyer.phone,
        }
        response = requests.post(
            f'{self.BASE_URL}/ipg/v1/c2bPayment/singleStage/',
            json=payload,
            headers={'Authorization': f'Bearer {self.API_KEY}'}
        )
        # Processar resposta...
        return {'redirect_url': None, 'status': 'pending', 'provider_ref': '...'}
```

### Passo 10.3 — Stripe

```python
# apps/payments/services/stripe.py
import stripe

class StripeService(BasePaymentService):
    def __init__(self):
        stripe.api_key = config('STRIPE_SECRET_KEY')

    def initiate_payment(self, order) -> dict:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[...],
            mode='payment',
            success_url=f'{config("FRONTEND_URL")}/checkout/success?order={order.id}',
            cancel_url=f'{config("FRONTEND_URL")}/checkout/cancel?order={order.id}',
            metadata={'order_id': str(order.id)},
        )
        return {'redirect_url': session.url, 'status': 'pending'}
```

---

## 11. FASE 7: SISTEMA DE AFILIADOS

### Passo 11.1 — Middleware de Rastreio

```python
# apps/affiliates/middleware.py
class AffiliateClickMiddleware:
    """Regista cliques em links de afiliados ao visitar /?ref=CODE"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ref_code = request.GET.get('ref')
        if ref_code:
            try:
                link = AffiliateLink.objects.get(code=ref_code)
                link.clicks += 1
                link.save(update_fields=['clicks'])
                AffiliateClick.objects.create(
                    link=link,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    referrer=request.META.get('HTTP_REFERER', ''),
                )
                # Guardar código de afiliado na sessão para o checkout
                request.session['affiliate_code'] = ref_code
            except AffiliateLink.DoesNotExist:
                pass

        return self.get_response(request)
```

### Passo 11.2 — Cálculo de Comissão no Checkout

```python
# apps/orders/serializers.py (dentro de CreateOrderSerializer)
def create(self, validated_data):
    affiliate_code = self.context['request'].session.get('affiliate_code')
    affiliate = None
    affiliate_commission = 0

    if affiliate_code:
        link = AffiliateLink.objects.filter(code=affiliate_code).first()
        if link:
            affiliate = link.affiliate.user
            # Calcular comissão com base na taxa do produto
            for item_data in validated_data['items']:
                product = item_data['product']
                rate = product.affiliate_commission
                commission = (item_data['total_price'] * rate) / 100
                affiliate_commission += commission

    order = Order.objects.create(
        buyer=self.context['request'].user,
        affiliate=affiliate,
        affiliate_commission=affiliate_commission,
        **validated_data,
    )

    if affiliate:
        AffiliateCommission.objects.create(
            affiliate=affiliate.affiliate_profile,
            order=order,
            product=order.items.first().product,
            amount=affiliate_commission,
            commission_rate=order.items.first().product.affiliate_commission,
        )

    return order
```

---

## 12. FASE 8: PRODUTOS DIGITAIS E CURSOS

### Passo 12.1 — Entrega de Produto Digital

```python
# apps/orders/signals.py
@receiver(post_save, sender=Order)
def deliver_digital_products(sender, instance, created, **kwargs):
    """Quando o pagamento é confirmado, libertar downloads de produtos digitais"""
    if instance.payment_status == 'completed' and instance.status == 'confirmed':
        for item in instance.items.filter(product__product_type='digital'):
            DigitalDownload.objects.get_or_create(
                user=instance.buyer,
                product=item.product,
                order=instance,
            )

class DigitalDownload(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    download_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
```

### Passo 12.2 — Matrícula em Curso

```python
@receiver(post_save, sender=Order)
def enroll_in_courses(sender, instance, created, **kwargs):
    if instance.payment_status == 'completed':
        for item in instance.items.filter(product__product_type='course'):
            Enrollment.objects.get_or_create(
                user=instance.buyer,
                course=item.product.course,
                order=instance,
            )
```

---

## 13. FASE 9: CARTEIRA VIRTUAL E FINANCEIRO

### Passo 13.1 — Divisão de Pagamento

```python
# apps/wallet/services.py
def process_sale_financials(order):
    """Processa divisão do dinheiro após venda confirmada"""
    PLATFORM_FEE_PERCENT = Decimal('8.0')  # 8% para a plataforma

    total = order.total
    platform_fee = (total * PLATFORM_FEE_PERCENT) / 100
    affiliate_commission = order.affiliate_commission
    seller_amount = total - platform_fee - affiliate_commission

    # Crédito ao vendedor
    seller_wallet = order.store.owner.wallet
    seller_wallet.balance += seller_amount
    seller_wallet.total_earned += seller_amount
    seller_wallet.save()

    WalletTransaction.objects.create(
        wallet=seller_wallet,
        type='sale',
        amount=seller_amount,
        balance_before=seller_wallet.balance - seller_amount,
        balance_after=seller_wallet.balance,
        reference_type='order',
        reference_id=order.id,
        description=f'Venda: {order.order_number}',
        status='completed',
    )

    # Crédito ao afiliado (se aplicável)
    if order.affiliate:
        aff_wallet = order.affiliate.wallet
        aff_wallet.balance += affiliate_commission
        aff_wallet.total_earned += affiliate_commission
        aff_wallet.save()

        WalletTransaction.objects.create(...)

    # Taxa da plataforma (admin)
    admin_wallet = User.objects.filter(roles__contains=['admin']).first().wallet
    admin_wallet.balance += platform_fee
    admin_wallet.save()
```

---

## 14. FASE 10: NOTIFICAÇÕES, EMAIL E WEBSOCKETS

### Passo 14.1 — Celery Tasks para Email

```python
# apps/notifications/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

@shared_task
def send_order_confirmation_email(user_email, order_number, items, total):
    subject = f'Pedido {order_number} Confirmado - eShoppingCentre'
    message = f'O seu pedido {order_number} no valor de {total} MZN foi confirmado!'
    html_message = render_to_string('emails/order_confirmation.html', {...})
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL,
              [user_email], html_message=html_message)

@shared_task
def send_seller_new_order_email(seller_email, order_number):
    subject = f'Nova Venda: {order_number}'
    send_mail(subject, f'Você recebeu uma nova encomenda: {order_number}',
              settings.DEFAULT_FROM_EMAIL, [seller_email])
```

### Passo 14.2 — WebSockets para Notificações em Tempo Real

```python
# apps/notifications/consumers.py
class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if self.user.is_authenticated:
            self.group_name = f'user_{self.user.id}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
        else:
            await self.close()

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event['data']))
```

---

## 15. FASE 11: ADMIN DASHBOARD BACKEND

### Passo 15.1 — Endpoints Admin

```python
# apps/users/views_admin.py
class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response({
            'total_users': User.objects.count(),
            'total_stores': Store.objects.count(),
            'total_orders': Order.objects.count(),
            'total_revenue': WalletTransaction.objects.filter(
                type='fee', status='completed'
            ).aggregate(total=Sum('amount'))['total'] or 0,
            'pending_stores': Store.objects.filter(status='pending').count(),
            'pending_payouts': SellerPayout.objects.filter(status='pending').count(),
        })
```

---

## 16. FASE 12: SEGURANÇA, PERFORMANCE E DEPLOY

### Passo 16.1 — Checklist de Segurança

- [ ] `SECRET_KEY` em variáveis de ambiente (NUNCA em código)
- [ ] `DEBUG=False` em produção
- [ ] `ALLOWED_HOSTS` configurado
- [ ] CSRF protection com `CSRF_TRUSTED_ORIGINS`
- [ ] CORS restrito à origem do frontend
- [ ] Rate limiting (`anon: 100/h`, `user: 1000/h`)
- [ ] HTTPS forçado (`SECURE_SSL_REDIRECT=True`)
- [ ] Headers de segurança (HSTS, X-Content-Type-Options, etc.)
- [ ] Upload de ficheiros validado (tamanho, tipo)
- [ ] SQL injection prevenida pelo ORM
- [ ] XSS prevenido por escaping automático do Django
- [ ] Senhas com validação (`validate_password`)

### Passo 16.2 — Performance

- [ ] Índices de BD em campos de busca frequente
- [ ] `select_related` e `prefetch_related` para reduzir queries
- [ ] Cache com Redis para endpoints populares (categorias, produtos em destaque)
- [ ] Paginação em todos os endpoints de lista
- [ ] Compressão de resposta (`django.middleware.gzip.GZipMiddleware`)
- [ ] Thumbnails automáticos para imagens (`easy-thumbnails`)

### Passo 16.3 — Deploy (Railway / Render)

```dockerfile
# Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
```

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          pip install -r requirements.txt
          pytest
      - name: Deploy to Railway
        uses: railwayapp/cli-action@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 17. CRONOGRAMA E MARCOS

```
SEMANA 1-2  ████████  FASE 1-2: Setup + Auth
             • Projecto Django criado e configurado
             • PostgreSQL + Redis em Docker
             • Registo, Login, JWT funcional
             • Testes de autenticação passando

SEMANA 3-4  ████████  FASE 3-4: Produtos + Lojas
             • CRUD de produtos completo
             • Upload de imagens
             • Registo e gestão de lojas
             • Catálogo com filtros e pesquisa

SEMANA 5-6  ████████  FASE 5-6: Checkout + Pagamentos
             • API de criação de encomenda
             • Integração M-Pesa (sandbox)
             • Integração Stripe (test mode)
             • Cálculo de taxas e comissões

SEMANA 7-8  ████████  FASE 7-9: Afiliados + Wallet
             • Sistema de afiliados funcional
             • Carteira virtual com transações
             • Divisão automática de pagamentos
             • Saques via M-Pesa

SEMANA 9-10 ████████  FASE 10-11: Notificações + Admin
             • Emails transacionais
             • WebSockets para notificações
             • API de admin dashboard
             • Documentação Swagger completa

SEMANA 11-12 ████████  FASE 8+12: Cursos + Deploy
             • Módulo de e-learning
             • Upload de vídeos
             • Deploy em produção
             • Monitorização e logging

SEMANA 13-14 ████████  POLIMENTO
             • Testes E2E com Postman/pytest
             • Correções de bugs
             • Integração final com frontend
             • Documentação da API
```

---

### 📌 Resumo: Ordem de Execução

1. **`pip install` + Docker** → Ambiente pronto
2. **Models** → Todas as apps com modelos
3. **Auth** → Registo, Login, JWT
4. **Products** → CRUD, catálogo, busca
5. **Stores** → Multi-vendor
6. **Orders** → Checkout
7. **Payments** → M-Pesa, Stripe
8. **Affiliates** → Links, tracking, comissões
9. **Wallet** → Divisão financeira
10. **Courses** → E-learning
11. **Notifications** → Email, WebSocket
12. **Admin API** → Stats, moderação
13. **Deploy** → Docker, Railway

---

> Este plano cobre ~**12-14 semanas** de desenvolvimento backend. Cada fase é independente e pode ser testada isoladamente.

---

## 18. INTEGRAÇÃO FRONTEND ↔ BACKEND

### 18.1 Fluxo de Comunicação

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS 15 (Frontend)                     │
│                                                              │
│  Server Components    Client Components     API Routes       │
│  (SSR com fetch)     (useEffect + fetch)   (Proxy seguro)   │
│        │                    │                    │           │
│        └────────────────────┼────────────────────┘           │
│                             │                                │
│              src/lib/api.ts (Cliente HTTP)                   │
│              • axios com interceptors                        │
│              • JWT auto-refresh                              │
│              • Tipagens TypeScript                           │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
                              │ Authorization: Bearer <token>
┌─────────────────────────────▼───────────────────────────────┐
│                 DJANGO REST API (Backend)                    │
│                 http://localhost:8000/api/v1/                │
└─────────────────────────────────────────────────────────────┘
```

### 18.2 Variáveis de Ambiente no Frontend

Criar `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_MEDIA_URL=http://localhost:8000
API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 18.3 Cliente HTTP Centralizado — `frontend/src/lib/api.ts`

Instalar dependência: `pnpm add axios`

O ficheiro `api.ts` contém:
- Instância axios com `baseURL`
- Interceptor para adicionar `Authorization: Bearer <token>`
- Interceptor para auto-refresh do JWT (401 → refresh → retry)
- Tipagens TypeScript completas (`User`, `Product`, `Order`, `Store`, etc.)
- Funções organizadas por domínio: `authAPI`, `productsAPI`, `categoriesAPI`, `storesAPI`, `ordersAPI`, `affiliatesAPI`, `usersAPI`, `walletAPI`, `reviewsAPI`, `coursesAPI`, `blogAPI`, `adminAPI`

### 18.4 Hook `useAuth` — `frontend/src/hooks/useAuth.ts`

```typescript
'use client';
// Fornece: user, loading, isAuthenticated, isAdmin, isSeller, isAffiliate
// Métodos: login(), register(), logout()
// Usa AuthContext + AuthProvider para disponibilizar em toda a app
```

### 18.5 Actualizar `app/providers.tsx`

Envolver com `<AuthProvider>` antes do `<CartProvider>`.

### 18.6 Como Integrar Cada Tipo de Página

| Tipo | Estratégia |
|------|-----------|
| **Páginas públicas** (Home, Produto, Categoria, Blog) | Server Component com `fetch()` directo ou `productsAPI.list()` |
| **Carrinho / Checkout** | Client Component → `ordersAPI.create()` ao submeter |
| **Conta (protegida)** | `useAuth()` + redirect para `/login` se não autenticado |
| **Admin (protegida)** | `useAuth()` + verificar `isAdmin` |
| **Seller Dashboard** | `useAuth()` + verificar `isSeller` |

### 18.7 Plano de Migração: Mock → API Real

| Fase | Ficheiros | Acção |
|------|-----------|-------|
| 1 | `src/lib/api.ts` | Criar cliente HTTP |
| 2 | `src/hooks/useAuth.ts` | Criar sistema de auth |
| 3 | `app/page.tsx`, `app/product/[slug]/page.tsx`, `app/category/[slug]/page.tsx`, `app/search/page.tsx` | SSR com API real |
| 4 | `app/login/page.tsx`, `app/signup/page.tsx` | `authAPI.login()` / `authAPI.register()` |
| 5 | `app/cart/page.tsx`, `app/checkout/page.tsx` | Checkout via API |
| 6 | `app/account/*` | `usersAPI.*`, `walletAPI.*` |
| 7 | `app/admin/page.tsx`, `src/components/AdminDashboard.tsx` | `adminAPI.*` |
| 8 | `app/seller/*` | `storesAPI.*`, `productsAPI.*` |
| 9 | `app/affiliate/*` | `affiliatesAPI.*` |
| 10 | `app/courses/*`, `app/my-courses/*` | `coursesAPI.*` |
| 11 | `app/blog/*` | `blogAPI.*` |
| 12 | Limpeza | Remover `src/data/marketplace.ts` |

### 18.8 Fluxo de Autenticação

```
1. App carrega → useAuth() verifica localStorage por access_token
2. Token existe → GET /api/v1/users/me/ → setUser(data)
3. Token expirado → POST /api/v1/auth/token/refresh/ → novo access_token
4. Refresh expirado → Redirecionar para /login
5. Login → POST /api/v1/auth/login/ → guardar access + refresh no localStorage
```

### 18.9 Cronograma de Integração

```
DIAS 1-2   ████  Setup: api.ts + useAuth + AuthProvider + .env.local
DIAS 3-5   ████  Páginas públicas: Home, Produto, Categoria, Search, Blog
DIAS 6-8   ████  Autenticação: Login, Registo, Conta, rotas protegidas
DIAS 9-11  ████  Checkout: Carrinho, Criar Encomenda, Histórico
DIAS 12-14 ████  Painéis: Admin, Seller, Affiliate
DIAS 15-16 ████  E-Learning: Cursos, My Courses, Player
DIAS 17-18 ████  Testes: E2E, CORS, loading states, remover mock
```

---

> 📌 **Nota:** Manter `src/data/marketplace.ts` até a API estar funcional. Usar flag `USE_MOCK` para alternar entre mock e API real durante desenvolvimento.
