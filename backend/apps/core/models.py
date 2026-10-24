import uuid
from django.conf import settings
from django.db import models


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class AdminAuditEvent(BaseModel):
    ACTION_CHOICES = [
        ('read', 'Consulta'),
        ('create', 'Criação'),
        ('update', 'Actualização'),
        ('delete', 'Eliminação'),
        ('action', 'Acção'),
    ]
    OUTCOME_CHOICES = [
        ('success', 'Sucesso'),
        ('failure', 'Falha'),
    ]

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='admin_audit_events',
    )
    actor_email = models.EmailField(blank=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, db_index=True)
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=500)
    status_code = models.PositiveSmallIntegerField()
    outcome = models.CharField(max_length=10, choices=OUTCOME_CHOICES, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        indexes = [
            models.Index(
                fields=['-created_at', 'outcome'],
                name='core_admina_created_78e9fc_idx',
            ),
            models.Index(
                fields=['actor_email', '-created_at'],
                name='core_admina_actor_e_11b3a0_idx',
            ),
        ]

    def __str__(self):
        return f'{self.actor_email or "Anónimo"} — {self.method} {self.path}'
