from rest_framework import permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.db.models import Sum
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from apps.users.models import User
from apps.stores.models import Store
from apps.orders.models import Order
from apps.wallet.models import WalletTransaction, Wallet
from apps.affiliates.models import AffiliateProfile
from .serializers import UserProfileSerializer, AdminUserCreateSerializer

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
        self._log_moderation(store, 'closed', 'Eliminada permanentemente por administrador', store.status)

        # Preservar nome da loja nos pedidos antes do CASCADE
        store.orders.update(store_name=store.name)

        # Delete (cascades: products, coupons, returns. orders preserved via SET_NULL)
        store.delete()

        # Notify owner
        if owner_email:
            send_mail(
                subject=f'A sua loja "{store_name}" foi removida',
                message=f'Olá,\n\n'
                        f'A sua loja "{store_name}" foi removida permanentemente do eShoppingCentre '
                        f'por um administrador.\n\n'
                        f'Para mais informações, contacte o suporte.\n\n'
                        f'Equipa eShoppingCentre',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[owner_email],
                fail_silently=True,
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
                if action == 'approve':
                    send_mail(
                        subject=f'🎉 A sua loja "{store.name}" foi aprovada!',
                        message=f'Olá {store.owner.get_full_name() or store.owner.email},\n\n'
                                f'A sua loja "{store.name}" foi aprovada e já está activa no eShoppingCentre.\n\n'
                                f'Aceda ao seu painel de vendedor: https://eshoppingcentre.co.mz/seller/dashboard\n\n'
                                f'Obrigado por se juntar a nós!\nEquipa eShoppingCentre',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[owner_email],
                        fail_silently=True,
                    )
                elif action == 'suspend':
                    send_mail(
                        subject=f'A sua loja "{store.name}" foi suspensa',
                        message=f'Olá {store.owner.get_full_name() or store.owner.email},\n\n'
                                f'A sua loja "{store.name}" foi suspensa por um administrador.\n\n'
                                f'Os seus produtos foram removidos do marketplace. '
                                f'Contacte o suporte para mais informações.\n\n'
                                f'Equipa eShoppingCentre',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[owner_email],
                        fail_silently=True,
                    )
                elif action == 'reactivate':
                    send_mail(
                        subject=f'A sua loja "{store.name}" foi reactivada!',
                        message=f'Olá {store.owner.get_full_name() or store.owner.email},\n\n'
                                f'A sua loja "{store.name}" foi reactivada e já está novamente activa '
                                f'no eShoppingCentre.\n\n'
                                f'Aceda ao seu painel: https://eshoppingcentre.co.mz/seller/dashboard\n\n'
                                f'Equipa eShoppingCentre',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[owner_email],
                        fail_silently=True,
                    )
                elif action == 'reject':
                    reason_text = reason or 'Não especificado'
                    send_mail(
                        subject=f'A sua loja "{store.name}" precisa de ajustes',
                        message=f'Olá {store.owner.get_full_name() or store.owner.email},\n\n'
                                f'A sua loja "{store.name}" não foi aprovada desta vez.\n\n'
                                f'Motivo: {reason_text}\n\n'
                                f'Por favor, corrija os dados e submeta novamente.\n'
                                f'Aceda: https://eshoppingcentre.co.mz/seller/register\n\n'
                                f'Equipa eShoppingCentre',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[owner_email],
                        fail_silently=True,
                    )
                elif action == 'request_docs':
                    reason_text = reason or 'Documentos adicionais necessários'
                    send_mail(
                        subject=f'📎 Documentos necessários para a loja "{store.name}"',
                        message=f'Olá {store.owner.get_full_name() or store.owner.email},\n\n'
                                f'A sua loja "{store.name}" está em análise e precisamos de documentos adicionais.\n\n'
                                f'Motivo: {reason_text}\n\n'
                                f'Por favor, aceda ao seu painel e envie os documentos solicitados:\n'
                                f'https://eshoppingcentre.co.mz/seller/settings\n\n'
                                f'Equipa eShoppingCentre',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[owner_email],
                        fail_silently=True,
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
        return UserProfileSerializer


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ver, editar e eliminar utilizador"""
    queryset = UserModel.objects.all()
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserProfileSerializer
        return UserProfileSerializer


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
