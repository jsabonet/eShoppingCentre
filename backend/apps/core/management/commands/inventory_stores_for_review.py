"""Read-only inventory of stores and the data linked to each one.

Usage:
    python manage.py inventory_stores_for_review
"""
import json

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission, AffiliateProfile, AffiliatePayout
from apps.courses.models import CourseReview, Enrollment
from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
    ReturnRequest,
    SupportTicket,
)
from apps.payments.models import PaymentTransaction
from apps.products.models import Coupon, Product, StockLog
from apps.products.models_digital import DigitalDownload
from apps.reviews.models import Review, SellerRating, StoreReview
from apps.stores.models import Store, StoreModerationLog
from apps.wallet.models import (
    EscrowHolding,
    PayoutRequest,
    Wallet,
    WalletEntry,
    WalletTransaction,
)
from apps.users.models import Address


def _count_related(model, *conditions, **filters):
    return model.objects.filter(*conditions, **filters).count()


def _order_inventory(store):
    store_orders = Order.objects.filter(
        Q(store_id=store.id)
        | Q(items__product__store_id=store.id)
    ).distinct()
    order_ids = store_orders.values('id')
    payment_transactions = PaymentTransaction.objects.filter(
        Q(order__in=order_ids)
        | Q(orders__in=order_ids)
    ).distinct()
    wallet_transactions = WalletTransaction.objects.filter(
        reference_type='order',
        reference_id__in=order_ids,
    )
    return {
        'orders': store_orders.count(),
        'order_items': OrderItem.objects.filter(
            Q(order__store_id=store.id)
            | Q(product__store_id=store.id)
        ).distinct().count(),
        'orders_by_payment_method_and_status': list(
            store_orders.values('payment_method', 'payment_status')
            .annotate(count=Count('pk'))
            .order_by('payment_method', 'payment_status')
        ),
        'payment_transactions': payment_transactions.count(),
        'completed_payment_transactions': payment_transactions.filter(
            status='completed'
        ).count(),
        'wallet_transactions_referencing_orders': wallet_transactions.count(),
        'wallet_ledger_entries_for_these_transactions': WalletEntry.objects.filter(
            transaction__in=wallet_transactions
        ).count(),
        'escrow_holdings': _count_related(EscrowHolding, order__in=order_ids),
        'affiliate_commissions': _count_related(
            AffiliateCommission,
            Q(order__in=order_ids) | Q(product__store_id=store.id),
        ),
        'returns': _count_related(ReturnRequest, order__in=order_ids),
        'support_tickets': _count_related(SupportTicket, order__in=order_ids),
        'order_status_history': _count_related(
            OrderStatusHistory,
            order__in=order_ids,
        ),
    }


def _owner_inventory(owner, store):
    store_order_ids = Order.objects.filter(
        Q(store_id=store.id) | Q(items__product__store_id=store.id)
    ).values('id')
    buyer_orders = Order.objects.filter(buyer_id=owner.id)
    orders_for_other_stores = buyer_orders.exclude(
        Q(store_id=store.id) | Q(items__product__store_id=store.id)
    ).distinct()
    owner_wallet = Wallet.objects.filter(user_id=owner.id).first()
    return {
        'owner_user_id': str(owner.id),
        'owner_is_active': owner.is_active,
        'owner_is_verified': owner.is_verified,
        'owner_is_staff_or_superuser': owner.is_staff or owner.is_superuser,
        'owner_addresses': _count_related(Address, user_id=owner.id),
        'owner_orders_as_buyer': buyer_orders.count(),
        'owner_orders_in_other_stores_as_buyer': orders_for_other_stores.count(),
        'owner_orders_as_buyer_payment_methods': list(
            buyer_orders.values('payment_method', 'payment_status')
            .annotate(count=Count('pk'))
            .order_by('payment_method', 'payment_status')
        ),
        'owner_product_reviews': _count_related(Review, user_id=owner.id),
        'owner_store_reviews': _count_related(StoreReview, user_id=owner.id),
        'owner_course_reviews': _count_related(
            CourseReview,
            enrollment__user_id=owner.id,
        ),
        'owner_enrollments': _count_related(Enrollment, user_id=owner.id),
        'owner_digital_downloads': _count_related(DigitalDownload, user_id=owner.id),
        'owner_wallet_exists': owner_wallet is not None,
        'owner_wallet_has_nonzero_balances': bool(
            owner_wallet
            and any((
                owner_wallet.balance,
                owner_wallet.payout_balance,
                owner_wallet.reserved_balance,
                owner_wallet.total_earned,
                owner_wallet.total_withdrawn,
            ))
        ),
        'owner_wallet_transactions': _count_related(
            WalletTransaction,
            wallet__user_id=owner.id,
        ),
        'owner_wallet_ledger_entries': _count_related(
            WalletEntry,
            wallet__user_id=owner.id,
        ),
        'owner_payout_requests': _count_related(PayoutRequest, user_id=owner.id),
        'owner_affiliate_profile_exists': AffiliateProfile.objects.filter(
            user_id=owner.id
        ).exists(),
        'owner_affiliate_commissions': _count_related(
            AffiliateCommission,
            affiliate__user_id=owner.id,
        ),
        'owner_affiliate_payouts': _count_related(
            AffiliatePayout,
            affiliate__user_id=owner.id,
        ),
        'owner_seller_rating_exists': SellerRating.objects.filter(
            user_id=owner.id
        ).exists(),
        'owner_order_ids_for_this_store_count': store_order_ids.count(),
    }


