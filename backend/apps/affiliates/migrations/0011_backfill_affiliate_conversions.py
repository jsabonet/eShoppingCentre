from django.db import migrations, models


def backfill_paid_conversions(apps, schema_editor):
    AffiliateCommission = apps.get_model('affiliates', 'AffiliateCommission')
    AffiliateLink = apps.get_model('affiliates', 'AffiliateLink')
    AffiliateProfile = apps.get_model('affiliates', 'AffiliateProfile')
    db_alias = schema_editor.connection.alias
    commissions = AffiliateCommission.objects.using(db_alias).all()
    eligible = commissions.filter(
        status__in=['pending', 'approved', 'paid'],
        order__payment_status='completed',
    )

    for commission in commissions.filter(affiliate_link__isnull=True).exclude(
        product_id__isnull=True,
    ).iterator():
        link = AffiliateLink.objects.using(db_alias).filter(
            affiliate_id=commission.affiliate_id,
            product_id=commission.product_id,
        ).order_by('created_at', 'pk').first()
        if link:
            AffiliateCommission.objects.using(db_alias).filter(
                pk=commission.pk,
            ).update(affiliate_link_id=link.pk)

    eligible.update(conversion_recorded=True)
    AffiliateProfile.objects.using(db_alias).all().update(total_sales=0)
    for affiliate_id, total in eligible.values(
        'affiliate_id',
    ).annotate(total=models.Count('pk')).values_list('affiliate_id', 'total'):
        AffiliateProfile.objects.using(db_alias).filter(pk=affiliate_id).update(
            total_sales=total,
        )
    for link in AffiliateLink.objects.using(db_alias).all().iterator():
        conversions = eligible.filter(affiliate_link_id=link.pk).count()
        if link.conversions != conversions:
            AffiliateLink.objects.using(db_alias).filter(pk=link.pk).update(
                conversions=conversions,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('affiliates', '0010_affiliatecommission_reversal_and_conversion'),
    ]

    operations = [
        migrations.RunPython(backfill_paid_conversions, migrations.RunPython.noop),
    ]
