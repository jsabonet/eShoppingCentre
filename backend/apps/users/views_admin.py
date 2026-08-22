from rest_framework import permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.db.models import Sum
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from apps.notifications import email_service
from apps.users.models import User
from apps.stores.models import Store
from apps.orders.models import Order
from apps.wallet.models import WalletTransaction, Wallet
from apps.affiliates.models import AffiliateProfile
from .serializers import UserProfileSerializer, AdminUserCreateSerializer, AdminUserSerializer

UserModel = get_user_model()


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        total_revenue = WalletTransaction.objects.filter(
            type='fee', status='completed'
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'total_users': UserModel.objects.count(),
            'total_stores': Store.objects.count(),
            'total_orders': Order.objects.count(),
            'total_revenue': float(total_revenue),
            'pending_stores': Store.objects.filter(status='pending').count(),
            'pending_payouts': 0,
        })


class PendingStoresView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from apps.stores.serializers import StoreSerializer
        stores = Store.objects.filter(status='pending')
        return Response(StoreSerializer(stores, many=True).data)


class ApproveStoreView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            store = Store.objects.get(id=pk, status='pending')
            store.status = 'active'
            store.save()
            return Response({'status': 'active'})
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)


class PendingPayoutsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        payouts = []
        return Response(payouts)


class ApprovePayoutView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        return Response({'status': 'approved'})


class AdminAllStoresView(generics.ListAPIView):
    """Admin: listar TODAS as lojas (qualquer status)"""
    queryset = Store.objects.all().order_by('-created_at')
    serializer_class = None
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        from apps.stores.serializers import StoreDetailSerializer
        return StoreDetailSerializer


class AdminStoreManageView(APIView):
    """Admin: gerir loja (aprovar, rejeitar, suspender, reactivar, actualizar, eliminar)"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        """Obter detalhe completo da loja (inclui owner, métricas, logs)."""
        try:
            store = Store.objects.select_related('owner__profile').prefetch_related('moderation_logs').get(id=pk)
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)
        from apps.stores.serializers import StoreDetailSerializer
        return Response(StoreDetailSerializer(store).data)

    def _log_moderation(self, store, action, reason='', previous_status=''):
        """Create a moderation log entry."""
        from apps.stores.models import StoreModerationLog
        StoreModerationLog.objects.create(
            store=store,
            admin=self.request.user,
            action=action,
            reason=reason,
            previous_status=previous_status,
            new_status=store.status,
        )

    def delete(self, request, pk):
        """Eliminar loja permanentemente da base de dados."""
        try:
            store = Store.objects.get(id=pk)
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)

        store_name = store.name
        owner_email = store.owner.email
        owner_first_name = store.owner.first_name
        self._log_moderation(store, 'closed', 'Eliminada permanentemente por administrador', store.status)

        # Preservar nome da loja nos pedidos antes do CASCADE
        store.orders.update(store_name=store.name)

        # Delete (cascades: products, coupons, returns. orders preserved via SET_NULL)
        store.delete()

        # Notify owner
        if owner_email:
            email_service.dispatch(
                email_service.send_store_removed_email,
                owner_email, owner_first_name, store_name,
            )

        return Response({'detail': f'Loja "{store_name}" eliminada permanentemente.'}, status=200)

    def patch(self, request, pk):
        action = request.data.get('action', '')

        try:
            store = Store.objects.get(id=pk)
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)

        if action:
            valid_actions = {
                'approve': 'active', 'reject': 'rejected',
                'suspend': 'suspended', 'reactivate': 'active', 'close': 'closed',
                'request_docs': 'awaiting_documents',
                'delete': None,  # tratado abaixo
                'clear_documents': None,  # tratado abaixo
            }
            if action not in valid_actions:
                return Response({'detail': f'Acção inválida. Use: {", ".join(valid_actions.keys())}'}, status=400)

            # ─── Delete via PATCH (para compatibilidade com frontend) ───
            if action == 'delete':
                return self.delete(request, pk)

            # ─── Clear documents ───
            if action == 'clear_documents':
                docs_to_clear = request.data.get('documents', [])
                doc_fields = ['identity_document', 'tax_document', 'address_proof', 'additional_documents']
                for doc in docs_to_clear:
                    if doc in doc_fields:
                        field = getattr(store, doc)
                        if field:
                            field.delete(save=False)
                        setattr(store, doc, '')
                store.save()
                self._log_moderation(store, 'edited', f'Documentos removidos: {", ".join(docs_to_clear)}', store.status)
                from apps.stores.serializers import StoreDetailSerializer
                return Response(StoreDetailSerializer(store).data)

            previous_status = store.status
            store.status = valid_actions[action]

            # Guardar motivo de rejeição
            reason = request.data.get('reason', '')
            if action == 'reject' and reason:
                store.rejection_reason = reason

            store.save()

            # Registo de moderação
            self._log_moderation(store, action, reason, previous_status)

            # Send email notification to store owner
            owner_email = store.owner.email
            if owner_email:
                owner_first_name = store.owner.first_name
                if action == 'approve':
                    email_service.dispatch(
                        email_service.send_store_approved_email,
                        owner_email, owner_first_name, store.name,
                    )
                elif action == 'suspend':
                    email_service.dispatch(
                        email_service.send_store_suspended_email,
                        owner_email, owner_first_name, store.name,
                    )
                elif action == 'reactivate':
                    email_service.dispatch(
                        email_service.send_store_reactivated_email,
                        owner_email, owner_first_name, store.name,
                    )
                elif action == 'reject':
                    reason_text = reason or 'Não especificado'
                    email_service.dispatch(
                        email_service.send_store_rejected_email,
                        owner_email, owner_first_name, store.name, reason_text,
                    )
                elif action == 'request_docs':
                    reason_text = reason or 'Documentos adicionais necessários'
                    email_service.dispatch(
                        email_service.send_store_documents_email,
                        owner_email, owner_first_name, store.name, reason_text,
                    )

            from apps.stores.serializers import StoreDetailSerializer
            return Response(StoreDetailSerializer(store).data)

        # ─── Full field update (sem action = edição de campos) ───
        editable = ['name', 'slug', 'description', 'about', 'tagline', 'category',
                    'location', 'phone', 'email', 'website', 'shipping_policy',
                    'return_policy', 'default_affiliate_commission', 'low_stock_threshold',
                    'theme_color', 'admin_notes']
        changed = False
        for field in editable:
            if field in request.data:
                setattr(store, field, request.data[field])
                changed = True

        if changed:
            store.save()
            self._log_moderation(store, 'edited', 'Campos actualizados por administrador', store.status)

        from apps.stores.serializers import StoreDetailSerializer
        return Response(StoreDetailSerializer(store).data)


class AdminAllOrdersView(generics.ListAPIView):
    """Admin: listar TODOS os pedidos de todas as lojas"""
    from apps.orders.serializers import OrderSerializer
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminUserListView(generics.ListCreateAPIView):
    """Admin: listar e criar utilizadores"""
    queryset = UserModel.objects.all().order_by('-date_joined')
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminUserCreateSerializer
        return AdminUserSerializer


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ver, editar (verificar/bloquear/roles) e eliminar utilizador (soft-delete)."""
    queryset = UserModel.objects.all()
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer
    lookup_field = 'pk'

    def perform_update(self, serializer):
        from .views import _blacklist_user_tokens  # import local evita import circular
        user = serializer.instance
        was_active = user.is_active
        user = serializer.save()
        if was_active and not user.is_active:
            # Conta desativada/bloqueada → revoga sessões ativas
            _blacklist_user_tokens(user)
            from apps.notifications import email_service
            email_service.dispatch(email_service.send_account_blocked_email, user.email, user.first_name)
        elif not was_active and user.is_active:
            # Reativação → limpa a marca de eliminação suave
            if user.deleted_at:
                user.deleted_at = None
                user.save(update_fields=['deleted_at'])

    def destroy(self, request, *args, **kwargs):
        """DELETE → eliminação suave em cascata (não remove dados)."""
        from .views import _blacklist_user_tokens  # import local evita import circular
        user = self.get_object()
        _blacklist_user_tokens(user)
        user.soft_delete()
        return Response({
            'detail': (
                f'Conta {user.email} eliminada em modo suave: conta, loja e produtos '
                'desativados. Nenhum dado foi removido.'
            )
        })


