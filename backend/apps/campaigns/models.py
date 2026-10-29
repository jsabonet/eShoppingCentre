from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel


class BannerCampaign(BaseModel):
    class State(models.TextChoices):
        DRAFT = 'draft', 'Rascunho'
        ACTIVE = 'active', 'Ativa'
        PAUSED = 'paused', 'Pausada'
        ARCHIVED = 'archived', 'Arquivada'

    class Position(models.TextChoices):
        HOMEPAGE_HERO = 'homepage_hero', 'Banner principal da homepage'

    internal_name = models.CharField(max_length=150)
    image = models.ImageField(upload_to='campaigns/banners/%Y/%m/')
    mobile_image = models.ImageField(
        upload_to='campaigns/banners/%Y/%m/', blank=True
    )
    alt_text = models.CharField(max_length=300)
    title = models.CharField(max_length=200, blank=True)
    subtitle = models.CharField(max_length=500, blank=True)
    cta = models.CharField(max_length=80, blank=True)
    target_url = models.CharField(max_length=1000)
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(db_index=True)
    priority = models.IntegerField(default=0, db_index=True)
    position = models.CharField(
        max_length=30,
        choices=Position.choices,
        default=Position.HOMEPAGE_HERO,
        db_index=True,
    )
    state = models.CharField(
        max_length=12,
        choices=State.choices,
        default=State.DRAFT,
        db_index=True,
    )
    view_count = models.PositiveBigIntegerField(default=0)
    click_count = models.PositiveBigIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_banner_campaigns',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_banner_campaigns',
    )

    class Meta(BaseModel.Meta):
        indexes = [
            models.Index(
                fields=('position', 'state', '-priority', 'starts_at'),
                name='campaign_position_state_idx',
            ),
        ]

    @property
    def display_status(self):
        now = timezone.now()
        if self.state == self.State.ACTIVE:
            if self.starts_at > now:
                return 'scheduled'
            if self.ends_at <= now:
                return 'expired'
            return 'published'
        return self.state

    @property
    def is_currently_active(self):
        now = timezone.now()
        return (
            self.state == self.State.ACTIVE
            and self.starts_at <= now < self.ends_at
        )

    def __str__(self):
        return self.internal_name


class CampaignAudit(BaseModel):
    campaign_id = models.UUIDField(db_index=True)
    campaign_name = models.CharField(max_length=150)
    action = models.CharField(max_length=20)
    changes = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='banner_campaign_audit_events',
    )

    class Meta(BaseModel.Meta):
        indexes = [
            models.Index(
                fields=('campaign_id', '-created_at'),
                name='campaign_audit_campaign_idx',
            ),
        ]

    def __str__(self):
        return f'{self.campaign_name} — {self.action}'
