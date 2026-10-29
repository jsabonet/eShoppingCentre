"""Read-only dependency plan for explicitly selected stores.

Usage:
    python manage.py plan_selected_store_cleanup <store_id> [<store_id> ...]
"""
import json
import uuid

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission, AffiliateLink, AffiliatePayout
from apps.courses.models import CourseCertificate, CourseReview, Enrollment
from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
    ReturnRequest,
    SupportTicket,
)
from apps.payments.models import PaymentTransaction
from apps.products.models import (
    Coupon,
    CouponUsage,
    Product,
    ProductImage,
    ProductVariant,
    ProductVariation,
    ProductView,
    StockLog,
    WishlistItem,
)
from apps.products.models_digital import DigitalDownload, DownloadAuditLog
from apps.reviews.models import Review, SellerRating, StoreReview
from apps.shipping.models import ShippingMethod, ShippingRate, ShippingZone
from apps.stores.models import Store, StoreFollower, StoreModerationLog, StoreReportExport
from apps.wallet.models import (
    EscrowHolding,
    PayoutRequest,
    Wallet,
    WalletEntry,
    WalletTransaction,
)


def _id(value):
    return str(value) if value is not None else None


def _product_details(store):
    rows = []
    products = Product.objects.filter(store_id=store.id).order_by('id')
    for product in products:
        rows.append({
            'id': _id(product.id),
            'name': product.name,
            'status': product.status,
            'product_type': product.product_type,
            'stored_sales_count': product.sales_count,
            'stored_rating': float(product.rating or 0),
            'stored_review_count': product.review_count,
            'view_count': ProductView.objects.filter(product_id=product.id).count(),
            'order_item_count': OrderItem.objects.filter(product_id=product.id).count(),
            'image_ids': [
                _id(value)
                for value in ProductImage.objects.filter(product_id=product.id)
                .order_by('id').values_list('id', flat=True)
            ],
            'variant_ids': [
                _id(value)
                for value in ProductVariant.objects.filter(product_id=product.id)
                .order_by('id').values_list('id', flat=True)
            ],
            'variation_ids': [
                _id(value)
                for value in ProductVariation.objects.filter(product_id=product.id)
                .order_by('id').values_list('id', flat=True)
            ],
            'wishlist_item_count': WishlistItem.objects.filter(
                product_id=product.id
            ).count(),
            'affiliate_commissions': list(
                AffiliateCommission.objects.filter(product_id=product.id)
                .order_by('id')
                .values('id', 'order_id', 'status', 'amount', 'reversed_amount')
            ),
            'affiliate_links': list(
                AffiliateLink.objects.filter(product_id=product.id)
                .order_by('id')
                .values('id', 'affiliate_id', 'clicks', 'conversions')
            ),
            'review_ids': [
                _id(value)
                for value in Review.objects.filter(product_id=product.id)
                .order_by('id').values_list('id', flat=True)
            ],
            'digital_download_ids': [
                _id(value)
                for value in DigitalDownload.objects.filter(product_id=product.id)
                .order_by('id').values_list('id', flat=True)
            ],
            'download_audit_log_ids': [
                _id(value)
                for value in DownloadAuditLog.objects.filter(
                    download__product_id=product.id
                ).order_by('id').values_list('id', flat=True)
            ],
            'stock_log_ids': [
                _id(value)
                for value in StockLog.objects.filter(product_id=product.id)
                .order_by('id').values_list('id', flat=True)
            ],
        })
    return rows


