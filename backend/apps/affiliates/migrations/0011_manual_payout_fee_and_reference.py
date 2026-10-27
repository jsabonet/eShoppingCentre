import django.db.models.deletion
from django.db import migrations, models


def set_default_payout_fee(apps, schema_editor):
    AffiliateSettings = apps.get_model('affiliates', 'AffiliateSettings')
    AffiliateSettings.objects.all().update(payout_fee_percent=5)


class Migration(migrations.Migration):

    dependencies = [
        ('affiliates', '0010_affiliatecommission_reversal_and_conversion'),
    ]

    operations = [
        migrations.AddField(
            model_name='affiliatepayout',
            name='paid_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='paid_affiliate_payouts',
                to='users.user',
            ),
        ),
        migrations.AddField(
            model_name='affiliatepayout',
            name='admin_reference',
            field=models.CharField(
                blank=True,
                help_text='Referência da transferência manual',
                max_length=255,
            ),
        ),
        migrations.AlterField(
            model_name='affiliatesettings',
            name='payout_fee_percent',
            field=models.DecimalField(
                decimal_places=2,
                default=5,
                help_text='Taxa da plataforma sobre cada saque (%)',
                max_digits=5,
            ),
        ),
        migrations.RunPython(set_default_payout_fee, migrations.RunPython.noop),
    ]
