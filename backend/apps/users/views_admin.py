from rest_framework import permissions, generics, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.db.models import Count, Sum
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.utils.dateparse import parse_date
from django.db.models import Q
from apps.notifications import email_service
from apps.users.models import User
from apps.stores.models import Store
from apps.orders.models import Order
from apps.wallet.models import WalletTransaction, Wallet
from apps.affiliates.models import AffiliateProfile
from rest_framework.exceptions import ValidationError
from .serializers import UserProfileSerializer, AdminUserCreateSerializer, AdminUserSerializer

UserModel = get_user_model()


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        date_from_value = request.query_params.get('date_from')
        date_to_value = request.query_params.get('date_to')
        if bool(date_from_value) != bool(date_to_value):
            raise ValidationError({'date': 'Indique as datas inicial e final.'})

        date_from = parse_date(date_from_value) if date_from_value else None
        date_to = parse_date(date_to_value) if date_to_value else None
        if date_from_value and date_from is None:
            raise ValidationError({'date_from': 'Use uma data válida no formato AAAA-MM-DD.'})
        if date_to_value and date_to is None:
            raise ValidationError({'date_to': 'Use uma data válida no formato AAAA-MM-DD.'})
        if date_from and date_to and date_from > date_to:
            raise ValidationError({'date_to': 'A data final deve ser igual ou posterior à inicial.'})

        def for_period(queryset, field='created_at'):
            if date_from:
                queryset = queryset.filter(**{f'{field}__date__gte': date_from})
                queryset = queryset.filter(**{f'{field}__date__lte': date_to})
            return queryset

        revenue_transactions = for_period(WalletTransaction.objects.filter(
            type='fee', status='completed'
        ))
        total_revenue = revenue_transactions.aggregate(total=Sum('amount'))['total'] or 0
        orders = for_period(Order.objects.all())
        users = for_period(UserModel.objects.all(), 'date_joined')
        stores = for_period(Store.objects.all())
        from apps.products.models import Product
        products = for_period(Product.objects.all())

        return Response({
            'date_from': date_from.isoformat() if date_from else None,
            'date_to': date_to.isoformat() if date_to else None,
            'total_products': products.count(),
            'total_users': users.count(),
            'total_stores': stores.count(),
            'total_orders': orders.count(),
            'total_revenue': float(total_revenue),
            'pending_stores': stores.filter(status='pending').count(),
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
            from apps.products.models import Product
            Product.objects.filter(store=store, status='inactive').update(status='active')
            cache.delete('home_sections')
            return Response({'status': 'active'})
        except Store.DoesNotExist:
            return Response({'detail': 'Loja não encontrada.'}, status=404)


class AdminStoreReportSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    total_products = serializers.IntegerField(source='_admin_total_products', read_only=True)

    class Meta:
        model = Store
        fields = (
            'id', 'name', 'logo', 'category', 'location', 'email',
            'status', 'owner_name', 'owner_email', 'total_products',
            'total_sales', 'created_at',
        )

    def get_owner_name(self, obj):
        return obj.owner.get_full_name()


class AdminAllStoresView(generics.ListAPIView):
    """Admin: listar TODAS as lojas (qualquer status)"""
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = Store.objects.select_related('owner').annotate(
            _admin_total_products=Count('products', filter=~Q(products__status='deleted'))
        ).order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        status_filter = self.request.query_params.get('status', '').strip()
        category = self.request.query_params.get('category', '').strip()
        date_from_value = self.request.query_params.get('date_from')
        date_to_value = self.request.query_params.get('date_to')

        if bool(date_from_value) != bool(date_to_value):
            raise ValidationError({'date': 'Indique as datas inicial e final.'})
        date_from = parse_date(date_from_value) if date_from_value else None
        date_to = parse_date(date_to_value) if date_to_value else None
        if date_from_value and date_from is None:
            raise ValidationError({'date_from': 'Use uma data válida no formato AAAA-MM-DD.'})
        if date_to_value and date_to is None:
            raise ValidationError({'date_to': 'Use uma data válida no formato AAAA-MM-DD.'})
        if date_from and date_to and date_from > date_to:
            raise ValidationError({'date_to': 'A data final deve ser igual ou posterior à inicial.'})

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(owner__email__icontains=search) |
                Q(owner__first_name__icontains=search) |
                Q(owner__last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(location__icontains=search)
            )
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if category:
            queryset = queryset.filter(category__icontains=category)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)
        return queryset

    def get_serializer_class(self):
        return AdminStoreReportSerializer


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

    @staticmethod
    def _sync_products_with_status(store):
        """Oculta produtos quando a loja não está activa; repõe quando activa."""
        from apps.products.models import Product
        if store.status == 'active':
            Product.objects.filter(store=store, status='inactive').update(status='active')
        else:
            Product.objects.filter(store=store, status='active').update(status='inactive')

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
        cache.delete('home_sections')

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

            # Sincronizar visibilidade dos produtos + invalidar cache da home
            self._sync_products_with_status(store)
            cache.delete('home_sections')

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
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        users = UserModel.objects.all()
        if self.request.query_params.get('include_deleted') != 'true':
            users = users.filter(deleted_at__isnull=True)
        return users.order_by('-date_joined')

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
            # Reativação → limpa a marca de eliminação suave e notifica o utilizador
            if user.deleted_at:
                user.deleted_at = None
                user.save(update_fields=['deleted_at'])
            from apps.notifications import email_service
            email_service.dispatch(email_service.send_account_reactivated_email, user.email, user.first_name)

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
