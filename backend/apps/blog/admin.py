from django.contrib import admin
from .models import BlogPost, NewsletterCampaign, NewsletterCampaignDelivery

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'is_published', 'published_at')
    prepopulated_fields = {'slug': ('title',)}

    def save_model(self, request, obj, form, change):
        was_published = (
            BlogPost.objects.filter(pk=obj.pk, is_published=True).exists()
            if change else False
        )
        super().save_model(request, obj, form, change)
        if obj.is_published and not was_published:
            from .newsletter import queue_blog_post_newsletter

            queue_blog_post_newsletter(
                obj,
                request.user,
                trigger=NewsletterCampaign.Trigger.PUBLICATION,
            )


@admin.register(NewsletterCampaign)
class NewsletterCampaignAdmin(admin.ModelAdmin):
    list_display = ('post_title', 'trigger', 'status', 'recipient_count', 'sent_count', 'failed_count', 'created_at')
    list_filter = ('trigger', 'status', 'created_at')
    readonly_fields = (
        'post', 'post_title', 'post_slug', 'post_excerpt', 'trigger', 'status',
        'recipient_count', 'sent_count', 'failed_count', 'requested_by_email',
        'completed_at', 'created_at', 'updated_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(NewsletterCampaignDelivery)
class NewsletterCampaignDeliveryAdmin(admin.ModelAdmin):
    list_display = ('email', 'campaign', 'status', 'sent_at')
    list_filter = ('status', 'created_at')
    readonly_fields = ('campaign', 'subscription', 'email', 'status', 'sent_at', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
