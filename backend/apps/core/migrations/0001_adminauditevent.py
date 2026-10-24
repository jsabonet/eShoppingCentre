import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminAuditEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('actor_email', models.EmailField(blank=True, max_length=254)),
                ('action', models.CharField(
                    choices=[
                        ('read', 'Consulta'),
                        ('create', 'Criação'),
                        ('update', 'Actualização'),
                        ('delete', 'Eliminação'),
                        ('action', 'Acção'),
                    ],
                    db_index=True,
                    max_length=10,
                )),
                ('method', models.CharField(max_length=10)),
                ('path', models.CharField(max_length=500)),
                ('status_code', models.PositiveSmallIntegerField()),
                ('outcome', models.CharField(
                    choices=[('success', 'Sucesso'), ('failure', 'Falha')],
                    db_index=True,
                    max_length=10,
                )),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=500)),
                ('duration_ms', models.PositiveIntegerField(default=0)),
                ('actor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='admin_audit_events',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['-created_at', 'outcome'], name='core_admina_created_78e9fc_idx'),
                    models.Index(fields=['actor_email', '-created_at'], name='core_admina_actor_e_11b3a0_idx'),
                ],
            },
        ),
    ]
