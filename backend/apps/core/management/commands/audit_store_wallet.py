"""Auditoria read-only de taxas, comissões, escrow e créditos de uma loja."""
import json
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission, AffiliatePayout, AffiliateProfile
from apps.orders.models import Order, OrderStatusHistory
from apps.payments.models import PaymentTransaction
from apps.stores.models import Store
from apps.wallet.models import EscrowHolding, PayoutRequest, Wallet, WalletEntry, WalletTransaction


def decimal(value):
    return str(Decimal(str(value or 0)).quantize(Decimal('0.01')))


def user_data(user):
    if not user:
        return None
    return {
        'id': str(user.id),
        'name': user.get_full_name() or '',
        'email': user.email,
        'is_verified': user.is_verified,
        'roles': user.roles if isinstance(user.roles, list) else [],
    }


class Command(BaseCommand):
    help = 'Audita taxas, comissões, carteira e créditos de uma loja sem alterar dados.'

    def add_arguments(self, parser):
        parser.add_argument('store', help='UUID ou slug da loja.')
        parser.add_argument(
            '--all-statuses',
            action='store_true',
            help='Inclui todas as encomendas da loja, não apenas pagamentos concluídos.',
        )
        parser.add_argument('--output', help='Caminho opcional para gravar o relatório em JSON.')

    def handle(self, *args, **options):
        store_value = options['store'].strip()
        store = None
        try:
            store = Store.objects.filter(id=uuid.UUID(store_value)).select_related('owner').first()
        except ValueError:
            pass
        if not store:
            store = Store.objects.filter(slug=store_value).select_related('owner').first()
        if not store:
            raise CommandError('Loja não encontrada pelo UUID ou slug informado.')

        orders = Order.objects.filter(store=store).select_related(
            'buyer', 'store', 'affiliate',
        ).prefetch_related(
            'items', 'transactions', 'escrow', 'status_history',
        ).order_by('-created_at')
        if not options['all_statuses']:
            orders = orders.filter(payment_status='completed')

        orders = list(orders)
        order_ids = [order.id for order in orders]
        owner = store.owner
        wallet = Wallet.objects.filter(user=owner).first()

        direct_payment_ids = set(
            PaymentTransaction.objects.filter(order_id__in=order_ids).values_list('id', flat=True)
        )
        m2m_payment_ids = set(
            PaymentTransaction.objects.filter(orders__id__in=order_ids).values_list('id', flat=True)
        )
        payment_transactions = list(
            PaymentTransaction.objects.filter(id__in=direct_payment_ids | m2m_payment_ids)
            .prefetch_related('orders')
            .order_by('-created_at')
        )

        order_rows = []
        gross_total = Decimal('0')
        platform_fee_total = Decimal('0')
        affiliate_fee_total = Decimal('0')
        seller_gross_total = Decimal('0')

        for order in orders:
            platform_fee = Decimal(str(order.platform_fee or 0))
            affiliate_commission = Decimal(str(order.affiliate_commission or 0))
            seller_formula = max(
                Decimal(str(order.total)) - platform_fee - affiliate_commission,
                Decimal('0'),
            )
            gross_total += Decimal(str(order.total))
            platform_fee_total += platform_fee
            affiliate_fee_total += affiliate_commission
            seller_gross_total += seller_formula

            escrow_rows = [
                {
                    'id': str(escrow.id),
                    'amount': decimal(escrow.amount),
                    'status': escrow.status,
                    'released_at': escrow.released_at.isoformat() if escrow.released_at else None,
                    'created_at': escrow.created_at.isoformat(),
                }
                for escrow in order.escrow.all()
            ]
            seller_transactions = list(
                WalletTransaction.objects.filter(
                    wallet__user=owner,
                    reference_type='order',
                    reference_id=order.id,
                ).select_related('wallet').order_by('created_at')
            )
            seller_sale_credit = sum(
                (Decimal(str(tx.amount)) for tx in seller_transactions if tx.type == 'sale'),
                Decimal('0'),
            )
            seller_refunds = list(
                WalletTransaction.objects.filter(
                    type='refund',
                    reference_type='order',
                    reference_id=order.id,
                    amount__gt=0,
                ).order_by('created_at')
            )
            commissions = list(
                AffiliateCommission.objects.filter(order=order)
                .select_related(
                    'affiliate__user', 'affiliate_link', 'product',
                ).order_by('created_at')
            )
            commission_rows = []
            for commission in commissions:
                commission_tx = list(
                    WalletTransaction.objects.filter(
                        wallet__user=commission.affiliate.user,
                        reference_type='affiliate_commission',
                        reference_id=commission.id,
                    ).order_by('created_at')
                )
                commission_rows.append({
                    'id': str(commission.id),
                    'affiliate': user_data(commission.affiliate.user),
                    'affiliate_profile_id': str(commission.affiliate.id),
                    'referral_code': commission.affiliate.referral_code,
                    'affiliate_link_id': str(commission.affiliate_link_id) if commission.affiliate_link_id else None,
                    'product_id': str(commission.product_id) if commission.product_id else None,
                    'product_name': commission.product.name if commission.product else None,
                    'commission_rate': decimal(commission.commission_rate),
                    'amount': decimal(commission.amount),
                    'reversed_amount': decimal(commission.reversed_amount),
                    'unrecovered_amount': decimal(commission.unrecovered_amount),
                    'net_payable': decimal(
                        max(
                            Decimal(str(commission.amount))
                            - Decimal(str(commission.reversed_amount)),
                            Decimal('0'),
                        )
                    ),
                    'status': commission.status,
                    'conversion_recorded': commission.conversion_recorded,
                    'created_at': commission.created_at.isoformat(),
                    'wallet_transactions': [
                        {
                            'id': str(tx.id),
                            'type': tx.type,
                            'amount': decimal(tx.amount),
                            'balance_before': decimal(tx.balance_before),
                            'balance_after': decimal(tx.balance_after),
                            'description': tx.description,
                            'status': tx.status,
                            'idempotency_key': tx.idempotency_key,
                            'created_at': tx.created_at.isoformat(),
                            'ledger_entries': [
                                {
                                    'id': str(entry.id),
                                    'direction': entry.direction,
                                    'amount': decimal(entry.amount),
                                    'balance_before': decimal(entry.balance_before),
                                    'balance_after': decimal(entry.balance_after),
                                    'kind': entry.kind,
                                    'counterparty': entry.counterparty,
                                }
                                for entry in WalletEntry.objects.filter(transaction=tx)
                            ],
                        }
                        for tx in commission_tx
                    ],
                })

            platform_rate = None
            if order.subtotal:
                platform_rate = (
                    platform_fee / Decimal(str(order.subtotal)) * Decimal('100')
                ).quantize(Decimal('0.01'))

            order_rows.append({
                'id': str(order.id),
                'order_number': order.order_number,
                'created_at': order.created_at.isoformat(),
                'status': order.status,
                'payment_status': order.payment_status,
                'payment_confirmed_at': order.payment_confirmed_at.isoformat() if order.payment_confirmed_at else None,
                'confirmed_at': order.confirmed_at.isoformat() if order.confirmed_at else None,
                'delivered_at': order.delivered_at.isoformat() if order.delivered_at else None,
                'payment_method': order.payment_method,
                'payment_id': order.payment_id,
                'buyer': user_data(order.buyer),
                'affiliate_on_order': user_data(order.affiliate),
                'items': [
                    {
                        'id': str(item.id),
                        'product_id': str(item.product_id) if item.product_id else None,
                        'product_name': item.product_name,
                        'quantity': item.quantity,
                        'unit_price': decimal(item.unit_price),
                        'total_price': decimal(item.total_price),
                        'product_type': item.product_type,
                    }
                    for item in order.items.all()
                ],
                'subtotal': decimal(order.subtotal),
                'shipping_cost': decimal(order.shipping_cost),
                'discount': decimal(order.discount),
                'coupon_code': order.coupon_code,
                'order_total': decimal(order.total),
                'platform_fee': decimal(platform_fee),
                'platform_fee_derived_rate_percent': decimal(platform_rate) if platform_rate is not None else None,
                'order_affiliate_commission': decimal(affiliate_commission),
                'calculated_seller_credit': decimal(seller_formula),
                'seller_sale_credit_transaction_total': decimal(seller_sale_credit),
                'seller_credit_difference': decimal(seller_formula - seller_sale_credit),
                'escrows': escrow_rows,
                'commissions': commission_rows,
                'buyer_refund_transactions': [
                    {
                        'id': str(tx.id),
                        'amount': decimal(tx.amount),
                        'balance_before': decimal(tx.balance_before),
                        'balance_after': decimal(tx.balance_after),
                        'description': tx.description,
                        'idempotency_key': tx.idempotency_key,
                        'created_at': tx.created_at.isoformat(),
                    }
                    for tx in seller_refunds
                ],
                'status_history': [
                    {
                        'previous_status': history.previous_status,
                        'new_status': history.new_status,
                        'changed_by': user_data(history.changed_by),
                        'notes': history.notes,
                        'created_at': history.created_at.isoformat(),
                    }
                    for history in OrderStatusHistory.objects.filter(order=order)
                    .select_related('changed_by').order_by('created_at')
                ],
                'payment_transactions': [
                    {
                        'id': str(tx.id),
                        'provider': tx.provider,
                        'status': tx.status,
                        'amount': decimal(tx.amount),
                        'currency': tx.currency,
                        'gateway_order_id': tx.gateway_order_id,
                        'provider_transaction_id': tx.provider_transaction_id,
                        'source_id': tx.source_id,
                        'idempotency_key': tx.idempotency_key,
                        'completed_at': tx.completed_at.isoformat() if tx.completed_at else None,
                        'error_message': tx.error_message,
                        'provider_response': tx.provider_response,
                    }
                    for tx in payment_transactions
                    if tx.order_id == order.id or order.id in tx.orders.values_list('id', flat=True)
                ],
            })

        seller_transactions = list(
            WalletTransaction.objects.filter(wallet__user=owner).order_by('-created_at')
            if wallet else []
        )
        seller_sale_transactions = [
            tx for tx in seller_transactions
            if tx.type == 'sale' and tx.reference_id in set(order_ids)
        ]
        seller_credit_total = sum(
            (Decimal(str(tx.amount)) for tx in seller_sale_transactions),
            Decimal('0'),
        )

        seller_payouts = list(
            PayoutRequest.objects.filter(user=owner).order_by('-created_at')
        )
        seller_payout_rows = [
            {
                'id': str(payout.id),
                'role': payout.role,
                'amount': decimal(payout.amount),
                'fee_percent': decimal(payout.fee_percent),
                'fee': decimal(payout.fee),
                'net_amount': decimal(payout.net_amount),
                'method': payout.method,
                'account_details': payout.account_details,
                'status': payout.status,
                'admin_reference': payout.admin_reference,
                'approved_by': user_data(payout.approved_by),
                'approved_at': payout.approved_at.isoformat() if payout.approved_at else None,
                'paid_by': user_data(payout.paid_by),
                'paid_at': payout.paid_at.isoformat() if payout.paid_at else None,
                'rejection_reason': payout.rejection_reason,
                'notes': payout.notes,
                'created_at': payout.created_at.isoformat(),
                'fee_transactions': [
                    {
                        'id': str(tx.id),
                        'amount': decimal(tx.amount),
                        'balance_before': decimal(tx.balance_before),
                        'balance_after': decimal(tx.balance_after),
                        'idempotency_key': tx.idempotency_key,
                        'description': tx.description,
                        'created_at': tx.created_at.isoformat(),
                        'ledger_entries': [
                            {
                                'id': str(entry.id),
                                'direction': entry.direction,
                                'amount': decimal(entry.amount),
                                'balance_before': decimal(entry.balance_before),
                                'balance_after': decimal(entry.balance_after),
                                'kind': entry.kind,
                                'counterparty': entry.counterparty,
                            }
                            for entry in WalletEntry.objects.filter(transaction=tx)
                        ],
                    }
                    for tx in WalletTransaction.objects.filter(
                        wallet=wallet,
                        reference_type='payout',
                        reference_id=payout.id,
                    ).order_by('created_at') if wallet
                ],
            }
            for payout in seller_payouts
        ]

        affiliate_payout_rows = []
        affiliate_profiles = AffiliateProfile.objects.filter(
            commissions__order__in=orders
        ).distinct().select_related('user')
        for profile in affiliate_profiles:
            affiliate_payout_rows.append({
                'affiliate': user_data(profile.user),
                'profile': {
                    'id': str(profile.id),
                    'referral_code': profile.referral_code,
                    'status': profile.status,
                    'is_active': profile.is_active,
                    'total_commission': decimal(profile.total_commission),
                    'total_withdrawn': decimal(profile.total_withdrawn),
                    'available_commission': decimal(profile.available_commission),
                },
                'payouts': [
                    {
                        'id': str(payout.id),
                        'amount': decimal(payout.amount),
                        'fee': decimal(payout.fee),
                        'net_amount': decimal(payout.net_amount),
                        'method': payout.method,
                        'account_details': payout.account_details,
                        'status': payout.status,
                        'admin_reference': payout.admin_reference,
                        'paid_at': payout.paid_at.isoformat() if payout.paid_at else None,
                        'created_at': payout.created_at.isoformat(),
                    }
                    for payout in AffiliatePayout.objects.filter(affiliate=profile).order_by('-created_at')
                ],
            })

        held_escrow = sum(
            (Decimal(str(escrow.amount)) for escrow in EscrowHolding.objects.filter(
                order_id__in=order_ids,
                status='held',
            )),
            Decimal('0'),
        )

        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'read_only': True,
            'store': {
                'id': str(store.id),
                'name': store.name,
                'slug': store.slug,
                'status': store.status,
                'owner': user_data(owner),
            },
            'scope': {
                'all_statuses': bool(options['all_statuses']),
                'order_count': len(orders),
            },
            'settings_observed_in_code': {
                'platform_fee_percent_used_on_checkout': '8%',
                'seller_payout_fee_percent': '11%',
                'affiliate_payout_fee_percent': '5%',
            },
            'totals': {
                'gross_order_total': decimal(gross_total),
                'platform_fees_recorded': decimal(platform_fee_total),
                'affiliate_commissions_recorded': decimal(affiliate_fee_total),
                'seller_formula_credit': decimal(seller_gross_total),
                'seller_sale_credit_transactions': decimal(seller_credit_total),
                'seller_credit_difference_for_scoped_orders': decimal(
                    sum(
                        (
                            Decimal(str(order.total))
                            - Decimal(str(order.platform_fee or 0))
                            - Decimal(str(order.affiliate_commission or 0))
                            for order in orders
                        ),
                        Decimal('0'),
                    )
                    - sum(
                        (
                            Decimal(str(tx.amount))
                            for tx in seller_sale_transactions
                            if tx.reference_id in set(order_ids)
                        ),
                        Decimal('0'),
                    )
                ),
                'held_escrow': decimal(held_escrow),
            },
            'seller_wallet': {
                'exists': wallet is not None,
                'payout_balance': decimal(wallet.payout_balance) if wallet else None,
                'reserved_balance': decimal(wallet.reserved_balance) if wallet else None,
                'available_payout': decimal(
                    wallet.payout_balance - wallet.reserved_balance
                ) if wallet else None,
                'total_earned': decimal(wallet.total_earned) if wallet else None,
                'total_withdrawn': decimal(wallet.total_withdrawn) if wallet else None,
            },
            'orders': order_rows,
            'seller_payouts': seller_payout_rows,
            'affiliate_payouts': affiliate_payout_rows,
            'seller_wallet_transactions': [
                {
                    'id': str(tx.id),
                    'type': tx.type,
                    'amount': decimal(tx.amount),
                    'balance_before': decimal(tx.balance_before),
                    'balance_after': decimal(tx.balance_after),
                    'reference_type': tx.reference_type,
                    'reference_id': str(tx.reference_id),
                    'description': tx.description,
                    'status': tx.status,
                    'idempotency_key': tx.idempotency_key,
                    'created_at': tx.created_at.isoformat(),
                    'ledger_entries': [
                        {
                            'id': str(entry.id),
                            'direction': entry.direction,
                            'amount': decimal(entry.amount),
                            'balance_before': decimal(entry.balance_before),
                            'balance_after': decimal(entry.balance_after),
                            'kind': entry.kind,
                            'counterparty': entry.counterparty,
                        }
                        for entry in WalletEntry.objects.filter(transaction=tx)
                    ],
                }
                for tx in seller_transactions
            ],
            'consistency_warnings': [],
        }

        if wallet and wallet.reserved_balance > wallet.payout_balance:
            report['consistency_warnings'].append(
                'Reserved balance exceeds payout_balance.'
            )
        if held_escrow > 0:
            report['consistency_warnings'].append(
                'There is held escrow in the audited scope.'
            )

        rendered = json.dumps(report, indent=2, ensure_ascii=False)
        if options['output']:
            with open(options['output'], 'w', encoding='utf-8') as report_file:
                report_file.write(rendered)
            self.stdout.write(self.style.SUCCESS(f'Relatório gravado em {options["output"]}'))
        self.stdout.write(rendered)
