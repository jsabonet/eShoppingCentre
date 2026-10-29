"""Read-only inventory of orders connected through payment transactions."""
import hashlib
import json
import uuid

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.stores.models import Store
from apps.wallet.models import PayoutRequest, Wallet, WalletEntry, WalletTransaction


def _connected_order_ids(seed_order_ids):
    order_ids = set(seed_order_ids)
    transaction_ids = set()

    while True:
        transactions = PaymentTransaction.objects.filter(
            Q(order_id__in=order_ids) | Q(orders__id__in=order_ids)
        ).distinct()
        transaction_ids.update(transactions.values_list('id', flat=True))

        linked_order_ids = set(
            transactions.exclude(order_id__isnull=True)
            .values_list('order_id', flat=True)
        )
        if transaction_ids:
            linked_order_ids.update(
                Order.objects.filter(payment_attempts__id__in=transaction_ids)
                .values_list('id', flat=True)
            )

        new_order_ids = linked_order_ids - order_ids
        if not new_order_ids:
            return order_ids, transaction_ids
        order_ids.update(new_order_ids)


class Command(BaseCommand):
    help = 'Inventaria encomendas e transações ligadas às lojas, sem alterar dados.'

    def add_arguments(self, parser):
        parser.add_argument(
            'store_ids',
            nargs='+',
            help='UUIDs das lojas selecionadas para revisão.',
        )

    def handle(self, *args, **options):
        try:
            requested_ids = list(dict.fromkeys(
                uuid.UUID(value) for value in options['store_ids']
            ))
        except ValueError as exc:
            raise CommandError('Todos os IDs de loja devem ser UUIDs válidos.') from exc

        stores = list(
            Store.objects.filter(id__in=requested_ids)
            .select_related('owner')
            .order_by('name', 'id')
        )
        found_ids = {store.id for store in stores}
        missing_ids = [str(value) for value in requested_ids if value not in found_ids]
        if missing_ids:
            raise CommandError(
                'Loja(s) não encontrada(s): ' + ', '.join(missing_ids)
            )

        store_ids = {store.id for store in stores}
        seed_orders = Order.objects.filter(
            Q(store_id__in=store_ids)
            | Q(items__product__store_id__in=store_ids)
        ).distinct()
        seed_order_ids = set(seed_orders.values_list('id', flat=True))
        order_ids, transaction_ids = _connected_order_ids(seed_order_ids)
        affected_orders = list(
            Order.objects.filter(id__in=order_ids)
            .select_related('store', 'buyer')
            .order_by('order_number', 'id')
        )
        transactions = list(
            PaymentTransaction.objects.filter(id__in=transaction_ids)
            .prefetch_related('orders')
            .order_by('id')
        )
        owner_ids = {store.owner_id for store in stores}

        affected_order_rows = [
            {
                'id': str(order.id),
                'order_number': order.order_number,
                'store_id': str(order.store_id) if order.store_id else None,
                'store_name': order.store_name or (
                    order.store.name if order.store_id else None
                ),
                'buyer_id': str(order.buyer_id),
                'buyer_is_selected_store_owner': order.buyer_id in owner_ids,
                'is_directly_tied_to_selected_store': order.id in seed_order_ids,
                'status': order.status,
                'payment_method': order.payment_method,
                'payment_status': order.payment_status,
                'total': str(order.total),
            }
            for order in affected_orders
        ]
        transaction_rows = [
            {
                'id': str(transaction.id),
                'provider': transaction.provider,
                'status': transaction.status,
                'amount': str(transaction.amount),
                'currency': transaction.currency,
                'direct_order_id': (
                    str(transaction.order_id) if transaction.order_id else None
                ),
                'linked_order_ids': sorted(
                    str(order_id) for order_id in transaction.orders.values_list(
                        'id', flat=True
                    )
                ),
            }
            for transaction in transactions
        ]
        owner_financial_rows = []
        for owner_id in sorted(owner_ids, key=str):
            wallet = Wallet.objects.filter(user_id=owner_id).first()
            owner_financial_rows.append({
                'owner_id': str(owner_id),
                'wallet_exists': wallet is not None,
                'wallet_has_nonzero_balances': bool(wallet and any((
                    wallet.balance,
                    wallet.payout_balance,
                    wallet.reserved_balance,
                    wallet.total_earned,
                    wallet.total_withdrawn,
                ))),
                'wallet_transaction_count': WalletTransaction.objects.filter(
                    wallet__user_id=owner_id
                ).count(),
                'wallet_ledger_entry_count': WalletEntry.objects.filter(
                    wallet__user_id=owner_id
                ).count(),
                'payout_request_count': PayoutRequest.objects.filter(
                    user_id=owner_id
                ).count(),
            })

        scope_for_hash = {
            'store_ids': sorted(str(value) for value in store_ids),
            'order_ids': sorted(str(value) for value in order_ids),
            'payment_transaction_ids': sorted(
                str(value) for value in transaction_ids
            ),
            'owner_ids': sorted(str(value) for value in owner_ids),
        }
        canonical_scope = json.dumps(
            scope_for_hash, sort_keys=True, separators=(',', ':')
        ).encode('utf-8')
        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'mode': 'read_only_impact_inventory',
            'read_only': True,
            'mutations_performed': False,
            'store_count': len(stores),
            'direct_store_order_count': len(seed_order_ids),
            'connected_order_count': len(order_ids),
            'connected_external_order_count': len(order_ids - seed_order_ids),
            'connected_payment_transaction_count': len(transaction_ids),
            'affected_buyer_count': len({
                order.buyer_id for order in affected_orders
            }),
            'impact_sha256': hashlib.sha256(canonical_scope).hexdigest(),
            'stores': [
                {
                    'id': str(store.id),
                    'name': store.name,
                    'owner_id': str(store.owner_id),
                    'owner_account_preserved': True,
                }
                for store in stores
            ],
            'owner_financial_data': owner_financial_rows,
            'affected_orders': affected_order_rows,
            'connected_payment_transactions': transaction_rows,
            'important_notes': [
                'Este comando é somente de leitura; não elimina nem atualiza registos.',
                'Encomendas e transações são seguidas recursivamente até fechar todas as ligações.',
                'A lista inclui encomendas externas ligadas por tentativas de pagamento partilhadas.',
                'As contas dos proprietários são preservadas; dados financeiros são apenas inventariados.',
                'O hash identifica os IDs de lojas, encomendas, transações e proprietários deste relatório.',
            ],
        }
        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
