from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order, ReturnRequest, ReturnImage
from .serializers import OrderSerializer, CreateOrderSerializer, ReturnRequestSerializer, ReturnResolveSerializer, ReturnShipSerializer, ReturnImageSerializer, AdminOverrideSerializer


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


# ─── Return / Devolutions ───

class CreateReturnView(generics.CreateAPIView):
    """Buyer requests a return."""
    serializer_class = ReturnRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        order = serializer.validated_data['order']
        serializer.save(buyer=self.request.user, store=order.store)


class StoreReturnsView(generics.ListAPIView):
    """Vendor views returns for their store."""
    serializer_class = ReturnRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ReturnRequest.objects.filter(
            store=self.request.user.store
        ).prefetch_related('images').order_by('-created_at')


class AdminAllReturnsView(generics.ListAPIView):
    """Admin views ALL returns across all stores."""
    serializer_class = ReturnRequestSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return ReturnRequest.objects.select_related('order', 'buyer', 'store').prefetch_related('images').order_by('-created_at')


class ResolveReturnView(APIView):
    """PATCH /api/v1/orders/returns/{pk}/resolve/ — Vendor approves or rejects a return."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        return_req = get_object_or_404(
            ReturnRequest, pk=pk, store=request.user.store
        )
        if return_req.status not in ('requested',):
            return Response(
                {'detail': f'Não é possível resolver uma devolução com estado "{return_req.get_status_display()}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReturnResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        return_req.vendor_notes = serializer.validated_data.get('vendor_notes', '')

        if action == 'approved':
            return_req.status = 'approved'
            return_req.refund_amount = serializer.validated_data.get('refund_amount')
            return_req.return_instructions = serializer.validated_data.get('return_instructions', '')
            return_req.return_address = serializer.validated_data.get('return_address', '')
        else:
            return_req.status = 'rejected'

        return_req.save()

        # Notificação para o buyer
        from apps.notifications.models import Notification
        verb = 'aprovada' if action == 'approved' else 'rejeitada'
        Notification.objects.create(
            user=return_req.buyer,
            title=f'Devolução {verb}',
            message=f'A sua devolução #{return_req.rma_number} foi {verb} pelo vendedor.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )

        return Response(ReturnRequestSerializer(return_req).data)


class ShipReturnView(APIView):
    """PATCH /api/v1/orders/returns/{pk}/ship/ — Buyer confirms they shipped the return."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        return_req = get_object_or_404(
            ReturnRequest, pk=pk, buyer=request.user
        )
        if return_req.status != 'approved':
            return Response(
                {'detail': 'Só pode confirmar envio de devoluções aprovadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReturnShipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return_req.status = 'shipped'
        return_req.buyer_tracking_code = serializer.validated_data.get('buyer_tracking_code', '')
        return_req.shipping_notes = serializer.validated_data.get('shipping_notes', '')
        return_req.save()

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.store.owner,
            title='Devolução enviada pelo cliente',
            message=f'O cliente enviou a devolução #{return_req.rma_number}.',
            notification_type='return_update',
            link=f'/seller/orders/{return_req.order_id}',
        )

        return Response(ReturnRequestSerializer(return_req).data)


class ReceiveReturnView(APIView):
    """PATCH /api/v1/orders/returns/{pk}/receive/ — Vendor confirms receipt of returned item."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        return_req = get_object_or_404(
            ReturnRequest, pk=pk, store=request.user.store
        )
        if return_req.status not in ('approved', 'shipped'):
            return Response(
                {'detail': 'Só pode confirmar receção de devoluções aprovadas ou enviadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return_req.status = 'received'
        return_req.save()

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Devolução recebida',
            message=f'O vendedor recebeu a sua devolução #{return_req.rma_number}.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )

        return Response(ReturnRequestSerializer(return_req).data)


class RefundReturnView(APIView):
    """PATCH /api/v1/orders/returns/{pk}/refund/ — Vendor processes refund with wallet deduction."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        return_req = get_object_or_404(
            ReturnRequest, pk=pk, store=request.user.store
        )
        if return_req.status == 'disputed':
            return Response(
                {'detail': 'Esta devolução está em disputa. Apenas um administrador pode reembolsar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if return_req.status != 'received':
            return Response(
                {'detail': 'Só pode reembolsar devoluções já recebidas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refund_amount = return_req.refund_amount or return_req.order.total

        # Wallet check: does seller have enough balance?
        from apps.wallet.models import Wallet, WalletTransaction
        seller_wallet, _ = Wallet.objects.get_or_create(user=request.user)
        if seller_wallet.balance < refund_amount:
            return Response(
                {'detail': f'Saldo insuficiente na carteira. Necessário: {refund_amount} MZN, Disponível: {seller_wallet.balance} MZN.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Deduct from seller
            seller_wallet.balance -= refund_amount
            seller_wallet.save()
            WalletTransaction.objects.create(
                wallet=seller_wallet, type='refund', amount=-refund_amount,
                status='completed',
                description=f'Reembolso da devolução #{return_req.rma_number}',
            )

            # Credit buyer
            buyer_wallet, _ = Wallet.objects.get_or_create(user=return_req.buyer)
            buyer_wallet.balance += refund_amount
            buyer_wallet.save()
            WalletTransaction.objects.create(
                wallet=buyer_wallet, type='refund', amount=refund_amount,
                status='completed',
                description=f'Reembolso recebido da devolução #{return_req.rma_number}',
            )

            return_req.status = 'refunded'
            return_req.save()

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Reembolso processado',
            message=f'O reembolso de {refund_amount} MZN da devolução #{return_req.rma_number} foi creditado na sua carteira.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )

        return Response(ReturnRequestSerializer(return_req).data)


class MyReturnsView(generics.ListAPIView):
    """GET /api/v1/orders/returns/my/ — Buyer views their own returns."""
    serializer_class = ReturnRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ReturnRequest.objects.filter(
            buyer=self.request.user
        ).prefetch_related('images').order_by('-created_at')


class UploadReturnImageView(APIView):
    """POST /api/v1/orders/returns/{pk}/images/ — Upload photos for a return."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return_req = get_object_or_404(
            ReturnRequest, pk=pk, buyer=request.user
        )
        if return_req.status != 'requested':
            return Response(
                {'detail': 'Só pode adicionar imagens a devoluções recém-solicitadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file = request.FILES.get('image')
        if not file:
            return Response({'detail': 'Imagem obrigatória.'}, status=400)

        caption = request.data.get('caption', '')
        image = ReturnImage.objects.create(
            return_request=return_req, image=file, caption=caption
        )
        return Response(ReturnImageSerializer(image).data, status=201)


class DisputeReturnView(APIView):
    """POST /api/v1/orders/returns/{pk}/dispute/ — Buyer escalates rejected return to admin."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return_req = get_object_or_404(
            ReturnRequest, pk=pk, buyer=request.user
        )
        if return_req.status != 'rejected':
            return Response(
                {'detail': 'Só pode contestar devoluções rejeitadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return_req.status = 'disputed'
        return_req.disputed_at = timezone.now()
        return_req.save()

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Disputa enviada',
            message=f'A sua contestação da devolução #{return_req.rma_number} foi enviada para análise.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )
        # Notify admins could be added here

        return Response(ReturnRequestSerializer(return_req).data)


class AdminOverrideView(APIView):
    """PATCH /api/v1/orders/returns/{pk}/admin-override/ — Admin forces a decision on a disputed return."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk):
        return_req = get_object_or_404(ReturnRequest, pk=pk)

        serializer = AdminOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        return_req.admin_notes = serializer.validated_data['admin_notes']
        return_req.reviewed_by = request.user

        if action == 'approve':
            return_req.status = 'approved'
            return_req.refund_amount = serializer.validated_data.get('refund_amount')
            return_req.return_instructions = serializer.validated_data.get('return_instructions', '')
            return_req.return_address = serializer.validated_data.get('return_address', '')
        elif action == 'reject':
            return_req.status = 'rejected'
            return_req.vendor_notes = f'[Decisão do Admin] {return_req.admin_notes}'
        elif action == 'refund':
            return_req.status = 'refunded'

        return_req.save()

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Decisão administrativa',
            message=f'Um administrador analisou a devolução #{return_req.rma_number}.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )

        return Response(ReturnRequestSerializer(return_req).data)
