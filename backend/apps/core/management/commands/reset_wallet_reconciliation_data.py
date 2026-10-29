"""Reset source data used by the admin withdrawals and reconciliation report."""
import hashlib
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import DEFAULT_DB_ALIAS, transaction
from django.db.models import Sum
from django.db.models.deletion import Collector
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission, AffiliatePayout
from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.wallet.models import (
    EscrowHolding,
    PayoutRequest,
    Wallet,
    WalletEntry,
    WalletTransaction,
)

WALLET_FIELDS_TO_ZERO = (
    'balance',
    'payout_balance',
    'reserved_balance',
    'total_earned',
    'total_withdrawn',
)


def _build_plan(using):
    collector = Collector(using=using)
    roots = (
        Order.objects.using(using).all(),
        PaymentTransaction.objects.using(using).all(),
        AffiliateCommission.objects.using(using).all(),
        AffiliatePayout.objects.using(using).all(),
        PayoutRequest.objects.using(using).all(),
        WalletTransaction.objects.using(using).all(),
        WalletEntry.objects.using(using).all(),
        EscrowHolding.objects.using(using).all(),
    )
    for queryset in roots:
        collector.collect(queryset)

    objects_by_model = {
        model: {obj.pk: obj for obj in objects}
        for model, objects in collector.data.items()
    }
    for queryset in collector.fast_deletes:
        objects = objects_by_model.setdefault(queryset.model, {})
        for obj in queryset.iterator():
            objects[obj.pk] = obj

    rows_by_model = {
        model._meta.label_lower: sorted(str(pk) for pk in objects)
        for model, objects in objects_by_model.items()
    }
    wallet_rows = list(
        Wallet.objects.using(using).order_by('pk').values(
            'pk',
            *WALLET_FIELDS_TO_ZERO,
        )
    )
    wallet_manifest = [
        {
            'id': str(row['pk']),
            **{
                field: str(row[field])
                for field in WALLET_FIELDS_TO_ZERO
            },
        }
        for row in wallet_rows
    ]
    canonical = json.dumps({
        'rows': rows_by_model,
        'wallets': wallet_manifest,
    }, sort_keys=True, separators=(',', ':')).encode('utf-8')

    completed_orders = Order.objects.using(using).filter(
        payment_status='completed'
    )
    return {
        'collector': collector,
        'rows_by_model': rows_by_model,
        'wallet_rows': wallet_rows,
        'impact_sha256': hashlib.sha256(canonical).hexdigest(),
        'order_count': Order.objects.using(using).count(),
        'completed_order_count': completed_orders.count(),
        'completed_order_total': (
            completed_orders.aggregate(value=Sum('total'))['value'] or 0
        ),
        'payment_transaction_count': PaymentTransaction.objects.using(using).count(),
        'wallet_transaction_count': WalletTransaction.objects.using(using).count(),
        'wallet_entry_count': WalletEntry.objects.using(using).count(),
    }


class Command(BaseCommand):
    help = (
        'Apaga os dados que alimentam Saques & Reconciliação e zera os saldos '
        'das carteiras. Por padrão apenas apresenta um plano.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Executa a eliminação; sem esta opção apenas apresenta o plano.',
        )
        parser.add_argument(
            '--confirm-impact',
            help='SHA-256 do plano de eliminação revisto.',
        )
        parser.add_argument(
            '--backup-verified',
            action='store_true',
            help='Confirma que existe um backup válido e restaurável.',
        )
        parser.add_argument(
            '--confirm-financial-history-erasure',
            action='store_true',
            help='Confirma a eliminação irreversível do histórico financeiro.',
        )

    def handle(self, *args, **options):
        execute = options['execute']
        if execute and not options['backup_verified']:
            raise CommandError(
                'Crie e verifique um backup restaurável antes de executar; '
                'informe --backup-verified.'
            )
        if execute and not options['confirm_financial_history_erasure']:
            raise CommandError(
                'A execução exige --confirm-financial-history-erasure, pois '
                'remove histórico financeiro e zera saldos.'
            )
        if execute and not options['confirm_impact']:
            raise CommandError(
                'A execução exige --confirm-impact com o SHA-256 do dry-run.'
            )

        using = DEFAULT_DB_ALIAS
        with transaction.atomic(using=using):
            plan = _build_plan(using)
            if execute and plan['impact_sha256'] != options['confirm_impact']:
                raise CommandError(
                    'O plano mudou desde o dry-run. Nenhuma alteração foi '
                    'confirmada; gere e reveja um novo plano.'
                )
            if execute:
                execution_plan = _build_plan(using)
                if execution_plan['impact_sha256'] != plan['impact_sha256']:
                    raise CommandError(
                        'O plano mudou durante a validação. Nenhuma alteração '
                        'foi confirmada; gere e reveja um novo plano.'
                    )
                plan = execution_plan
                plan['collector'].delete()
                Wallet.objects.using(using).update(**{
                    field: 0 for field in WALLET_FIELDS_TO_ZERO
                })

        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': using,
            'mode': 'executed' if execute else 'dry_run',
            'read_only': not execute,
            'mutations_performed': execute,
            'impact_sha256': plan['impact_sha256'],
            'deletion_manifest': {
                model: len(ids)
                for model, ids in sorted(plan['rows_by_model'].items())
            },
            'wallet_rows_to_zero': len(plan['wallet_rows']),
            'orders': {
                'all_records': plan['order_count'],
                'payment_completed': plan['completed_order_count'],
                'completed_total_mzn': str(plan['completed_order_total']),
            },
            'payment_transaction_count': plan['payment_transaction_count'],
            'wallet_transaction_count': plan['wallet_transaction_count'],
            'wallet_entry_count': plan['wallet_entry_count'],
            'preserved': [
                'user accounts',
                'store and product records, except records deleted by declared FK cascades',
                'wallet records (their monetary fields are set to zero)',
            ],
            'warning': (
                'Esta operação apaga encomendas, pagamentos e histórico de '
                'saques/comissões em todos os períodos. Não é um reset de '
                'contadores independentes e não pode ser desfeito pela aplicação.'
            ),
        }
        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