def _order_details(order, selected_store_ids):
    items = list(
        OrderItem.objects.filter(order_id=order.id)
        .select_related('product')
        .order_by('id')
    )
    item_rows = [{
        'id': _id(item.id),
        'product_id': _id(item.product_id),
        'product_name': item.product_name,
        'quantity': item.quantity,
        'product_store_id': _id(item.product.store_id) if item.product_id else None,
        'matches_selected_store': bool(
            item.product_id and item.product.store_id in selected_store_ids
        ),
    } for item in items]
    related_transactions = PaymentTransaction.objects.filter(
        Q(order_id=order.id) | Q(orders__id=order.id)
    ).distinct()
    transactions = []
    for transaction in related_transactions.order_by('id'):
        related_orders = list(
            Order.objects.filter(
                Q(id=transaction.order_id) | Q(payment_attempts=transaction)
            ).distinct().order_by('id')
        )
        transactions.append({
            'id': _id(transaction.id),
            'provider': transaction.provider,
            'status': transaction.status,
            'amount': str(transaction.amount),
            'currency': transaction.currency,
            'linked_order_ids': [_id(row.id) for row in related_orders],
            'shared_with_other_orders': any(
                row.id != order.id for row in related_orders
            ),
        })

    wallet_transactions = WalletTransaction.objects.filter(
        reference_type='order',
        reference_id=order.id,
    ).order_by('id')
    wallet_rows = [{
        'id': _id(row.id),
        'type': row.type,
        'status': row.status,
        'amount': str(row.amount),
        'ledger_entries': list(
            WalletEntry.objects.filter(transaction_id=row.id)
            .order_by('id').values('id', 'direction', 'amount', 'kind')
        ),
    } for row in wallet_transactions]
    return {
        'id': _id(order.id),
        'order_number': order.order_number,
        'store_id': _id(order.store_id),
        'status': order.status,
        'payment_method': order.payment_method,
        'payment_status': order.payment_status,
        'total': str(order.total),
        'items': item_rows,
        'payment_transactions': transactions,
        'wallet_transactions': wallet_rows,
        'escrow': list(
            EscrowHolding.objects.filter(order_id=order.id)
            .order_by('id').values('id', 'status', 'amount')
        ),
        'affiliate_commissions': list(
            AffiliateCommission.objects.filter(order_id=order.id)
            .order_by('id').values('id', 'status', 'amount', 'reversed_amount')
        ),
        'returns': list(
            ReturnRequest.objects.filter(order_id=order.id)
            .order_by('id').values('id', 'status', 'refund_amount')
        ),
        'support_tickets': list(
            SupportTicket.objects.filter(order_id=order.id)
            .order_by('id').values('id', 'status', 'category')
        ),
        'status_history_ids': [
            _id(value)
            for value in OrderStatusHistory.objects.filter(order_id=order.id)
            .order_by('id').values_list('id', flat=True)
        ],
        'digital_download_ids': [
            _id(value)
            for value in DigitalDownload.objects.filter(order_id=order.id)
            .order_by('id').values_list('id', flat=True)
        ],
        'download_audit_log_ids': [
            _id(value)
            for value in DownloadAuditLog.objects.filter(
                download__order_id=order.id
            ).order_by('id').values_list('id', flat=True)
        ],
        'enrollments': list(
            Enrollment.objects.filter(order_id=order.id)
            .order_by('id')
            .values('id', 'course_id', 'completed')
        ),
        'coupon_usages': list(
            CouponUsage.objects.filter(order_id=order.id)
            .order_by('id').values('id', 'coupon_id', 'discount_applied')
        ),
    }


def _owner_details(owner, selected_store_ids):
    selected_store_orders = Order.objects.filter(
        Q(store_id__in=selected_store_ids)
        | Q(items__product__store_id__in=selected_store_ids)
    ).distinct()
    other_orders = Order.objects.filter(buyer_id=owner.id).exclude(
        id__in=selected_store_orders.values('id')
    ).order_by('id')
    wallet = Wallet.objects.filter(user_id=owner.id).first()
    return {
        'user_id': _id(owner.id),
        'account_preserved': True,
        'is_active': owner.is_active,
        'is_staff_or_superuser': owner.is_staff or owner.is_superuser,
        'orders_as_buyer_outside_selected_stores': [
            {
                'id': _id(order.id),
                'order_number': order.order_number,
                'store_id': _id(order.store_id),
                'status': order.status,
                'payment_method': order.payment_method,
                'payment_status': order.payment_status,
            }
            for order in other_orders
        ],
        'wallet_preserved': wallet is not None,
        'wallet_has_nonzero_balances': bool(wallet and any((
            wallet.balance,
            wallet.payout_balance,
            wallet.reserved_balance,
            wallet.total_earned,
            wallet.total_withdrawn,
        ))),
        'wallet_transaction_count': WalletTransaction.objects.filter(
            wallet__user_id=owner.id
        ).count(),
        'wallet_ledger_entry_count': WalletEntry.objects.filter(
            wallet__user_id=owner.id
        ).count(),
        'payout_request_ids': [
            {
                'id': _id(row.id),
                'status': row.status,
                'amount': str(row.amount),
            }
            for row in PayoutRequest.objects.filter(user_id=owner.id).order_by('id')
        ],
        'affiliate_payouts': list(
            AffiliatePayout.objects.filter(affiliate__user_id=owner.id)
            .order_by('id').values('id', 'status', 'amount')
        ),
        'affiliate_commission_count': AffiliateCommission.objects.filter(
            affiliate__user_id=owner.id
        ).count(),
        'enrollment_ids': [
            _id(value)
            for value in Enrollment.objects.filter(user_id=owner.id)
            .order_by('id').values_list('id', flat=True)
        ],
        'digital_download_ids': [
            _id(value)
            for value in DigitalDownload.objects.filter(user_id=owner.id)
            .order_by('id').values_list('id', flat=True)
        ],
        'seller_rating_cache_id': (
            _id(SellerRating.objects.filter(user_id=owner.id)
                .values_list('id', flat=True).first())
        ),
    }


