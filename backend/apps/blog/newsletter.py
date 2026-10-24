from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.blog.models import (
    NewsletterCampaign,
    NewsletterCampaignDelivery,
    NewsletterSubscription,
)


def queue_blog_post_newsletter(post, requested_by, trigger):
    if not post.is_published:
        raise ValidationError({'detail': 'Só é possível notificar sobre um artigo publicado.'})

    if trigger == NewsletterCampaign.Trigger.PUBLICATION:
        existing = NewsletterCampaign.objects.filter(
            post=post,
            trigger=NewsletterCampaign.Trigger.PUBLICATION,
        ).first()
        if existing:
            return existing, False

    try:
        with transaction.atomic():
            campaign = NewsletterCampaign.objects.create(
                post=post,
                post_title=post.title,
                post_slug=post.slug,
                post_excerpt=post.excerpt,
                trigger=trigger,
                requested_by_email=getattr(requested_by, 'email', ''),
            )
            subscriptions = list(
                NewsletterSubscription.objects.filter(is_active=True).only('id', 'email')
            )
            NewsletterCampaignDelivery.objects.bulk_create([
                NewsletterCampaignDelivery(
                    campaign=campaign,
                    subscription=subscription,
                    email=subscription.email,
                )
                for subscription in subscriptions
            ])
            campaign.recipient_count = len(subscriptions)
            if subscriptions:
                campaign.save(update_fields=['recipient_count', 'updated_at'])
                transaction.on_commit(lambda: _dispatch_newsletter_campaign(campaign.id))
            else:
                campaign.status = NewsletterCampaign.Status.SENT
                campaign.completed_at = timezone.now()
                campaign.save(update_fields=['recipient_count', 'status', 'completed_at', 'updated_at'])
            return campaign, True
    except IntegrityError:
        if trigger != NewsletterCampaign.Trigger.PUBLICATION:
            raise
        campaign = NewsletterCampaign.objects.filter(
            post=post, trigger=NewsletterCampaign.Trigger.PUBLICATION,
        ).first()
        if campaign is None:
            raise
        return campaign, False


def _dispatch_newsletter_campaign(campaign_id):
    from apps.notifications import email_service
    from apps.blog.tasks import send_blog_newsletter_campaign

    email_service.dispatch(
        send_blog_newsletter_campaign,
        str(campaign_id),
    )
