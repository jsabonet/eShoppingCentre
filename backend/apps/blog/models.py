import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.html import strip_tags
from apps.core.models import BaseModel

META_TITLE_MAX = 60
META_DESCRIPTION_MAX = 160
TWITTER_CARD_CHOICES = (
    ('summary_large_image', 'Imagem grande'),
    ('summary', 'Resumo'),
)


class BlogPost(BaseModel):
    slug = models.SlugField(max_length=255, unique=True)
    title = models.CharField(max_length=500)
    excerpt = models.TextField()
    content = models.TextField()
    image = models.ImageField(upload_to='blog/', blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    author_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    blog_category = models.ForeignKey(
        'BlogCategory',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='posts',
    )
    read_time = models.CharField(max_length=20, blank=True)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    # SEO
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(blank=True)
    canonical_url = models.URLField(max_length=500, blank=True)
    focus_keyword = models.CharField(max_length=120, blank=True)
    noindex = models.BooleanField(default=False)
    nofollow = models.BooleanField(default=False)
    og_title = models.CharField(max_length=255, blank=True)
    og_description = models.TextField(blank=True)
    twitter_card = models.CharField(
        max_length=20, choices=TWITTER_CARD_CHOICES, default='summary_large_image'
    )

    # Créditos da imagem de destaque
    image_caption = models.CharField(max_length=255, blank=True)
    image_credit = models.CharField(max_length=255, blank=True)
    image_source_url = models.URLField(max_length=500, blank=True)

    def save(self, *args, **kwargs):
        word_count = len(strip_tags(self.content).split())
        self.read_time = f'{max(1, (word_count + 199) // 200)} min'
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'published_at'}
        if kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = set(kwargs['update_fields']) | {'read_time'}
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    # ── Resolvers SEO (fallback em cascata) ──

    @property
    def seo_title(self):
        return (self.meta_title or self.title or '').strip()[:META_TITLE_MAX]

    @property
    def seo_description(self):
        source = self.meta_description or self.excerpt or strip_tags(self.content)
        return ' '.join(strip_tags(source or '').split())[:META_DESCRIPTION_MAX]

    @property
    def seo_og_title(self):
        return (self.og_title or self.meta_title or self.title or '').strip()[:255]

    @property
    def seo_og_description(self):
        return ' '.join(strip_tags(self.og_description or self.excerpt or self.content or '').split())[:META_DESCRIPTION_MAX]

    @property
    def seo_robots(self):
        directives = [
            'noindex' if self.noindex else 'index',
            'nofollow' if self.nofollow else 'follow',
        ]
        return ','.join(directives) + ('' if self.is_published else ',noarchive')


class BlogCategory(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ('name',)
        verbose_name_plural = 'blog categories'

    def __str__(self):
        return self.name


class BlogInlineImage(BaseModel):
    """Imagem carregada para o corpo de um artigo do blog."""
    image = models.ImageField(upload_to='blog/inline/%Y/%m/')
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='blog_inline_images',
    )

    def __str__(self):
        return self.original_name or self.image.name


class BlogComment(BaseModel):
    """Comentário de um leitor num artigo do blog, sujeito a moderação."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendente'
        APPROVED = 'approved', 'Aprovado'
        REJECTED = 'rejected', 'Rejeitado'

    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='blog_comments',
    )
    author_name = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )

    def __str__(self):
        return f'{self.author_name or "Anónimo"}: {self.content[:40]}'


class BlogLike(BaseModel):
    """Gosto de um leitor num artigo do blog."""
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blog_likes',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('post', 'user'), name='unique_blog_like'),
        ]

    def __str__(self):
        return f'{self.user} gostou de {self.post.slug}'


class NewsletterSubscription(BaseModel):
    """Subscrição da newsletter."""
    email = models.EmailField(unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    source = models.CharField(max_length=40, blank=True)
    consented_at = models.DateTimeField(null=True, blank=True)
    unsubscribe_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    def __str__(self):
        return self.email


class NewsletterCampaign(BaseModel):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Na fila'
        SENDING = 'sending', 'A enviar'
        SENT = 'sent', 'Enviada'
        PARTIAL = 'partial', 'Parcialmente enviada'
        FAILED = 'failed', 'Falhou'

    class Trigger(models.TextChoices):
        PUBLICATION = 'publication', 'Primeira publicação'
        MANUAL = 'manual', 'Envio manual'

    post = models.ForeignKey(
        BlogPost,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='newsletter_campaigns',
    )
    post_title = models.CharField(max_length=500)
    post_slug = models.SlugField(max_length=255)
    post_excerpt = models.TextField()
    trigger = models.CharField(max_length=20, choices=Trigger.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED, db_index=True)
    recipient_count = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    requested_by_email = models.EmailField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=('post', 'trigger'),
                condition=models.Q(trigger='publication'),
                name='unique_blog_publication_newsletter',
            ),
        ]

    def __str__(self):
        return f'{self.post_title} — {self.get_status_display()}'


class NewsletterCampaignDelivery(BaseModel):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Na fila'
        SENDING = 'sending', 'A enviar'
        SENT = 'sent', 'Enviado'
        FAILED = 'failed', 'Falhou'
        SKIPPED = 'skipped', 'Ignorado'

    campaign = models.ForeignKey(
        NewsletterCampaign,
        on_delete=models.CASCADE,
        related_name='deliveries',
    )
    subscription = models.ForeignKey(
        NewsletterSubscription,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='newsletter_deliveries',
    )
    email = models.EmailField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=('campaign', 'email'),
                name='unique_newsletter_campaign_recipient',
            ),
        ]

    def __str__(self):
        return f'{self.email} — {self.get_status_display()}'
