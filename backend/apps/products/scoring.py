"""Curadoria da home: scoring e construção das 4 secções de produtos.

Regras determinísticas (Nível 1), pré-computadas por tarefa agendada e
guardadas em cache. Sem machine learning.
"""
import logging
from datetime import timedelta

from django.core.cache import cache
from django.db.models import (
    Case, Count, ExpressionWrapper, F, FloatField, IntegerField, OuterRef,
    Subquery, Value, When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Product
from apps.orders.models import OrderItem

logger = logging.getLogger(__name__)

HOME_SECTIONS_CACHE_KEY = 'home_sections'
CACHE_TIMEOUT = 3600  # 1 hora

RECENT_DAYS = 30
SECTION_CAP = 20
MAX_PER_STORE_FEATURED = 3
DISCOUNT_THRESHOLD = 10.0

# Encomendas que contam como "vendidas"
SOLD_STATUSES = ['confirmed', 'processing', 'shipped', 'ready_for_pickup', 'delivered']


def _recent_sales_subquery():
    """Subquery: nº de unidades vendidas por produto nos últimos N dias."""
    cutoff = timezone.now() - timedelta(days=RECENT_DAYS)
    return Subquery(
        OrderItem.objects.filter(
            product=OuterRef('pk'),
            order__created_at__gte=cutoff,
            order__status__in=SOLD_STATUSES,
        )
        .values('product')
        .annotate(n=Count('id'))
        .values('n'),
        output_field=IntegerField(),
    )


def product_score(product, recent_sales):
    """Score composto (0..1) para curadoria dos Destaques."""
    rating = float(product.rating or 0)
    review_count = int(product.review_count or 0)
    store = getattr(product, 'store', None)
    store_rating = float(getattr(store, 'rating', 0) or 0)

    discount = 0.0
    if product.compare_price and product.compare_price > 0:
        discount = float((1 - product.price / product.compare_price) * 100)

    days = max(0, (timezone.now() - product.created_at).days)
    recency = max(0.0, 1.0 - days / 90.0)

    sales_norm = min(float(recent_sales or 0) / 50.0, 1.0)
    rating_norm = rating / 5.0
    review_norm = min(review_count / 50.0, 1.0)
    discount_norm = min(discount / 50.0, 1.0)
    store_norm = min(store_rating / 5.0, 1.0)

    score = (
        0.35 * sales_norm
        + 0.30 * rating_norm
        + 0.15 * store_norm
        + 0.10 * recency
        + 0.05 * review_norm
        + 0.05 * discount_norm
    )
    return round(score, 4)


def refresh_featured_scores():
    """Recomputa e persiste `featured_score` dos principais candidatos."""
    active = Product.objects.filter(status='active', store__status='active')
    candidates = list(
        active.annotate(_recent=Coalesce(_recent_sales_subquery(), Value(0)))
        .order_by('-sales_count')[:200]
        .select_related('store')
    )
    for p in candidates:
        p.featured_score = product_score(p, getattr(p, '_recent', 0) or 0)
    if candidates:
        Product.objects.bulk_update(candidates, ['featured_score'])


def _build_featured(active):
    """Destaques: score + cap por loja (máx 3)."""
    candidates = list(
        active.filter(featured_score__gt=0)
        .order_by('-featured_score', '-sales_count')[:200]
    )
    ids = []
    per_store = {}
    for p in candidates:
        store_id = str(p.store_id) if p.store_id else 'none'
        if per_store.get(store_id, 0) >= MAX_PER_STORE_FEATURED:
            continue
        ids.append(str(p.id))
        per_store[store_id] = per_store.get(store_id, 0) + 1
        if len(ids) >= SECTION_CAP:
            break
    return ids


def build_home_sections():
    """Devolve {'deals','bestsellers','new_arrivals','featured'} com listas de IDs."""
    active = Product.objects.filter(status='active', store__status='active')

    # 1. Ofertas do Dia: desconto real >= limiar
    deals_ids = [
        str(p.id)
        for p in active.filter(
            is_on_sale=True, compare_price__isnull=False, compare_price__gt=F('price')
        )
        .annotate(
            _discount=ExpressionWrapper(
                (F('compare_price') - F('price')) * 100.0 / F('compare_price'),
                output_field=FloatField(),
            )
        )
        .filter(_discount__gte=DISCOUNT_THRESHOLD)
        .order_by('-_discount')
        .only('id')[:SECTION_CAP]
    ]

    # 2. Mais Vendidos: vendas recentes (fallback sales_count total)
    best_ids = [
        str(p.id)
        for p in active.annotate(
            _recent=Coalesce(_recent_sales_subquery(), Value(0))
        )
        .order_by('-_recent', '-sales_count')
        .only('id')[:SECTION_CAP]
    ]

    # 3. Novidades: ativos, em stock primeiro
    new_ids = [
        str(p.id)
        for p in active.annotate(
            _in_stock=Case(
                When(stock__gt=0, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        )
        .order_by('-_in_stock', '-created_at')
        .only('id')[:SECTION_CAP]
    ]

    # 4. Destaques
    featured_ids = _build_featured(active)

    return {
        'deals': deals_ids,
        'bestsellers': best_ids,
        'new_arrivals': new_ids,
        'featured': featured_ids,
    }


def compute_and_cache_home_sections():
    """Recomputa scores, constrói secções e guarda em cache. Devolve os dados."""
    refresh_featured_scores()
    data = build_home_sections()
    cache.set(HOME_SECTIONS_CACHE_KEY, data, CACHE_TIMEOUT)
    return data


def get_home_sections():
    """Devolve as secções (cache ou recomputa se vazio)."""
    data = cache.get(HOME_SECTIONS_CACHE_KEY)
    if data is None:
        data = compute_and_cache_home_sections()
    return data
