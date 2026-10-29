"""Read-only inventory of production data and potentially stale aggregates.

Usage:
    python manage.py inventory_test_data
"""
import json

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.campaigns.models import BannerCampaign
from apps.courses.models import CourseReview, Enrollment
from apps.orders.models import Order, OrderItem
from apps.payments.models import PaymentTransaction
from apps.products.models import Product
from apps.reviews.models import Review, SellerRating, StoreReview
from apps.stores.models import Store
from apps.users.models import User

SOLD_STATUSES = (
    'confirmed',
    'processing',
    'shipped',
    'ready_for_pickup',
    'delivered',
)


def _group_counts(queryset, *fields):
    return list(
        queryset.values(*fields)
        .annotate(count=Count('pk'))
        .order_by(*fields)
    )


def _monthly_counts(queryset, date_field='created_at'):
    return list(
        queryset.annotate(month=TruncMonth(date_field))
        .values('month')
        .annotate(count=Count('pk'))
        .order_by('month')
    )


def _format_months(rows):
    return [
        {
            'month': row['month'].date().isoformat() if row['month'] else None,
            'count': row['count'],
        }
        for row in rows
    ]


class Command(BaseCommand):
    help = 'Gera um inventário somente de leitura para revisão de dados e métricas.'

    def handle(self, *args, **options):
        sold_orders = Order.objects.filter(
            payment_status='completed',
            status__in=SOLD_STATUSES,
        )
        sold_items = OrderItem.objects.filter(order__in=sold_orders)

        product_aggregates = Product.objects.aggregate(
            products=Count('pk'),
            stored_sales_count=Sum('sales_count'),
            stored_review_count=Sum('review_count'),
        )
        visible_product_reviews = Review.objects.filter(is_hidden=False)
        visible_store_reviews = StoreReview.objects.filter(is_hidden=False)
        visible_course_reviews = CourseReview.objects.filter(
            is_hidden=False,
            is_public=True,
        )
        user_role_counts = {}
        for roles in User.objects.values_list('roles', flat=True).iterator():
            for role in roles or []:
                user_role_counts[role] = user_role_counts.get(role, 0) + 1

        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'read_only': True,
            'important_notes': [
                'Este comando não altera nem elimina registos.',
                (
                    'O sistema não tem um marcador universal que identifique '
                    'registos de teste. Data, estado, método de pagamento ou '
                    'conta não verificada, isoladamente, não provam que um '
                    'registo seja de teste.'
                ),
                (
                    'Não são incluídos nomes, emails, telefones, moradas, '
                    'documentos ou identificadores individuais neste relatório.'
                ),
                (
                    'Os totais de vendas calculados a partir de encomendas '
                    'pagas e concluídas são referências para revisão, não '
                    'uma autorização para apagar ou reescrever dados.'
                ),
            ],
            'users': {
                'total': User.objects.count(),
                'active': User.objects.filter(is_active=True).count(),
                'inactive': User.objects.filter(is_active=False).count(),
                'verified': User.objects.filter(is_verified=True).count(),
                'unverified': User.objects.filter(is_verified=False).count(),
                'soft_deleted': User.objects.filter(deleted_at__isnull=False).count(),
                'by_role': user_role_counts,
                'registrations_by_month': _format_months(
                    _monthly_counts(User.objects.all(), 'date_joined')
                ),
            },
            'stores': {
                'total': Store.objects.count(),
                'by_status': _group_counts(Store.objects.all(), 'status'),
                'by_creation_month': _format_months(
                    _monthly_counts(Store.objects.all())
                ),
                'stored_total_sales_sum': (
                    Store.objects.aggregate(total=Sum('total_sales'))['total'] or 0
                ),
            },
            'orders': {
                'total': Order.objects.count(),
                'by_payment_status': _group_counts(
                    Order.objects.all(), 'payment_status'
                ),
                'by_payment_method': _group_counts(
                    Order.objects.all(), 'payment_method'
                ),
                'by_order_status': _group_counts(Order.objects.all(), 'status'),
                'by_payment_method_and_status': _group_counts(
                    Order.objects.all(), 'payment_method', 'payment_status'
                ),
                'by_creation_month': _format_months(
                    _monthly_counts(Order.objects.all())
                ),
                'paid_orders_in_sold_statuses': sold_orders.count(),
                'paid_order_item_units_in_sold_statuses': (
                    sold_items.aggregate(total=Sum('quantity'))['total'] or 0
                ),
            },
            'payment_transactions': {
                'total': PaymentTransaction.objects.count(),
                'by_provider_and_status': list(
                    PaymentTransaction.objects.values('provider', 'status', 'currency')
                    .annotate(
                        count=Count('pk'),
                        amount=Sum('amount'),
                    )
                    .order_by('provider', 'status', 'currency')
                ),
            },
            'products_and_reviews': {
                'products': product_aggregates['products'],
                'stored_sales_count_sum': product_aggregates['stored_sales_count'] or 0,
                'paid_order_item_units_in_sold_statuses': (
                    sold_items.aggregate(total=Sum('quantity'))['total'] or 0
                ),
                'stored_review_count_sum': product_aggregates['stored_review_count'] or 0,
                'visible_product_reviews': visible_product_reviews.count(),
                'visible_product_review_average': (
                    visible_product_reviews.aggregate(value=Avg('rating'))['value'] or 0
                ),
                'stored_product_ratings': Product.objects.aggregate(
                    average=Avg('rating')
                )['average'] or 0,
            },
            'store_reviews': {
                'visible_reviews': visible_store_reviews.count(),
                'visible_average': (
                    visible_store_reviews.aggregate(value=Avg('overall_rating'))['value']
                    or 0
                ),
                'stored_store_ratings': Store.objects.aggregate(
                    average=Avg('rating')
                )['average'] or 0,
                'seller_rating_cache_rows': SellerRating.objects.count(),
            },
            'course_reviews_and_enrollments': {
                'visible_public_reviews': visible_course_reviews.count(),
                'enrollments': Enrollment.objects.count(),
            },
            'banner_campaign_metrics': BannerCampaign.objects.aggregate(
                campaigns=Count('pk'),
                views=Sum('view_count'),
                clicks=Sum('click_count'),
                currently_active=Count(
                    'pk',
                    filter=Q(
                        state=BannerCampaign.State.ACTIVE,
                        starts_at__lte=timezone.now(),
                        ends_at__gt=timezone.now(),
                    ),
                ),
            ),
        }

        self.stdout.write(json.dumps(
            report,
            ensure_ascii=False,
            default=str,
            indent=2,
        ))
