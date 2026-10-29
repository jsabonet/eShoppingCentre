"""Read-only inventory of analytics and aggregate counters.

Usage:
    python manage.py inventory_metrics_for_reset
"""
import json

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.affiliates.models import (
    AffiliateCommission,
    AffiliateLink,
    AffiliateProfile,
)
from apps.campaigns.models import BannerCampaign
from apps.courses.models import CourseReview
from apps.orders.models import OrderItem
from apps.products.models import Product, ProductView, SearchLog
from apps.reviews.models import Review, SellerRating, StoreReview
from apps.stores.models import Store

SOLD_STATUSES = (
    'confirmed',
    'processing',
    'shipped',
    'ready_for_pickup',
    'delivered',
)


def _monthly_counts(queryset):
    return list(
        queryset.annotate(month=TruncMonth('created_at'))
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


def _number(value):
    return round(float(value or 0), 2)


class Command(BaseCommand):
    help = 'Mostra métricas e contadores agregados sem alterar dados.'

    def handle(self, *args, **options):
        sold_order_items = OrderItem.objects.filter(
            order__payment_status='completed',
            order__status__in=SOLD_STATUSES,
        )
        visible_product_reviews = Review.objects.filter(is_hidden=False)
        visible_store_reviews = StoreReview.objects.filter(is_hidden=False)
        visible_course_reviews = CourseReview.objects.filter(
            is_public=True,
            is_hidden=False,
        )
        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': 'default',
            'read_only': True,
            'mutations_performed': False,
            'analytics_events': {
                'product_views': ProductView.objects.count(),
                'product_views_by_month': _format_months(
                    _monthly_counts(ProductView.objects.all())
                ),
                'search_events': SearchLog.objects.count(),
                'search_events_by_month': _format_months(
                    _monthly_counts(SearchLog.objects.all())
                ),
            },
            'sales_aggregates': {
                'products_count': Product.objects.count(),
                'stored_product_sales_count_sum': (
                    Product.objects.aggregate(value=Sum('sales_count'))['value'] or 0
                ),
                'paid_order_item_rows_in_sold_statuses': sold_order_items.count(),
                'paid_order_item_units_in_sold_statuses': (
                    sold_order_items.aggregate(value=Sum('quantity'))['value'] or 0
                ),
                'stores_count': Store.objects.count(),
                'stored_store_total_sales_sum': (
                    Store.objects.aggregate(value=Sum('total_sales'))['value'] or 0
                ),
                'stored_store_total_products_sum': (
                    Store.objects.aggregate(value=Sum('total_products'))['value'] or 0
                ),
                'actual_products_count': Product.objects.count(),
                'note': (
                    'Os contadores armazenados são comparados apenas com '
                    'referências observáveis; não são automaticamente '
                    'recalculados nem considerados prova de fraude.'
                ),
            },
            'affiliate_aggregates': {
                'profiles': AffiliateProfile.objects.aggregate(
                    count=Count('pk'),
                    clicks=Sum('total_clicks'),
                    sales=Sum('total_sales'),
                    commission=Sum('total_commission'),
                    withdrawn=Sum('total_withdrawn'),
                ),
                'links': AffiliateLink.objects.aggregate(
                    count=Count('pk'),
                    clicks=Sum('clicks'),
                    conversions=Sum('conversions'),
                ),
                'commissions_by_status': list(
                    AffiliateCommission.objects.values('status')
                    .annotate(
                        count=Count('pk'),
                        amount=Sum('amount'),
                        reversed_amount=Sum('reversed_amount'),
                    )
                    .order_by('status')
                ),
            },
            'ratings': {
                'visible_product_reviews': {
                    'count': visible_product_reviews.count(),
                    'average': _number(
                        visible_product_reviews.aggregate(value=Avg('rating'))['value']
                    ),
                },
                'visible_store_reviews': {
                    'count': visible_store_reviews.count(),
                    'average': _number(
                        visible_store_reviews.aggregate(value=Avg('overall_rating'))['value']
                    ),
                },
                'visible_public_course_reviews': {
                    'count': visible_course_reviews.count(),
                    'average': _number(
                        visible_course_reviews.aggregate(value=Avg('rating'))['value']
                    ),
                },
                'stored_product_rating_fields': Product.objects.aggregate(
                    rows=Count('pk'),
                    average=Avg('rating'),
                    review_count_sum=Sum('review_count'),
                ),
                'stored_store_ratings': Store.objects.aggregate(
                    rows=Count('pk'),
                    average=Avg('rating'),
                ),
                'seller_rating_cache_rows': SellerRating.objects.count(),
                'note': (
                    'Ratings são derivados de reviews. Defini-los a zero sem '
                    'remover as reviews é inconsistente; CourseReview também '
                    'atualiza Product.rating e Product.review_count.'
                ),
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
            'safety_notes': [
                'Este comando é somente de leitura e não tem modo de reset.',
                (
                    'Ledger, saldos, transações de pagamento, encomendas e '
                    'comissões pagas são dados financeiros, não contadores '
                    'de analytics; não são alvos de reset.'
                ),
                (
                    'Views e pesquisas podem conter atividade real. Confirme '
                    'retenção/privacidade e exporte backup antes de considerar '
                    'eliminar eventos históricos.'
                ),
            ],
        }
        self.stdout.write(json.dumps(
            report,
            ensure_ascii=False,
            default=str,
            indent=2,
        ))
