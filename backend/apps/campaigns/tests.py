from io import BytesIO
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from .models import BannerCampaign, CampaignAudit
from .serializers import BannerCampaignSerializer


class BannerCampaignApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()
        self.active = BannerCampaign.objects.create(
            internal_name='Campanha activa',
            image='campaigns/active.jpg',
            alt_text='Promoção',
            target_url='/category/moda',
            starts_at=self.now - timedelta(hours=1),
            ends_at=self.now + timedelta(hours=1),
            state=BannerCampaign.State.ACTIVE,
            priority=1,
        )
        self.scheduled = BannerCampaign.objects.create(
            internal_name='Campanha agendada',
            image='campaigns/scheduled.jpg',
            alt_text='Brevemente',
            target_url='/category/moda',
            starts_at=self.now + timedelta(hours=1),
            ends_at=self.now + timedelta(hours=2),
            state=BannerCampaign.State.ACTIVE,
            priority=10,
        )
        BannerCampaign.objects.create(
            internal_name='Campanha pausada',
            image='campaigns/paused.jpg',
            alt_text='Pausada',
            target_url='/category/moda',
            starts_at=self.now - timedelta(hours=1),
            ends_at=self.now + timedelta(hours=1),
            state=BannerCampaign.State.PAUSED,
            priority=20,
        )
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='campaign-admin@example.com',
            username='campaign-admin',
            password='SecurePassword123!',
        )
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

    def test_public_endpoint_returns_all_currently_active_campaigns_by_priority(self):
        highest_priority = BannerCampaign.objects.create(
            internal_name='Campanha prioritária',
            image='campaigns/priority.jpg',
            alt_text='Campanha prioritária',
            target_url='/category/eletronicos',
            starts_at=self.now - timedelta(minutes=10),
            ends_at=self.now + timedelta(hours=1),
            state=BannerCampaign.State.ACTIVE,
            priority=2,
        )
        response = self.client.get('/api/v1/campaigns/active/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['id'] for item in response.data],
            [str(highest_priority.id), str(self.active.id)],
        )
        self.assertEqual(response.data[0]['target_url'], '/category/eletronicos')

    def test_admin_can_activate_campaign_immediately(self):
        self.client.force_authenticate(self.admin)
        starts_at_before = self.scheduled.starts_at

        response = self.client.post(
            f'/api/v1/campaigns/admin/{self.scheduled.id}/activate-now/'
        )

        self.scheduled.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.scheduled.state, BannerCampaign.State.ACTIVE)
        self.assertLess(self.scheduled.starts_at, starts_at_before)
        self.assertLessEqual(self.scheduled.starts_at, timezone.now())
        audit = CampaignAudit.objects.get(campaign_id=self.scheduled.id)
        self.assertEqual(audit.action, 'activated')
        self.assertIn('starts_at', audit.changes)

    def test_admin_cannot_activate_campaign_after_its_end_date(self):
        self.client.force_authenticate(self.admin)
        self.scheduled.ends_at = self.now - timedelta(minutes=1)
        self.scheduled.save(update_fields=['ends_at'])

        response = self.client.post(
            f'/api/v1/campaigns/admin/{self.scheduled.id}/activate-now/'
        )

        self.scheduled.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertGreater(self.scheduled.starts_at, timezone.now())
        self.assertFalse(CampaignAudit.objects.filter(
            campaign_id=self.scheduled.id,
            action='activated',
        ).exists())

    def test_metric_endpoint_increments_only_for_active_campaigns(self):
        response = self.client.post(
            f'/api/v1/campaigns/metrics/{self.active.id}/view/'
        )
        inactive_response = self.client.post(
            f'/api/v1/campaigns/metrics/{self.scheduled.id}/click/'
        )

        self.active.refresh_from_db()
        self.assertEqual(response.status_code, 204)
        self.assertEqual(inactive_response.status_code, 404)
        self.assertEqual(self.active.view_count, 1)

    def test_admin_can_pause_campaign_and_history_records_change(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f'/api/v1/campaigns/admin/{self.active.id}/',
            {'status': BannerCampaign.State.PAUSED},
            format='json',
        )

        self.active.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.active.state, BannerCampaign.State.PAUSED)
        audit = CampaignAudit.objects.get(campaign_id=self.active.id)
        self.assertEqual(audit.action, 'updated')
        self.assertEqual(audit.changes['status']['before'], 'active')
        self.assertEqual(audit.changes['status']['after'], 'paused')

    def test_non_admin_cannot_manage_campaigns(self):
        response = self.client.get('/api/v1/campaigns/admin/')

        self.assertEqual(response.status_code, 401)

    def test_banner_upload_is_validated_and_optimized_to_webp(self):
        image_buffer = BytesIO()
        Image.new('RGB', (12, 8), color='blue').save(image_buffer, format='PNG')
        image_buffer.seek(0)
        serializer = BannerCampaignSerializer(data={
            'internal_name': 'Banner optimizado',
            'image': SimpleUploadedFile(
                'banner.png',
                image_buffer.read(),
                content_type='image/png',
            ),
            'alt_text': 'Banner optimizado',
            'target_url': '/category/moda',
            'starts_at': self.now.isoformat(),
            'ends_at': (self.now + timedelta(days=1)).isoformat(),
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        optimized_image = serializer.validated_data['image']
        self.assertTrue(optimized_image.name.endswith('.webp'))
        self.assertEqual(optimized_image.content_type, 'image/webp')

    def test_campaign_rejects_reversed_period_and_unsafe_destination(self):
        reversed_period = BannerCampaignSerializer(
            instance=self.active,
            data={'ends_at': (self.now - timedelta(hours=2)).isoformat()},
            partial=True,
        )
        unsafe_destination = BannerCampaignSerializer(
            instance=self.active,
            data={'target_url': r'/\external.example'},
            partial=True,
        )

        self.assertFalse(reversed_period.is_valid())
        self.assertIn('ends_at', reversed_period.errors)
        self.assertFalse(unsafe_destination.is_valid())
        self.assertIn('target_url', unsafe_destination.errors)
