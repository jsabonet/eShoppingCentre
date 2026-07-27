from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer


class StoreStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'store'):
            return Response({
                'today_sales': 0, 'today_revenue': 0, 'total_revenue': 0,
                'total_products': 0, 'total_orders': 0, 'pending_orders': 0,
                'store_rating': 0, 'recent_orders': [], 'top_products': [],
            })
        store = request.user.store
        today = timezone.now().date()
        today_start = timezone.make_aware(
            timezone.datetime.combine(today, timezone.datetime.min.time())
        )

        orders = store.orders.all()
        today_orders = orders.filter(created_at__gte=today_start)
        completed_orders = orders.filter(payment_status='completed')

        total_revenue = float(completed_orders.aggregate(
            total=Sum('total'))['total'] or 0)

        today_revenue = float(today_orders.filter(payment_status='completed').aggregate(
            total=Sum('total'))['total'] or 0)

        # Recent orders (last 5)
        recent = orders.select_related('buyer').order_by('-created_at')[:5]
        recent_data = []
        for o in recent:
            recent_data.append({
                'id': str(o.id),
                'order_number': o.order_number,
                'customer': o.buyer.get_full_name() or o.buyer.email,
                'items_count': o.items.count(),
                'total': float(o.total),
                'status': o.status,
                'status_display': o.get_status_display(),
                'payment_method': o.payment_method,
                'created_at': o.created_at.isoformat(),
            })

        # Top products
        from apps.products.models import Product
        top = Product.objects.filter(
            store=store, status='active'
        ).order_by('-sales_count')[:5]
        top_data = [{
            'id': str(p.id),
            'name': p.name,
            'slug': p.slug,
            'sales': p.sales_count,
            'revenue': float(p.price) * p.sales_count,
            'image': p.images.filter(is_primary=True).first().image.url if p.images.filter(is_primary=True).exists() else None,
        } for p in top]

        return Response({
            # Stats cards — common
            'product_type': store.product_type,
            'today_sales': today_orders.count(),
            'today_revenue': today_revenue,
            'total_revenue': total_revenue,
            'total_products': store.products.filter(status='active').count(),
            'total_orders': orders.count(),
            'pending_orders': orders.filter(status='pending').count(),
            'store_rating': float(store.rating),
            # Type-specific stats
            'downloaded_today': 0,  # placeholder for digital products
            'active_students': 0,   # placeholder for courses
            # Lists
            'recent_orders': recent_data,
            'top_products': top_data,
        })


class StoreEarningsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'store') or not hasattr(request.user, 'wallet'):
            return Response({'transactions': []})
        from apps.wallet.serializers import WalletTransactionSerializer
        wallet = request.user.wallet
        transactions = wallet.transactions.filter(type='sale').order_by('-created_at')[:50]
        serializer = WalletTransactionSerializer(transactions, many=True)
        return Response({'transactions': serializer.data})
