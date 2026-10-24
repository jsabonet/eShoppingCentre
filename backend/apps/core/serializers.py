from rest_framework import serializers

from apps.core.models import AdminAuditEvent


class AdminAuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminAuditEvent
        fields = (
            'id',
            'created_at',
            'actor_email',
            'action',
            'method',
            'path',
            'status_code',
            'outcome',
            'ip_address',
            'user_agent',
            'duration_ms',
        )
        read_only_fields = fields
