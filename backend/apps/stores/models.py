from django.db import models
from django.utils.text import slugify
from apps.core.models import BaseModel


class Store(BaseModel):
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('awaiting_documents', 'Aguardando Documentos'),
        ('active', 'Activa'),
        ('rejected', 'Rejeitada'),
        ('suspended', 'Suspensa'),
        ('closed', 'Fechada'),
    ]

    PRODUCT_TYPE_CHOICES = [
        ('physical', 'Produtos Físicos'),
        ('digital', 'Produtos Digitais'),
        ('course', 'Cursos'),
    ]

    owner = models.OneToOneField('users.User', on_delete=models.CASCADE, related_name='store')
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField()
    about = models.TextField(blank=True)
    tagline = models.CharField(max_length=200, blank=True, help_text='Slogan curto da loja')
    logo = models.ImageField(upload_to='stores/logos/', blank=True)
    banner = models.ImageField(upload_to='stores/banners/', blank=True)
    theme_color = models.CharField(max_length=7, blank=True, default='#2563eb', help_text='Cor hexadecimal (ex: #2563eb)')
    category = models.CharField(max_length=100)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default='physical',
                                    help_text='Tipo de produto que esta loja vende')
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    location = models.CharField(max_length=255)
    website = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_sales = models.PositiveIntegerField(default=0)
    total_products = models.PositiveIntegerField(default=0)
    default_affiliate_commission = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    low_stock_threshold = models.PositiveIntegerField(default=5, help_text='Alertar quando stock <= este valor')
    shipping_policy = models.TextField(blank=True)
    return_policy = models.TextField(blank=True)
    # ─── Documentos de verificação ───
    identity_document = models.FileField(upload_to='stores/documents/identity/', blank=True,
                                         help_text='Documento de identidade (BI/passaporte)')
    tax_document = models.FileField(upload_to='stores/documents/tax/', blank=True,
                                    help_text='Comprovativo fiscal (NUIT/licença)')
    address_proof = models.FileField(upload_to='stores/documents/address/', blank=True,
                                     help_text='Comprovativo de morada')
    additional_documents = models.FileField(upload_to='stores/documents/additional/', blank=True,
                                            help_text='Documentos adicionais (contrato social, etc.)')
    # ─── Admin ───
    admin_notes = models.TextField(blank=True, help_text='Notas internas visíveis apenas para administradores')
    rejection_reason = models.TextField(blank=True, help_text='Motivo da rejeição (preenchido pelo admin)')

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['slug']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            base_slug = slugify(self.name)
            unique_slug = base_slug
            n = 1
            while Store.objects.filter(slug=unique_slug).exclude(pk=self.pk).exists():
                unique_slug = f'{base_slug}-{n}'
                n += 1
            self.slug = unique_slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @property
    def tier(self):
        """Nível do vendedor baseado em vendas totais."""
        if self.total_sales >= 2000:
            return 'diamond'
        elif self.total_sales >= 500:
            return 'gold'
        elif self.total_sales >= 100:
            return 'silver'
        return 'bronze'

    @property
    def tier_display(self):
        labels = {'diamond': '💎 Diamante', 'gold': '🥇 Ouro', 'silver': '🥈 Prata', 'bronze': '🥉 Bronze'}
        return labels.get(self.tier, 'Bronze')


class StoreModerationLog(BaseModel):
    """Registo de todas as acções de moderação sobre uma loja."""
    ACTION_CHOICES = [
        ('approved', 'Aprovada'),
        ('rejected', 'Rejeitada'),
        ('suspended', 'Suspensa'),
        ('reactivated', 'Reactivada'),
        ('closed', 'Fechada'),
        ('edited', 'Editada'),
    ]
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='moderation_logs')
    admin = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='moderation_actions')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    reason = models.TextField(blank=True, help_text='Motivo da acção (obrigatório para rejeição)')
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', '-created_at']),
        ]

    def __str__(self):
        return f'{self.store.name} — {self.get_action_display()} por {self.admin} em {self.created_at:%d/%m/%Y}'


class StoreFollower(BaseModel):
    """Utilizador segue uma loja para receber notificacoes de novos produtos."""
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='followed_stores')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='followers')
    notify_new_products = models.BooleanField(default=True)
    notify_promotions = models.BooleanField(default=False)

    class Meta:
        unique_together = [['user', 'store']]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} → {self.store.name}'
