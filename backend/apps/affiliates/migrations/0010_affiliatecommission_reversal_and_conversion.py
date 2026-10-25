import django.db.models.deletion
from django.db import migrations, models


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
    ]