# ─── Admin: Store Data (Chats, Followers, Reviews) ───

class AdminStoreConversationsView(APIView):
    """GET /api/v1/admin/stores/{store_id}/conversations/ — Admin vê conversas da loja."""
    permission_classes = [IsAdminUser]

    def get(self, request, store_id):
        from apps.chat.models import Conversation
        from apps.chat.serializers import ConversationListSerializer

        conversations = Conversation.objects.filter(
            store_id=store_id,
        ).select_related('buyer', 'seller', 'product').order_by('-last_message_at')[:50]

        data = ConversationListSerializer(
            conversations, many=True, context={'request': request}
        ).data
        return Response({'count': len(data), 'results': data})


class AdminStoreFollowersView(APIView):
    """GET /api/v1/admin/stores/{store_id}/followers/ — Admin vê seguidores da loja."""
    permission_classes = [IsAdminUser]

    def get(self, request, store_id):
        from apps.stores.models import StoreFollower

        followers = StoreFollower.objects.filter(
            store_id=store_id,
        ).select_related('user').order_by('-created_at')[:100]

        data = [{
            'id': str(f.id),
            'user_id': str(f.user.id),
            'user_name': f.user.first_name or f.user.email.split('@')[0],
            'user_email': f.user.email,
            'notify_new_products': f.notify_new_products,
            'created_at': f.created_at.isoformat(),
        } for f in followers]
        return Response({'count': len(data), 'results': data})


class AdminStoreReviewsView(APIView):
    """GET /api/v1/admin/stores/{store_id}/reviews/ — Admin vê reviews da loja."""
    permission_classes = [IsAdminUser]

    def get(self, request, store_id):
        from apps.reviews.models import StoreReview
        from apps.reviews.serializers import StoreReviewSerializer

        reviews = StoreReview.objects.filter(
            store_id=store_id,
        ).order_by('-created_at')[:50]

        data = StoreReviewSerializer(
            reviews, many=True, context={'request': request}
        ).data
        return Response({'count': len(data), 'results': data})


class AdminStoreReviewModerateView(APIView):
    """PATCH /api/v1/admin/reviews/{review_id}/ — Admin hides/shows a review.
       DELETE /api/v1/admin/reviews/{review_id}/ — Admin removes a review."""
    permission_classes = [IsAdminUser]

    def patch(self, request, review_id):
        from apps.reviews.models import StoreReview
        from apps.reviews.serializers import StoreReviewSerializer

        review = get_object_or_404(StoreReview, id=review_id)
        action = request.data.get('action')

        if action == 'hide':
            review.is_hidden = True
        elif action == 'show':
            review.is_hidden = False
        else:
            return Response({'detail': 'Acao invalida. Use hide ou show.'}, status=400)

        review.save(update_fields=['is_hidden'])
        return Response(StoreReviewSerializer(review, context={'request': request}).data)

    def delete(self, request, review_id):
        from apps.reviews.models import StoreReview

        review = get_object_or_404(StoreReview, id=review_id)
        review.delete()
        return Response({'deleted': True})