class Command(BaseCommand):
    help = 'Lista lojas e dependências para revisão, sem alterar dados.'

    def handle(self, *args, **options):
        stores = Store.objects.select_related('owner').order_by('name', 'id')
        inventory = []

        for store in stores.iterator():
            products = Product.objects.filter(store_id=store.id)
            store_reviews = StoreReview.objects.filter(store_id=store.id)
            visible_store_reviews = store_reviews.filter(is_hidden=False)
            products_with_order_history = OrderItem.objects.filter(
                product__store_id=store.id
            ).values('product_id').distinct()
            orders = _order_inventory(store)
            owner = _owner_inventory(store.owner, store)

            inventory.append({
                'store_id': str(store.id),
                'store_name': store.name,
                'slug': store.slug,
                'status': store.status,
                'created_at': store.created_at.isoformat(),
                'stored_total_sales': store.total_sales,
                'stored_rating': float(store.rating or 0),
                'owner': owner,
                'store_data': {
                    'products': products.count(),
                    'products_by_status': list(
                        products.values('status')
                        .annotate(count=Count('pk'))
                        .order_by('status')
                    ),
                    'products_with_order_history': len(list(products_with_order_history)),
                    'product_reviews': _count_related(
                        Review,
                        product__store_id=store.id,
                    ),
                    'visible_product_reviews': _count_related(
                        Review,
                        product__store_id=store.id,
                        is_hidden=False,
                    ),
                    'store_reviews': store_reviews.count(),
                    'visible_store_reviews': visible_store_reviews.count(),
                    'average_visible_store_review': (
                        visible_store_reviews.aggregate(
                            value=Avg('overall_rating')
                        )['value'] or 0
                    ),
                    'courses': products.filter(product_type='course').count(),
                    'course_enrollments': _count_related(
                        Enrollment,
                        course__product__store_id=store.id,
                    ),
                    'course_reviews': _count_related(
                        CourseReview,
                        course__product__store_id=store.id,
                    ),
                    'digital_downloads': _count_related(
                        DigitalDownload,
                        product__store_id=store.id,
                    ),
                    'stock_logs': _count_related(
                        StockLog,
                        product__store_id=store.id,
                    ),
                    'coupons': _count_related(Coupon, store_id=store.id),
                    'moderation_logs': _count_related(
                        StoreModerationLog,
                        store_id=store.id,
                    ),
                },
                'order_data': orders,
            })

        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'read_only': True,
            'mutations_performed': False,
            'store_count': len(inventory),
            'stores': inventory,
            'important_notes': [
                'Este comando apenas consulta a base de dados; não altera nem elimina registos.',
                (
                    'Não inclui emails, telefones, moradas, nomes de clientes, '
                    'documentos ou dados bancários.'
                ),
                (
                    'Eliminar o utilizador proprietário pode também eliminar '
                    'as encomendas dele como comprador em outras lojas, bem como '
                    'carteira, ledger, pagamentos de afiliado e dados pessoais.'
                ),
                (
                    'Encomendas e transações concluídas são registos financeiros. '
                    'A sua eliminação exige revisão e reconciliação independentes.'
                ),
            ],
        }
        self.stdout.write(json.dumps(
            report,
            ensure_ascii=False,
            default=str,
            indent=2,
        ))
