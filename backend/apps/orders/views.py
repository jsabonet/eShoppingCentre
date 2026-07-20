from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order
from .serializers import OrderSerializer, CreateOrderSerializer


class CreateOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user)


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = []

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user).order_by('-created_at')


class StoreOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.store.orders.order_by('-created_at')


class UpdateOrderStatusView(generics.UpdateAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.store.orders.all()

    def perform_update(self, serializer):
        new_status = self.request.data.get('status')
        tracking_code = self.request.data.get('tracking_code')
        data = {'status': new_status}
        if tracking_code:
            data['tracking_code'] = tracking_code
        serializer.save(**data)


class CancelOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            order = Order.objects.get(id=pk, buyer=request.user)
            if order.status in ['pending', 'confirmed']:
                order.status = 'cancelled'
                order.save()
                # Restaurar stock
                for item in order.items.all():
                    if item.product and item.product.product_type == 'physical':
                        item.product.stock += item.quantity
                        item.product.save(update_fields=['stock'])
                return Response({'detail': 'Encomenda cancelada.'})
            return Response({'detail': 'Não é possível cancelar esta encomenda.'},
                          status=status.HTTP_400_BAD_REQUEST)
        except Order.DoesNotExist:
            return Response({'detail': 'Encomenda não encontrada.'},
                          status=status.HTTP_404_NOT_FOUND)
