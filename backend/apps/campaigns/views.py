from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BannerCampaign, CampaignAudit
from .serializers import BannerCampaignSerializer, CampaignAuditSerializer


def _campaign_snapshot(campaign):
    return {
        'internal_name': campaign.internal_name,
        'image': campaign.image.name if campaign.image else '',
        'mobile_image': campaign.mobile_image.name if campaign.mobile_image else '',
        'alt_text': campaign.alt_text,
        'title': campaign.title,
        'subtitle': campaign.subtitle,
        'cta': campaign.cta,
        'target_url': campaign.target_url,
        'starts_at': campaign.starts_at.isoformat(),
        'ends_at': campaign.ends_at.isoformat(),
        'priority': campaign.priority,
        'position': campaign.position,
        'status': campaign.state,
    }


class ActiveBannerCampaignListView(generics.ListAPIView):
    serializer_class = BannerCampaignSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        now = timezone.now()
        return BannerCampaign.objects.filter(
            position=BannerCampaign.Position.HOMEPAGE_HERO,
            state=BannerCampaign.State.ACTIVE,
            starts_at__lte=now,
            ends_at__gt=now,
        ).order_by('-priority', 'starts_at', 'created_at')


class AdminBannerCampaignListCreateView(generics.ListCreateAPIView):
    serializer_class = BannerCampaignSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = BannerCampaign.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        campaign_status = self.request.query_params.get('status', '').strip()
        search = self.request.query_params.get('search', '').strip()
        if campaign_status in ALLOWED_ADMIN_STATUSES:
            queryset = queryset.filter(state=campaign_status)
        if search:
            queryset = queryset.filter(internal_name__icontains=search)
        return queryset.order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        campaign = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        CampaignAudit.objects.create(
            campaign_id=campaign.id,
            campaign_name=campaign.internal_name,
            action='created',
            changes={'after': _campaign_snapshot(campaign)},
            actor=self.request.user,
        )


ALLOWED_ADMIN_STATUSES = {
    choice[0] for choice in BannerCampaign.State.choices
}


class AdminBannerCampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BannerCampaignSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = BannerCampaign.objects.all()

    @transaction.atomic
    def perform_update(self, serializer):
        campaign = serializer.instance
        before = _campaign_snapshot(campaign)
        campaign = serializer.save(updated_by=self.request.user)
        after = _campaign_snapshot(campaign)
        changes = {
            key: {'before': before[key], 'after': after[key]}
            for key in before
            if before[key] != after[key]
        }
        if changes:
            CampaignAudit.objects.create(
                campaign_id=campaign.id,
                campaign_name=campaign.internal_name,
                action='updated',
                changes=changes,
                actor=self.request.user,
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        CampaignAudit.objects.create(
            campaign_id=instance.id,
            campaign_name=instance.internal_name,
            action='deleted',
            changes={'before': _campaign_snapshot(instance)},
            actor=self.request.user,
        )
        instance.delete()


class AdminBannerCampaignActivateNowView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, pk):
        campaign = get_object_or_404(
            BannerCampaign.objects.select_for_update(),
            pk=pk,
        )
        now = timezone.now()
        if campaign.ends_at <= now:
            return Response(
                {'ends_at': ['A data de fim já passou. Edite a campanha antes de ativá-la.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        before = _campaign_snapshot(campaign)
        campaign.state = BannerCampaign.State.ACTIVE
        campaign.starts_at = now
        campaign.updated_by = request.user
        campaign.save(update_fields=['state', 'starts_at', 'updated_by', 'updated_at'])
        after = _campaign_snapshot(campaign)
        CampaignAudit.objects.create(
            campaign_id=campaign.id,
            campaign_name=campaign.internal_name,
            action='activated',
            changes={
                key: {'before': before[key], 'after': after[key]}
                for key in before
                if before[key] != after[key]
            },
            actor=request.user,
        )
        return Response(BannerCampaignSerializer(
            campaign,
            context={'request': request},
        ).data)


class AdminBannerCampaignHistoryView(generics.ListAPIView):
    serializer_class = CampaignAuditSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return CampaignAudit.objects.filter(
            campaign_id=self.kwargs['campaign_id']
        ).select_related('actor').order_by('-created_at')


class BannerCampaignMetricView(APIView):
    permission_classes = [permissions.AllowAny]
    http_method_names = ['post', 'options']

    def post(self, request, campaign_id, metric):
        if metric not in {'view', 'click'}:
            return Response(
                {'detail': 'Métrica inválida.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        now = timezone.now()
        field = 'view_count' if metric == 'view' else 'click_count'
        updated = BannerCampaign.objects.filter(
            id=campaign_id,
            state=BannerCampaign.State.ACTIVE,
            starts_at__lte=now,
            ends_at__gt=now,
        ).update(**{field: F(field) + 1})
        if not updated:
            return Response(
                {'detail': 'Campanha não encontrada ou inativa.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
