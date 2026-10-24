import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.blog.models import NewsletterCampaign, NewsletterCampaignDelivery, NewsletterSubscription
from apps.notifications.email_service import send_templated

logger = logging.getLogger(__name__)


@shared_task
def send_blog_newsletter_campaign(campaign_id):
    campaign = NewsletterCampaign.objects.filter(id=campaign_id).first()
    if campaign is None or campaign.status in {
        NewsletterCampaign.Status.SENT,
        NewsletterCampaign.Status.PARTIAL,
        NewsletterCampaign.Status.FAILED,
    }:
        return

    NewsletterCampaign.objects.filter(
        id=campaign_id,
        status=NewsletterCampaign.Status.QUEUED,
    ).update(status=NewsletterCampaign.Status.SENDING)

    deliveries = NewsletterCampaignDelivery.objects.filter(
        campaign_id=campaign_id,
        status=NewsletterCampaignDelivery.Status.QUEUED,
    ).select_related('subscription')
    for delivery in deliveries.iterator():
        claimed = NewsletterCampaignDelivery.objects.filter(
            id=delivery.id,
            status=NewsletterCampaignDelivery.Status.QUEUED,
        ).update(status=NewsletterCampaignDelivery.Status.SENDING)
        if not claimed:
            continue

        subscription = delivery.subscription
        if subscription is None or not NewsletterSubscription.objects.filter(
            id=subscription.id,
            is_active=True,
        ).exists():
            NewsletterCampaignDelivery.objects.filter(id=delivery.id).update(
                status=NewsletterCampaignDelivery.Status.SKIPPED,
            )
            continue

        unsubscribe_url = (
            f'{settings.SITE_URL.rstrip("/")}/newsletter/unsubscribe'
            f'?token={subscription.unsubscribe_token}'
        )
        article_url = f'{settings.SITE_URL.rstrip("/")}/blog/{campaign.post_slug}'
        try:
            send_templated(
                subject=f'Novidade no blog: {campaign.post_title}',
                template_name='newsletter_blog_post.html',
                recipient=delivery.email,
                text_message=(
                    f'{campaign.post_title}\n\n{campaign.post_excerpt}\n\n'
                    f'Ler artigo: {article_url}\n'
                    f'Cancelar subscrição: {unsubscribe_url}'
                ),
                context={
                    'post_title': campaign.post_title,
                    'post_excerpt': campaign.post_excerpt,
                    'article_url': article_url,
                    'unsubscribe_url': unsubscribe_url,
                },
            )
        except Exception:
            logger.exception(
                'Falha no envio da campanha de newsletter %s (entrega %s).',
                campaign_id,
                delivery.id,
            )
            NewsletterCampaignDelivery.objects.filter(id=delivery.id).update(
                status=NewsletterCampaignDelivery.Status.FAILED,
            )
        else:
            NewsletterCampaignDelivery.objects.filter(id=delivery.id).update(
                status=NewsletterCampaignDelivery.Status.SENT,
                sent_at=timezone.now(),
            )

    sent_count = NewsletterCampaignDelivery.objects.filter(
        campaign_id=campaign_id,
        status=NewsletterCampaignDelivery.Status.SENT,
    ).count()
    failed_count = NewsletterCampaignDelivery.objects.filter(
        campaign_id=campaign_id,
        status=NewsletterCampaignDelivery.Status.FAILED,
    ).count()
    status = (
        NewsletterCampaign.Status.SENT if not failed_count
        else NewsletterCampaign.Status.PARTIAL if sent_count
        else NewsletterCampaign.Status.FAILED
    )
    NewsletterCampaign.objects.filter(id=campaign_id).update(
        sent_count=sent_count,
        failed_count=failed_count,
        status=status,
        completed_at=timezone.now(),
    )
