"""Restores historical 8% platform fees to a store's payout wallet once."""
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.orders.models import Order
from apps.stores.models import Store
from apps.wallet.models import WalletTransaction
from apps.wallet.services import credit, get_wallet


class Command(BaseCommand):
    help = 'Credita uma única vez ao vendedor as taxas históricas de plataforma removidas.'

    def add_arguments(self, parser):
        parser.add_argument('store', help='UUID ou slug da loja.')
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Executa a correção. Sem esta opção, faz apenas uma simulação.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        store_value = options['store'].strip()
        store = None
        try:
            store = Store.objects.select_related('owner').filter(
                id=uuid.UUID(store_value)
            ).first()
        except ValueError:
            pass
        if not store:
            store = Store.objects.select_related('owner').filter(
                slug=store_value
            ).first()
        if not store:
            raise CommandError('Loja não encontrada pelo UUID ou slug informado.')

        orders = list(
            Order.objects.select_for_update()
            .filter(
                store=store,
                payment_status='completed',
            )
            .exclude(status__in=['cancelled', 'refunded'])
            .order_by('created_at', 'order_number')
        )

        restoreable = []
        already_restored = []
        for order in orders:
            fee = Decimal(str(order.platform_fee or 0)).quantize(Decimal('0.01'))
            if fee <= 0:
                continue
            key = f'platform_fee_restore:{order.id}:credit'
            if WalletTransaction.objects.filter(idempotency_key=key).exists():
                already_restored.append((order, fee))
            else:
                restoreable.append((order, fee))

        total = sum((fee for _order, fee in restoreable), Decimal('0'))
        self.stdout.write(
            f'Loja: {store.name} ({store.id})'
        )
        self.stdout.write(f'Encomendas restauráveis: {len(restoreable)}')
        self.stdout.write(f'Encomendas já restauradas: {len(already_restored)}')
        self.stdout.write(f'Total a creditar: {total.quantize(Decimal("0.01"))} MZN')

        if not options['apply']:
            self.stdout.write(
                self.style.WARNING(
                    'Simulação concluída. Reexecute com --apply para creditar.'
                )
            )
            return

        wallet = get_wallet(store.owner)
        credited = Decimal('0')
        for order, fee in restoreable:
            key = f'platform_fee_restore:{order.id}:credit'
            credit(
                wallet,
                fee,
                kind='payout',
                ref_type='order',
                ref_id=order.id,
                description=(
                    f'Restauro da taxa histórica de plataforma da encomenda '
                    f'{order.order_number}'
                ),
                txn_type='sale',
                idempotency_key=key,
                counterparty='platform',
            )
            order.platform_fee = Decimal('0')
            order.save(update_fields=['platform_fee'])
            credited += fee

        for order, _fee in already_restored:
            order.platform_fee = Decimal('0')
            order.save(update_fields=['platform_fee'])

        self.stdout.write(
            self.style.SUCCESS(
                f'Correção concluída: {credited.quantize(Decimal("0.01"))} MZN creditados '
                f'e {len(already_restored)} encomendas já idempotentes normalizadas.'
            )
        )
