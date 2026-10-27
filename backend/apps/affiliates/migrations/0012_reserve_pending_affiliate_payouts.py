from django.db import migrations, models


def reserve_existing_payouts(apps, schema_editor):
    AffiliatePayout = apps.get_model('affiliates', 'AffiliatePayout')
    Wallet = apps.get_model('wallet', 'Wallet')
    db_alias = schema_editor.connection.alias

    active_payouts = AffiliatePayout.objects.using(db_alias).filter(
        status__in=('pending', 'approved'),
    ).values('affiliate__user_id')
    totals = {}
    for payout in active_payouts:
        user_id = payout['affiliate__user_id']
        totals[user_id] = totals.get(user_id, 0) + payout.amount

    for user_id, amount in totals.items():
        wallet, _ = Wallet.objects.using(db_alias).get_or_create(user_id=user_id)
        Wallet.objects.using(db_alias).filter(pk=wallet.pk).update(
            reserved_balance=models.F('reserved_balance') + amount,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('affiliates', '0011_backfill_affiliate_conversions'),
        ('affiliates', '0011_manual_payout_fee_and_reference'),
        ('wallet', '0007_payout_fee_breakdown'),
    ]

    operations = [
        migrations.RunPython(reserve_existing_payouts, migrations.RunPython.noop),
    ]
