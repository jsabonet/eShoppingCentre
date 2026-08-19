from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order, ReturnRequest, ReturnImage, OrderStatusHistory, SupportTicket, SupportTicketImage, AbandonedCart
from apps.users.permissions import IsVerified
from apps.notifications import email_service


# --- Transições de status permitidas ---
VALID_TRANSITIONS = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['processing', 'ready_for_pickup', 'cancelled'],
    'processing': ['shipped', 'ready_for_pickup', 'cancelled'],
    'shipped': ['delivered'],
    'ready_for_pickup': ['delivered'],
    'delivered': [],  # só admin pode reverter
    'cancelled': [],
    'refunded': [],
}

# Transições que NÃO são permitidas ao vendedor (só admin)
ADMIN_ONLY_TRANSITIONS = [
    ('delivered', 'processing'), ('delivered', 'confirmed'),
    ('shipped', 'confirmed'), ('shipped', 'processing'),
    ('processing', 'confirmed'), ('refunded', 'shipped'),
]


def log_status_change(order, new_status, user, notes=''):
    """Regista mudança de status no histórico de auditoria."""
    OrderStatusHistory.objects.create(
        order=order,
        previous_status=order.status,
        new_status=new_status,
        changed_by=user,
        notes=notes,
    )
from .serializers import OrderSerializer, CreateOrderSerializer, ReturnRequestSerializer, ReturnResolveSerializer, ReturnShipSerializer, ReturnImageSerializer, AdminOverrideSerializer, SupportTicketSerializer, SupportTicketImageSerializer


class CreateOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        orders = serializer.save()
        for order in orders:
            log_status_change(order, order.status, request.user, 'Encomenda criada')
            email_service.dispatch(email_service.send_order_confirmation_email, str(order.id))
            email_service.dispatch(email_service.send_new_sale_email, str(order.id))

        # Marcar carrinho como recuperado
        AbandonedCart.objects.filter(user=request.user).update(
            recovered=True, recovered_at=timezone.now(), items=[]
        )

        return Response(OrderSerializer(orders, many=True).data, status=status.HTTP_201_CREATED)


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
    """PATCH /api/v1/orders/{pk}/update-status/ — Seller updates order status.
    Só pode marcar como 'shipped'. 'delivered' requer confirmação do comprador."""
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.all()
        return self.request.user.store.orders.all()

    def perform_update(self, serializer):
        new_status = self.request.data.get('status')
        order = self.get_object()
        old_status = order.status
        is_admin = self.request.user.is_staff

        # Validações
        if not is_admin:
            if new_status not in ('shipped', 'processing', 'confirmed', 'ready_for_pickup'):
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'status': 'Só pode marcar como enviado, pronto para levantamento, em processamento ou confirmado. A entrega é confirmada pelo comprador.'
                })

            # Verificar se é downgrade proibido
            if (old_status, new_status) in ADMIN_ONLY_TRANSITIONS:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'status': f'Não é permitido voltar de "{old_status}" para "{new_status}". Contacte um administrador.'
                })

            # Verificar transição válida
            allowed = VALID_TRANSITIONS.get(old_status, [])
            if new_status not in allowed:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'status': f'Transição de "{old_status}" para "{new_status}" não é permitida.'
                })

        data = {'status': new_status}
        evidence = None
        notes = self.request.data.get('notes', '')

        if new_status == 'shipped' or new_status == 'ready_for_pickup':
            data['shipped_at'] = timezone.now()
            if new_status == 'shipped':
                data['shipping_notes'] = self.request.data.get('shipping_notes', '')
                evidence = self.request.FILES.get('shipping_evidence')
                tracking = self.request.data.get('tracking_code', '')
                if tracking:
                    data['tracking_code'] = tracking
                notes = notes or f'Enviado por: {data["shipping_notes"]}'[:500]
            else:
                notes = notes or 'Pronto para levantamento na loja'

        instance = serializer.save(**data)

        if evidence:
            instance.shipping_evidence = evidence
            instance.save(update_fields=['shipping_evidence'])

        # Auditoria
        log_status_change(instance, new_status, self.request.user, notes)

        if new_status == 'shipped':
            email_service.dispatch(email_service.send_order_shipped_email, str(instance.id))


