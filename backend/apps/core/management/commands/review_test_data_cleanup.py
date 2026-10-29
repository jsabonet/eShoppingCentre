"""Dry-run review of simulated orders and cached ratings.

This command is intentionally read-only and has no deletion or update mode.

Usage:
    python manage.py review_test_data_cleanup
"""
import json

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission
from apps.courses.models import CourseReview, Enrollment
from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
    ReturnRequest,
    SupportTicket,
)
from apps.payments.models import PaymentTransaction
from apps.products.models import Product, StockLog
from apps.products.models_digital import DigitalDownload
from apps.reviews.models import Review, SellerRating, StoreReview
from apps.stores.models import Store
from apps.wallet.models import EscrowHolding, WalletEntry, WalletTransaction

TEST_PAYMENT_METHOD = 'test'


def _rounded(value, digits=2):
    return round(float(value or 0), digits)


def _stale_product_ratings():
    mismatches = []
    for product in Product.objects.only('id', 'rating', 'review_count').iterator():
        visible_reviews = Review.objects.filter(product_id=product.id, is_hidden=False)
        actual = visible_reviews.aggregate(
            average=Avg('rating'),
            count=Count('pk'),
        )
        stored_average = _rounded(product.rating)
        actual_average = _rounded(actual['average'])
        actual_count = actual['count'] or 0
        if stored_average != actual_average or product.review_count != actual_count:
            mismatches.append({
                'product_id': str(product.id),
                'stored_rating': stored_average,
                'visible_review_average': actual_average,
                'stored_review_count': product.review_count,
                'visible_review_count': actual_count,
            })
    return mismatches


def _stale_store_ratings():
    mismatches = []
    for store in Store.objects.only('id', 'rating').iterator():
        actual = StoreReview.objects.filter(
            store_id=store.id,
            is_hidden=False,
        ).aggregate(
            average=Avg('overall_rating'),
            count=Count('pk'),
        )
        stored_average = _rounded(store.rating)
        actual_average = _rounded(actual['average'])
        actual_count = actual['count'] or 0
        if stored_average != actual_average:
            mismatches.append({
                'store_id': str(store.id),
                'stored_rating': stored_average,
                'visible_review_average': actual_average,
                'visible_review_count': actual_count,
            })
    return mismatches


def _stale_seller_rating_caches():
    mismatches = []
    for seller_rating in SellerRating.objects.select_related('user').iterator():
        reviews = StoreReview.objects.filter(
            store__owner_id=seller_rating.user_id,
            is_hidden=False,
        )
        actual = reviews.aggregate(
            communication=Avg('communication_rating'),
            shipping=Avg('shipping_rating'),
            accuracy=Avg('accuracy_rating'),
            overall=Avg('overall_rating'),
            count=Count('pk'),
            replied=Count('pk', filter=Q(seller_replied_at__isnull=False)),
        )
        total_reviews = actual['count'] or 0
        response_rate = (
            actual['replied'] / total_reviews * 100
            if total_reviews
            else 0
        )
        expected = {
            'avg_communication': _rounded(actual['communication']),
            'avg_shipping': _rounded(actual['shipping']),
            'avg_accuracy': _rounded(actual['accuracy']),
            'avg_overall': _rounded(actual['overall']),
            'total_reviews': total_reviews,
            'response_rate': _rounded(response_rate),
        }
        stored = {
            'avg_communication': _rounded(seller_rating.avg_communication),
            'avg_shipping': _rounded(seller_rating.avg_shipping),
            'avg_accuracy': _rounded(seller_rating.avg_accuracy),
            'avg_overall': _rounded(seller_rating.avg_overall),
            'total_reviews': seller_rating.total_reviews,
            'response_rate': _rounded(seller_rating.response_rate),
        }
        if stored != expected:
            mismatches.append({
                'seller_user_id': str(seller_rating.user_id),
                'stored': stored,
                'visible_store_reviews': expected,
            })
    return mismatches