def _store_details(store, selected_store_ids):
    products = Product.objects.filter(store_id=store.id)
    orders = Order.objects.filter(
        Q(store_id=store.id) | Q(items__product__store_id=store.id)
    ).distinct().order_by('id')
    return {
        'store_id': _id(store.id),
        'store_name': store.name,
        'status': store.status,
        'owner': _owner_details(store.owner, selected_store_ids),
        'products': _product_details(store),
        'store_reviews': list(
            StoreReview.objects.filter(store_id=store.id)
            .order_by('id')
            .values('id', 'order_id', 'overall_rating', 'is_hidden')
        ),
        'course_reviews': list(
            CourseReview.objects.filter(course__product__store_id=store.id)
            .order_by('id').values('id', 'enrollment_id', 'rating', 'is_public', 'is_hidden')
        ),
        'course_enrollments': list(
            Enrollment.objects.filter(course__product__store_id=store.id)
            .order_by('id').values('id', 'order_id', 'completed')
        ),
        'course_certificates': list(
            CourseCertificate.objects.filter(
                enrollment__course__product__store_id=store.id
            ).order_by('id').values('id', 'enrollment_id', 'status', 'issued_at')
        ),
        'coupons': list(
            Coupon.objects.filter(store_id=store.id)
            .order_by('id').values('id', 'is_active', 'used_count')
        ),
        'coupon_usage_ids': [
            _id(value)
            for value in CouponUsage.objects.filter(coupon__store_id=store.id)
            .order_by('id').values_list('id', flat=True)
        ],
        'shipping_zones': list(
            ShippingZone.objects.filter(store_id=store.id)
            .order_by('id').values('id', 'name', 'is_active')
        ),
        'shipping_methods': list(
            ShippingMethod.objects.filter(store_id=store.id)
            .order_by('id').values('id', 'name', 'method_type', 'is_active')
        ),
        'shipping_rates': list(
            ShippingRate.objects.filter(
                Q(method__store_id=store.id) | Q(zone__store_id=store.id)
            ).distinct().order_by('id')
            .values('id', 'method_id', 'zone_id', 'base_price', 'is_active')
        ),
        'followers': list(
            StoreFollower.objects.filter(store_id=store.id)
            .order_by('id').values_list('id', flat=True)
        ),
        'report_exports': list(
            StoreReportExport.objects.filter(store_id=store.id)
            .order_by('id').values('id', 'report_type', 'order_count', 'item_count')
        ),
        'moderation_log_ids': [
            {
                'id': _id(row.id),
                'action': row.action,
                'previous_status': row.previous_status,
                'new_status': row.new_status,
            }
            for row in StoreModerationLog.objects.filter(store_id=store.id)
            .order_by('id')
        ],
        'orders': [
            _order_details(order, selected_store_ids)
            for order in orders
        ],
    }


class Command(BaseCommand):
    help = 'Detalha dependências de lojas escolhidas, sem alterar dados.'

    def add_arguments(self, parser):
        parser.add_argument(
            'store_ids',
            nargs='+',
            help='UUIDs das lojas já selecionadas para revisão.',
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

        selected_store_ids = {store.id for store in stores}
        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'mode': 'dry_run_only',
            'read_only': True,
            'mutations_performed': False,
            'metrics_plan': 'inventory_only',
            'store_count': len(stores),
            'stores': [
                _store_details(store, selected_store_ids)
                for store in stores
            ],
            'important_notes': [
                'Este comando apenas consulta a base de dados; não elimina nem atualiza registos.',
                'As contas dos proprietários, carteiras, ledger, pagamentos e pedidos fora das lojas selecionadas são preservados.',
                'Encomendas podem conter itens de lojas diferentes; revise os itens e transações partilhadas antes de qualquer plano de exclusão.',
                'IDs de transações são internos; referências do provedor, dados bancários e dados pessoais não são incluídos.',
                'Ficheiros em armazenamento externo e relações não listadas exigem inventário e revisão separados.',
                'Nenhuma métrica será zerada ou recalculada; o reset continua limitado a inventário e decisão posterior.',
            ],
        }
        self.stdout.write(json.dumps(
            report,
            ensure_ascii=False,
            default=str,
            indent=2,
        ))
