from celery import shared_task

from .scoring import compute_and_cache_home_sections


@shared_task
def refresh_home_sections():
    """Recomputa e cacheia as 4 secções da home (de hora em hora)."""
    data = compute_and_cache_home_sections()
    return {
        'deals': len(data.get('deals', [])),
        'bestsellers': len(data.get('bestsellers', [])),
        'new_arrivals': len(data.get('new_arrivals', [])),
        'featured': len(data.get('featured', [])),
    }