class ConfirmDeliveryView(APIView):
    """POST /api/v1/orders/{pk}/confirm-delivery/ — Buyer confirms they received the order."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)
        if order.status not in ('shipped', 'ready_for_pickup'):
            return Response(
                {'detail': 'Só pode confirmar receção de encomendas enviadas ou prontas para levantamento.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = 'delivered'
        order.confirmed_at = timezone.now()
        order.delivered_at = timezone.now()
        order.save()

        log_status_change(order, 'delivered', request.user, 'Comprador confirmou receção')
        # (W2: o crédito ao vendedor é feito pelo escrow, libertado após entrega + 7 dias)

        from apps.notifications.models import Notification
        if order.store and order.store.owner:
            Notification.objects.create(
                user=order.store.owner,
                title='Encomenda entregue',
                message=f'O comprador confirmou a receção da encomenda {order.order_number}.',
                notification_type='order_update',
                link=f'/seller/orders/{order.id}',
            )

        return Response(OrderSerializer(order).data)


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
                        old_stock = item.product.stock
                        item.product.stock += item.quantity
                        item.product.save(update_fields=['stock'])
                        from apps.products.models import StockLog
                        StockLog.objects.create(
                            product=item.product, change_type='cancel',
                            quantity=item.quantity,
                            stock_before=old_stock, stock_after=item.product.stock,
                            reference=f'Order {order.order_number}',
                            changed_by=request.user,
                            notes='Stock restaurado por cancelamento',
                        )
                # ─── W2 Escrow: reverter retenção do vendedor (se ainda retida) ───
                from apps.wallet.services import reverse_escrow
                reverse_escrow(order)

                # ─── W1 Carteira: reembolsar o comprador ───
                if order.payment_status == 'completed' and order.total > 0:
                    from apps.wallet.services import get_wallet, credit
                    buyer_wallet = get_wallet(order.buyer)
                    credit(
                        buyer_wallet, order.total, kind='buyer',
                        ref_type='order', ref_id=order.id,
                        description=f'Reembolso por cancelamento {order.order_number}',
                        txn_type='refund',
                    )

                # Reverter comissão de afiliado (se existir)
                from apps.affiliates.services import reject_commissions_for_order
                reject_commissions_for_order(order, 'Encomenda cancelada')
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
        # Janela de devolução: 7 dias após confirmação de entrega
        if order.status == 'delivered':
            return_window = timezone.timedelta(days=7)
            delivered_date = order.confirmed_at or order.delivered_at
            if delivered_date and (timezone.now() - delivered_date) > return_window:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'order': 'O prazo de devolução (7 dias) já expirou para esta encomenda.'
                })
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


class AdminAllOrdersView(generics.ListAPIView):
    """Admin views ALL orders across all stores with status history."""
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return Order.objects.select_related('buyer', 'store').prefetch_related(
            'items', 'status_history'
        ).order_by('-created_at')


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
        email_service.dispatch(email_service.send_return_status_email, str(return_req.id), 'buyer')

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
        email_service.dispatch(email_service.send_return_status_email, str(return_req.id), 'seller')

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

        # Restaurar stock do produto devolvido
        for item in return_req.order.items.all():
            if item.product and item.product.product_type == 'physical':
                old_stock = item.product.stock
                item.product.stock += item.quantity
                item.product.save(update_fields=['stock'])
                from apps.products.models import StockLog
                StockLog.objects.create(
                    product=item.product, change_type='return',
                    quantity=item.quantity,
                    stock_before=old_stock, stock_after=item.product.stock,
                    reference=f'RMA {return_req.rma_number}',
                    changed_by=request.user,
                    notes=f'Stock restaurado por devolução',
                )

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Devolução recebida',
            message=f'O vendedor recebeu a sua devolução #{return_req.rma_number}.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )
        email_service.dispatch(email_service.send_return_status_email, str(return_req.id), 'buyer')

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

        # W2 Carteira: reembolso (reverte escrow se retido; senão debita vendedor; credita comprador)
        from apps.wallet.services import process_refund, InsufficientFunds
        try:
            with transaction.atomic():
                process_refund(
                    return_req.order, request.user, return_req.buyer, refund_amount,
                    f'Reembolso da devolução #{return_req.rma_number}',
                )
                return_req.status = 'refunded'
                return_req.save()
        except InsufficientFunds as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Reverter comissão de afiliado (se existir)
        from apps.affiliates.services import reject_commissions_for_order
        reject_commissions_for_order(return_req.order, f'Devolução #{return_req.rma_number} reembolsada')

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Reembolso processado',
            message=f'O reembolso de {refund_amount} MZN da devolução #{return_req.rma_number} foi creditado na sua carteira.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )
        email_service.dispatch(email_service.send_return_status_email, str(return_req.id), 'buyer')

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
        email_service.dispatch(email_service.send_return_status_email, str(return_req.id), 'buyer')
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

        # Reverter comissão de afiliado em caso de reembolso
        if action == 'refund':
            from apps.affiliates.services import reject_commissions_for_order
            reject_commissions_for_order(return_req.order, f'Devolução #{return_req.rma_number} reembolsada pelo admin')

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=return_req.buyer,
            title='Decisão administrativa',
            message=f'Um administrador analisou a devolução #{return_req.rma_number}.',
            notification_type='return_update',
            link=f'/account/orders/{return_req.order_id}',
        )
        email_service.dispatch(email_service.send_return_status_email, str(return_req.id), 'buyer')

        return Response(ReturnRequestSerializer(return_req).data)


# ─── Support Tickets ───

class TicketListCreateView(generics.ListCreateAPIView):
    """Comprador cria e lista os seus tickets."""
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SupportTicket.objects.filter(buyer=self.request.user).prefetch_related('images').order_by('-created_at')

    def perform_create(self, serializer):
        ticket = serializer.save(buyer=self.request.user)
        email_service.dispatch(email_service.send_ticket_email, str(ticket.id), 'created')


class AdminTicketListView(generics.ListAPIView):
    """Admin vê todos os tickets."""
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return SupportTicket.objects.select_related('order', 'buyer').prefetch_related('images').order_by('-created_at')


class SellerTicketListView(generics.ListAPIView):
    """Vendedor vê os tickets das encomendas da sua loja."""
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SupportTicket.objects.filter(
            order__store__owner=self.request.user
        ).select_related('order', 'buyer').prefetch_related('images').order_by('-created_at')


class ResolveTicketView(APIView):
    """Admin/vendedor resolve um ticket."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)
        if not request.user.is_staff and ticket.order.store.owner != request.user:
            return Response({'detail': 'Sem permissão.'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status', 'resolved')
        ticket.status = new_status
        ticket.resolution = request.data.get('resolution', '')
        if new_status == 'resolved':
            ticket.resolved_at = timezone.now()
        ticket.assigned_to = request.user
        ticket.save()

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=ticket.buyer,
            title='Ticket actualizado',
            message=f'O seu ticket "{ticket.subject}" foi {ticket.get_status_display().lower()}.',
            notification_type='support',
            link=f'/account/orders/{ticket.order_id}',
        )
        email_service.dispatch(email_service.send_ticket_email, str(ticket.id), 'updated')

        return Response(SupportTicketSerializer(ticket).data)


class UploadTicketImageView(APIView):
    """POST /api/v1/orders/tickets/{pk}/images/ — Anexa foto a um ticket."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)

        is_owner = ticket.buyer == request.user
        is_seller = ticket.order.store and ticket.order.store.owner == request.user
        if not is_owner and not request.user.is_staff and not is_seller:
            return Response({'detail': 'Sem permissão.'}, status=status.HTTP_403_FORBIDDEN)

        file = request.FILES.get('image')
        if not file:
            return Response({'detail': 'Imagem obrigatória.'}, status=400)

        caption = request.data.get('caption', '')
        image = SupportTicketImage.objects.create(ticket=ticket, image=file, caption=caption)
        return Response(SupportTicketImageSerializer(image).data, status=201)


class CartSyncView(APIView):
    """Sincroniza o carrinho do frontend (para recuperação de carrinhos abandonados)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cart = AbandonedCart.objects.filter(user=request.user).first()
        if cart and not cart.recovered:
            return Response({'items': cart.items, 'last_activity': cart.last_activity})
        return Response({'items': [], 'last_activity': None})

    def post(self, request):
        items = request.data.get('items', []) or []
        cart, _ = AbandonedCart.objects.get_or_create(user=request.user)
        cart.items = items
        cart.recovered = False
        cart.save(update_fields=['items', 'recovered', 'last_activity'])
        return Response({'ok': True})


class AdminAbandonedCartListView(APIView):
    """Admin: lista carrinhos abandonados (para estatísticas de recuperação)."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        carts = AbandonedCart.objects.filter(recovered=False).select_related('user').order_by('-last_activity')
        items = []
        for c in carts:
            if not c.items:
                continue
            items.append({
                'id': str(c.id),
                'user_email': c.user.email,
                'user_name': c.user.get_full_name() or c.user.email,
                'items_count': len(c.items),
                'items': c.items,
                'last_activity': c.last_activity.isoformat(),
                'notified_at': c.notified_at.isoformat() if c.notified_at else None,
            })
        recovered = AbandonedCart.objects.filter(recovered=True).count()
        return Response({
            'abandoned_count': len(items),
            'recovered_count': recovered,
            'results': items,
        })
