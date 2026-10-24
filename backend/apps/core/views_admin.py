from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError

from apps.core.models import AdminAuditEvent
from apps.core.serializers import AdminAuditEventSerializer


class AdminAuditEventListView(generics.ListAPIView):
    serializer_class = AdminAuditEventSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = AdminAuditEvent.objects.select_related('actor').all()
        params = self.request.query_params

        for parameter, choices in (
            ('action', {choice[0] for choice in AdminAuditEvent.ACTION_CHOICES}),
            ('outcome', {choice[0] for choice in AdminAuditEvent.OUTCOME_CHOICES}),
        ):
            value = params.get(parameter)
            if value:
                if value not in choices:
                    raise ValidationError({parameter: 'Filtro inválido.'})
                queryset = queryset.filter(**{parameter: value})

        method = params.get('method')
        if method:
            allowed_methods = {'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'}
            method = method.upper()
            if method not in allowed_methods:
                raise ValidationError({'method': 'Filtro inválido.'})
            queryset = queryset.filter(method=method)

        search = params.get('search', '').strip()
        if len(search) > 100:
            raise ValidationError({'search': 'O filtro pode ter no máximo 100 caracteres.'})
        if search:
            queryset = queryset.filter(Q(actor_email__icontains=search) | Q(path__icontains=search))

        start_date = self._parse_date(params.get('date_from'), 'date_from')
        end_date = self._parse_date(params.get('date_to'), 'date_to')
        if start_date and end_date and start_date > end_date:
            raise ValidationError({'date_to': 'A data final deve ser igual ou posterior à data inicial.'})
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        return queryset.order_by('-created_at')

    @staticmethod
    def _parse_date(value, parameter):
        if not value:
            return None
        parsed = parse_date(value)
        if parsed is None:
            raise ValidationError({parameter: 'Use uma data válida no formato AAAA-MM-DD.'})
        return parsed
