import django.db.models.deletion
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
        ('affiliates', '0009_affiliatepayout_fee_alter_affiliatepayout_amount'),
    ]

    operations = [
        migrations.AddField(
            model_name='affiliatecommission',
            name='reversed_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='affiliatecommission',
            name='conversion_recorded',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='affiliatecommission',
            name='unrecovered_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='affiliatecommission',
            name='affiliate_link',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='commissions',
                to='affiliates.affiliatelink',
            ),
        ),
        migrations.RunPython(backfill_paid_conversions, migrations.RunPython.noop),
    ]
