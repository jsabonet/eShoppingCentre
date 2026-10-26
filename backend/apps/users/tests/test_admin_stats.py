from datetime import date, datetime, time, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.users.views_admin import AdminStatsView

User = get_user_model()


@pytest.mark.django_db
def test_admin_stats_filters_counts_by_creation_date():
    admin = User.objects.create_superuser(
        email='admin-stats@example.com',
        username='admin-stats',
        password='SenhaForte123!',
    )
    included_user = User.objects.create_user(
        email='included-stats@example.com',
        username='included-stats',
        password='SenhaForte123!',
    )
    excluded_user = User.objects.create_user(
        email='excluded-stats@example.com',
        username='excluded-stats',
        password='SenhaForte123!',
    )
    today = timezone.localdate()
    included_date = today - timedelta(days=2)
    excluded_date = today - timedelta(days=10)
    User.objects.filter(pk=included_user.pk).update(
        date_joined=timezone.make_aware(datetime.combine(included_date, time(hour=12)))
    )
    User.objects.filter(pk=excluded_user.pk).update(
        date_joined=timezone.make_aware(datetime.combine(excluded_date, time(hour=12)))
    )

    request = APIRequestFactory().get('/api/v1/admin/stats/', {
        'date_from': (today - timedelta(days=3)).isoformat(),
        'date_to': today.isoformat(),
    })
    force_authenticate(request, user=admin)
    response = AdminStatsView.as_view()(request)

    assert response.status_code == 200
    assert response.data['total_users'] == 2
    assert response.data['date_from'] == (today - timedelta(days=3)).isoformat()
    assert response.data['date_to'] == today.isoformat()


@pytest.mark.django_db
def test_admin_stats_rejects_incomplete_or_reversed_period():
    admin = User.objects.create_superuser(
        email='admin-stats-validation@example.com',
        username='admin-stats-validation',
        password='SenhaForte123!',
    )
    view = AdminStatsView.as_view()

    incomplete = APIRequestFactory().get('/api/v1/admin/stats/', {'date_from': '2026-10-01'})
    force_authenticate(incomplete, user=admin)
    assert view(incomplete).status_code == 400

    reversed_range = APIRequestFactory().get('/api/v1/admin/stats/', {
        'date_from': '2026-10-20',
        'date_to': '2026-10-01',
    })
    force_authenticate(reversed_range, user=admin)
    assert view(reversed_range).status_code == 400