def _test_order_details(order):
    payment_transactions = PaymentTransaction.objects.filter(
        Q(order_id=order.id) | Q(orders=order)
    ).distinct()
    wallet_transactions = WalletTransaction.objects.filter(
        reference_type='order',
        reference_id=order.id,
    )
    wallet_entries = WalletEntry.objects.filter(transaction__in=wallet_transactions)
    shared_payment_transactions = payment_transactions.annotate(
        linked_order_count=Count('orders', distinct=True)
    ).filter(linked_order_count__gt=1)
    order_number_reference = order.order_number
    order_items = OrderItem.objects.filter(order=order)
    review_count = Review.objects.filter(order=order).count()
    store_review_count = StoreReview.objects.filter(order=order).count()

    return {
        'id': str(order.id),
        'order_number': order.order_number,
        'created_at': order.created_at.isoformat(),
        'status': order.status,
        'payment_status': order.payment_status,
        'payment_method': order.payment_method,
        'total': str(order.total),
        'order_items': order_items.count(),
        'item_units': sum(order_items.values_list('quantity', flat=True)),
        'payment_transactions': payment_transactions.count(),
        'completed_payment_transactions': payment_transactions.filter(
            status='completed'
        ).count(),
        'shared_payment_transactions': shared_payment_transactions.count(),
        'payment_transaction_summary': list(
            payment_transactions.values('provider', 'status', 'currency')
            .annotate(count=Count('pk'), amount=Sum('amount'))
            .order_by('provider', 'status', 'currency')
        ),
        'wallet_transactions': wallet_transactions.count(),
        'wallet_ledger_entries': wallet_entries.count(),
        'escrow_holdings': EscrowHolding.objects.filter(order=order).count(),
        'affiliate_commissions': AffiliateCommission.objects.filter(order=order).count(),
        'digital_downloads': DigitalDownload.objects.filter(order=order).count(),
        'course_enrollments': Enrollment.objects.filter(order=order).count(),
        'returns': ReturnRequest.objects.filter(order=order).count(),
        'support_tickets': SupportTicket.objects.filter(order=order).count(),
        'status_history': OrderStatusHistory.objects.filter(order=order).count(),
        'product_reviews': review_count,
        'store_reviews': store_review_count,
        'stock_logs_referencing_order_number': StockLog.objects.filter(
            reference__icontains=order_number_reference
        ).count(),
        'review_risk': {
            'completed_payment': order.payment_status == 'completed',
            'has_completed_gateway_transaction': payment_transactions.filter(
                status='completed'
            ).exists(),
            'has_wallet_ledger_entries': wallet_entries.exists(),
            'has_escrow': EscrowHolding.objects.filter(order=order).exists(),
            'has_affiliate_commissions': AffiliateCommission.objects.filter(
                order=order
            ).exists(),
            'has_course_enrollments': Enrollment.objects.filter(order=order).exists(),
            'has_returns_or_support_tickets': (
                ReturnRequest.objects.filter(order=order).exists()
                or SupportTicket.objects.filter(order=order).exists()
            ),
            'has_reviews': bool(review_count or store_review_count),
        },
    }


class Command(BaseCommand):
    help = 'Analisa candidatos a dados de teste sem alterar ou eliminar registos.'

    def handle(self, *args, **options):
        test_orders = Order.objects.filter(
            payment_method=TEST_PAYMENT_METHOD
        ).order_by('created_at', 'id')
        test_order_details = [
            _test_order_details(order)
            for order in test_orders.iterator()
        ]
        completed_test_orders = [
            item for item in test_order_details
            if item['payment_status'] == 'completed'
        ]
        high_risk_order_count = sum(
            any(item['review_risk'].values())
            for item in test_order_details
        )
        product_rating_mismatches = _stale_product_ratings()
        store_rating_mismatches = _stale_store_ratings()
        seller_rating_mismatches = _stale_seller_rating_caches()
        course_review_stats = CourseReview.objects.filter(
            is_public=True,
            is_hidden=False,
        ).aggregate(
            count=Count('pk'),
            average=Avg('rating'),
        )

        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'mode': 'dry_run_only',
            'mutations_performed': False,
            'confirmed_test_marker': {
                'field': 'orders.Order.payment_method',
                'value': TEST_PAYMENT_METHOD,
                'candidate_orders': len(test_order_details),
            },
            'safety': [
                'Este comando é somente de leitura; não existe opção para apagar ou atualizar dados.',
                'Utilizadores e dados reais não são alterados nem incluídos individualmente.',
                (
                    'Pedidos de teste concluídos também podem ter gateway, '
                    'ledger, escrow, afiliados, stock, downloads, matrículas, '
                    'devoluções ou tickets associados; reconcilie cada efeito '
                    'antes de qualquer operação de limpeza.'
                ),
                (
                    'Entradas de ledger são registos financeiros históricos. '
                    'Não devem ser apagadas para corrigir métricas.'
                ),
            ],
            'test_orders': {
                'count': len(test_order_details),
                'completed_payment_status_count': len(completed_test_orders),
                'orders_with_related_risk_count': high_risk_order_count,
                'orders': test_order_details,
            },
            'derived_rating_reconciliation': {
                'product_rating_mismatch_count': len(product_rating_mismatches),
                'product_rating_mismatches': product_rating_mismatches,
                'store_rating_mismatch_count': len(store_rating_mismatches),
                'store_rating_mismatches': store_rating_mismatches,
                'seller_rating_cache_mismatch_count': len(seller_rating_mismatches),
                'seller_rating_cache_mismatches': seller_rating_mismatches,
                'visible_public_course_reviews': {
                    'count': course_review_stats['count'] or 0,
                    'average': _rounded(course_review_stats['average']),
                    'note': (
                        'CourseReview atualiza o rating do produto do curso; '
                        'este relatório não altera automaticamente esses valores.'
                    ),
                },
                'note': (
                    'Divergências são apenas reportadas. Product.rating pode '
                    'também ser atualizado por CourseReview, portanto não deve '
                    'ser reescrito apenas com base em Review.'
                ),
            },
        }

        self.stdout.write(json.dumps(
            report,
            ensure_ascii=False,
            default=str,
            indent=2,
        ))
