from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.products.models import Product
from .models import ShippingZone, ShippingMethod, ShippingRate
from .serializers import (
    ShippingZoneSerializer, ShippingZoneWriteSerializer,
    ShippingMethodSerializer, ShippingMethodWriteSerializer,
    ShippingRateSerializer, ShippingRateWriteSerializer,
    EstimateRequestSerializer,
)


# ─── Helpers ───

def _get_seller_store(request):
    """Obtém a loja do vendedor autenticado."""
    store = getattr(request.user, 'store', None)
    if not store:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Nenhuma loja encontrada para este utilizador.')
    return store


# ─── Shipping Zones (CRUD Seller) ───

class ZoneListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ShippingZoneSerializer
        return ShippingZoneWriteSerializer

    def get_queryset(self):
        return ShippingZone.objects.filter(store=_get_seller_store(self.request))

    def perform_create(self, serializer):
        serializer.save(store=_get_seller_store(self.request))


class ZoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ShippingZoneSerializer
        return ShippingZoneWriteSerializer

    def get_queryset(self):
        return ShippingZone.objects.filter(store=_get_seller_store(self.request))


# ─── Shipping Methods (CRUD Seller) ───

class MethodListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ShippingMethodSerializer
        return ShippingMethodWriteSerializer

    def get_queryset(self):
        return ShippingMethod.objects.filter(store=_get_seller_store(self.request))

    def perform_create(self, serializer):
        serializer.save(store=_get_seller_store(self.request))


class MethodDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ShippingMethodSerializer
        return ShippingMethodWriteSerializer

    def get_queryset(self):
        return ShippingMethod.objects.filter(store=_get_seller_store(self.request))


# ─── Shipping Rates (CRUD Seller) ───

class RateListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShippingRateWriteSerializer

    def get_queryset(self):
        store = _get_seller_store(self.request)
        return ShippingRate.objects.filter(method__store=store)

    def perform_create(self, serializer):
        store = _get_seller_store(self.request)
        method = serializer.validated_data.get('method')
        if method.store_id != store.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Este método não pertence à sua loja.')
        serializer.save()


class RateDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShippingRateWriteSerializer

    def get_queryset(self):
        return ShippingRate.objects.filter(method__store=_get_seller_store(self.request))


# ─── Estimate Endpoint (Público) ───

class ShippingEstimateView(APIView):
    """
    POST /api/v1/shipping/estimate/
    Calcula o frete para um conjunto de produtos e uma província.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        req_serializer = EstimateRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        items = req_serializer.validated_data['items']
        province = req_serializer.validated_data['province']

        # Agrupar produtos por loja
        store_items = {}
        for item in items:
            try:
                product = Product.objects.select_related('store').get(
                    id=item['product_id'], status='active', store__status='active'
                )
            except Product.DoesNotExist:
                return Response(
                    {'detail': f'Produto {item["product_id"]} não encontrado.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Ignorar produtos não-físicos (sem frete)
            if product.product_type != 'physical':
                continue

            store_id = str(product.store_id)
            if store_id not in store_items:
                store_items[store_id] = {
                    'store': product.store,
                    'items': [],
                    'total_weight': 0.0,
                    'subtotal': 0.0,
                }

            weight = float(product.weight or 0.5)  # default 0.5 kg se não definido
            qty = item['quantity']
            store_items[store_id]['total_weight'] += weight * qty
            store_items[store_id]['subtotal'] += float(product.price) * qty

        # Calcular opções de envio para cada loja
        result_stores = []
        for store_id, data in store_items.items():
            store = data['store']

            # Encontrar zonas que cobrem a província
            zones = ShippingZone.objects.filter(
                store=store, is_active=True,
                provinces__contains=[province],
            )

            if not zones.exists():
                # Loja não entrega nesta província
                result_stores.append({
                    'store_id': store_id,
                    'store_name': store.name,
                    'total_weight_kg': round(data['total_weight'], 2),
                    'subtotal': round(data['subtotal'], 2),
                    'available_methods': [],
                    'error': f'{store.name} não entrega nesta região.',
                })
                continue

            # Para cada zona, encontrar tarifas activas
            available = []
            for zone in zones:
                rates = ShippingRate.objects.filter(
                    zone=zone, is_active=True,
                    method__is_active=True,
                ).select_related('method', 'zone')

                for rate in rates:
                    calc = rate.calculate(data['total_weight'], data['subtotal'])
                    if calc is not None:
                        available.append({
                            'rate_id': str(rate.id),
                            'method_name': rate.method.name,
                            'zone_name': zone.name,
                            'price': calc['price'],
                            'is_free': calc['is_free'],
                            'free_shipping_min': calc.get('free_shipping_min'),
                            'estimated_days': calc['estimated_days'],
                        })

            # Ordenar por preço (mais barato primeiro)
            available.sort(key=lambda x: x['price'])

            result_stores.append({
                'store_id': store_id,
                'store_name': store.name,
                'total_weight_kg': round(data['total_weight'], 2),
                'subtotal': round(data['subtotal'], 2),
                'available_methods': available,
            })

        # Totais agregados
        all_methods = [m for s in result_stores for m in s.get('available_methods', [])]
        prices = [m['price'] for m in all_methods]
        total_shipping_min = min(prices) if prices else 0
        total_shipping_max = max(prices) if prices else 0

        return Response({
            'stores': result_stores,
            'total_shipping_min': total_shipping_min,
            'total_shipping_max': total_shipping_max,
        })
