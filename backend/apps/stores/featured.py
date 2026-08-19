"""Curadoria das "Lojas em Destaque" da home.

Score determinístico (Nível 1), pré-computado e guardado em cache.
Sem machine learning — mesma filosofia de apps/products/scoring.py.
"""
import logging

from django.core.cache import cache
from django.db.models import Count, Q

from .models import Store

logger = logging.getLogger(__name__)

FEATURED_STORES_CACHE_KEY = 'featured_stores'
CACHE_TIMEOUT = 3600  # 1 hora
FEATURED_STORES_CAP = 8
CANDIDATE_LIMIT = 100  # pool inicial para scoring


def _annotated_queryset():
    """Lojas activas com contagens agregadas necessárias ao score/card."""
    return Store.objects.filter(status='active').annotate(
        _review_count=Count('reviews', filter=Q(reviews__is_hidden=False)),
        _followers_count=Count('followers'),
        _product_count=Count('products', filter=~Q(products__status='deleted')),
    )


def _store_score(store):
    """Score composto (0..1). Verificação do dono dá prioridade."""
    rating = float(store.rating or 0)
    reviews = int(getattr(store, '_review_count', 0) or 0)
    followers = int(getattr(store, '_followers_count', 0) or 0)
    sales = int(store.total_sales or 0)
    products = int(getattr(store, '_product_count', 0) or 0)
    verified = 1.0 if getattr(store.owner, 'is_verified', False) else 0.0

    rating_norm = rating / 5.0
    sales_norm = min(sales / 500.0, 1.0)
    products_norm = min(products / 50.0, 1.0)
    reviews_norm = min(reviews / 100.0, 1.0)
    followers_norm = min(followers / 500.0, 1.0)

    score = (
        0.35 * rating_norm
        + 0.25 * sales_norm
        + 0.15 * products_norm
        + 0.10 * reviews_norm
        + 0.10 * followers_norm
        + 0.05 * verified
    )
    return round(score, 4)


def _store_payload(store):
    """Dict JSON-safe para o card da home."""
    return {
        'id': str(store.id),
        'name': store.name,
        'slug': store.slug,
        'tagline': store.tagline,
        'logo': store.logo.url if store.logo else None,
        'banner': store.banner.url if store.banner else None,
        'theme_color': store.theme_color or '#2563eb',
        'category': store.category,
        'location': store.location,
        'rating': float(store.rating or 0),
        'total_sales': int(store.total_sales or 0),
        'total_products': int(getattr(store, '_product_count', 0) or 0),
        'tier': store.tier,
        'tier_display': store.tier_display,
        'owner_verified': bool(getattr(store.owner, 'is_verified', False)),
        'review_count': int(getattr(store, '_review_count', 0) or 0),
        'followers_count': int(getattr(store, '_followers_count', 0) or 0),
    }


def build_featured_stores(limit=FEATURED_STORES_CAP):
    """Constroi a lista ordenada de lojas em destaque (payload pronto)."""
    candidates = list(
        _annotated_queryset()
        .select_related('owner')
        .order_by('-total_sales')[:CANDIDATE_LIMIT]
    )
    candidates.sort(key=_store_score, reverse=True)
    return [_store_payload(s) for s in candidates[:limit]]


def get_featured_stores():
    """Devolve as lojas em destaque (cache ou recomputa se vazio)."""
    data = cache.get(FEATURED_STORES_CACHE_KEY)
    if data is None:
        data = build_featured_stores()
        cache.set(FEATURED_STORES_CACHE_KEY, data, CACHE_TIMEOUT)
    return data
