import uuid
from decimal import Decimal, InvalidOperation
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import models
from django.db.models import F
from django.conf import settings
from django.shortcuts import redirect, get_object_or_404
from django.utils import timezone
from .models import AffiliateProfile, AffiliateLink, AffiliateCommission, AffiliateSettings, AffiliatePayout, AffiliateKYC
from .serializers import (AffiliateProfileSerializer, AffiliateLinkSerializer, AffiliateCommissionSerializer,
                          AffiliateSettingsSerializer, AffiliatePayoutSerializer, AffiliateKYCSerializer)
from apps.products.models import Product
from apps.users.permissions import IsVerified


class AffiliateRegisterView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request):
        profile, created = AffiliateProfile.objects.get_or_create(
            user=request.user,
            defaults={'referral_code': uuid.uuid4().hex[:12].upper()}
        )
        # Garantir que o utilizador tem o papel 'affiliate'
        roles = set(request.user.roles or [])
        if 'affiliate' not in roles:
            roles.add('affiliate')
            request.user.roles = list(roles)
            request.user.save(update_fields=['roles'])
        return Response(AffiliateProfileSerializer(profile).data,
                       status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MyAffiliateProfileView(generics.RetrieveAPIView):
    serializer_class = AffiliateProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.affiliate_profile


class MyAffiliateStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = request.user.affiliate_profile
        pending = profile.commissions.filter(status='pending').aggregate(
            total=models.Sum('amount')
        )['total'] or 0
        return Response({
            'total_clicks': profile.total_clicks,
            'total_sales': profile.total_sales,
            'total_commission': float(profile.total_commission),
            'pending_commission': float(pending),
        })


class CreateAffiliateLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = request.user.affiliate_profile
        product_id = request.data.get('product_id')

        product = Product.objects.filter(id=product_id, status='active').first()
        if not product:
            return Response({'detail': 'Produto não encontrado.'}, status=400)

        settings_obj = AffiliateSettings.get_settings()
        if not settings_obj.affiliate_program_active:
            return Response({'detail': 'O programa de afiliados está temporariamente desactivado.'}, status=400)
        if not product.affiliate_enabled:
            return Response({'detail': 'Este produto não está disponível para afiliação.'}, status=400)

        link, created = AffiliateLink.objects.get_or_create(
            affiliate=profile,
            product_id=product_id,
            defaults={'code': uuid.uuid4().hex[:12].upper()}
        )
        return Response(AffiliateLinkSerializer(link).data,
                       status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MyAffiliateLinksView(generics.ListAPIView):
    serializer_class = AffiliateLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.affiliate_profile.links.all()


class MyCommissionsView(generics.ListAPIView):
    serializer_class = AffiliateCommissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.affiliate_profile.commissions.all().order_by('-created_at')


class AffiliatePayoutView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get(self, request):
        payouts = request.user.affiliate_profile.payouts.all()
        return Response(AffiliatePayoutSerializer(payouts, many=True).data)

    def post(self, request):
        profile = request.user.affiliate_profile
        settings_obj = AffiliateSettings.get_settings()

        # Gate: verificação KYC obrigatória antes do 1º saque
        kyc = AffiliateKYC.objects.filter(affiliate=profile).first()
        if not kyc or kyc.status != 'approved':
            return Response(
                {'detail': 'É necessária a verificação da conta (KYC) antes de solicitar saques. Complete a verificação.'},
                status=400,
            )

        try:
            amount = Decimal(str(request.data.get('amount')))
        except (ValueError, InvalidOperation, TypeError):
            return Response({'detail': 'Valor inválido.'}, status=400)

        if amount < settings_obj.min_payout_amount:
            return Response(
                {'detail': f'O valor mínimo de saque é {settings_obj.min_payout_amount} MZN.'},
                status=400,
            )
        if amount > profile.available_commission:
            return Response(
                {'detail': f'Saldo insuficiente. Disponível: {profile.available_commission} MZN.'},
                status=400,
            )

        payout = AffiliatePayout.objects.create(
            affiliate=profile,
            amount=amount,
            method=request.data.get('method', 'mpesa'),
            account_details=request.data.get('account_details', {}) or {},
        )

        # Notificar admins sobre o novo pedido de saque
        from apps.notifications.models import Notification
        from apps.users.models import User
        for admin in User.objects.filter(is_staff=True):
            Notification.objects.create(
                user=admin,
                title='Novo pedido de saque',
                message=f'{profile.user.email} solicitou um saque de {amount} MZN.',
                notification_type='affiliate',
                link='/admin?tab=affiliates',
            )

        return Response(AffiliatePayoutSerializer(payout).data, status=201)


class AffiliateKYCView(APIView):
    """Afiliado consulta/submete a verificação de identidade (KYC)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = request.user.affiliate_profile
        kyc = AffiliateKYC.objects.filter(affiliate=profile).first()
        if kyc:
            return Response(AffiliateKYCSerializer(kyc).data)
        return Response({'status': 'none', 'is_verified': False})

    def post(self, request):
        profile = request.user.affiliate_profile
        kyc = AffiliateKYC.objects.filter(affiliate=profile).first()
        if kyc and kyc.status == 'approved':
            return Response({'detail': 'A sua conta já está verificada.'}, status=400)

        serializer = AffiliateKYCSerializer(kyc, data=request.data, partial=bool(kyc))
        serializer.is_valid(raise_exception=True)
        if kyc:
            serializer.save(status='pending')
        else:
            serializer.save(affiliate=profile, status='pending')
        return Response(serializer.data, status=201 if not kyc else 200)


class StoreAffiliatesView(APIView):
    """Vendor: list affiliates who promoted this store's products."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Count
        store = request.user.store
        # Affiliates who have links to this store's products
        links = AffiliateLink.objects.filter(
            product__store=store
        ).select_related('affiliate__user')

        # Group by affiliate
        affiliate_data = {}
        for link in links:
            aff = link.affiliate
            if aff.id not in affiliate_data:
                affiliate_data[aff.id] = {
                    'id': str(aff.id),
                    'name': aff.user.get_full_name() or aff.user.email,
                    'email': aff.user.email,
                    'total_clicks': 0,
                    'total_sales': 0,
                    'total_commission': 0.0,
                    'is_active': aff.is_active,
                }
            affiliate_data[aff.id]['total_clicks'] += link.clicks
            affiliate_data[aff.id]['total_sales'] += link.conversions
            # Calculate commission for this affiliate from this store
            comm = AffiliateCommission.objects.filter(
                affiliate=aff, product__store=store,
                status__in=['approved', 'paid']
            ).aggregate(total=Sum('amount'))['total'] or 0
            affiliate_data[aff.id]['total_commission'] += float(comm)

        result = list(affiliate_data.values())

        # Totals
        total_clicks = sum(a['total_clicks'] for a in result)
        total_sales = sum(a['total_sales'] for a in result)
        total_commission = sum(a['total_commission'] for a in result)

        return Response({
            'affiliates': result,
            'total_affiliates': len(result),
            'total_clicks': total_clicks,
            'total_sales': total_sales,
            'total_commission': total_commission,
        })


def affiliate_click(request, code):
    """GET /r/{code}/ — regista o clique, define cookie de atribuição e redireciona."""
    link = AffiliateLink.objects.filter(code=code).select_related('product', 'affiliate').first()
    target = f'{settings.FRONTEND_URL}/product/{link.product.slug}' if link else settings.FRONTEND_URL

    if link and link.affiliate.is_active:
        settings_obj = AffiliateSettings.get_settings()
        product_enabled = getattr(link.product, 'affiliate_enabled', True)
        program_active = settings_obj.affiliate_program_active

        # Produto desligado ou programa global inactivo: redirecciona sem atribuir
        if not product_enabled or not program_active:
            return redirect(target)

        AffiliateLink.objects.filter(pk=link.pk).update(clicks=F('clicks') + 1)
        AffiliateProfile.objects.filter(pk=link.affiliate_id).update(total_clicks=F('total_clicks') + 1)

        # Janela de cookie: produto > global
        cookie_days = link.product.affiliate_cookie_days or settings_obj.cookie_window_days
        response = redirect(target)
        response.set_cookie('ref', link.code, max_age=cookie_days * 24 * 60 * 60, samesite='Lax')
        return response
    return redirect(target)


# ─── Admin ───

class AdminAffiliateListView(generics.ListAPIView):
    """Admin: lista todos os afiliados."""
    serializer_class = AffiliateProfileSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return AffiliateProfile.objects.select_related('user').order_by('-created_at')


class AdminAffiliateStatusView(APIView):
    """Admin: aprova/suspende um afiliado."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk):
        profile = get_object_or_404(AffiliateProfile, pk=pk)
        new_status = request.data.get('status')
        if new_status in ['active', 'suspended', 'pending']:
            profile.status = new_status
            profile.is_active = (new_status == 'active')
            profile.save(update_fields=['status', 'is_active'])
        return Response(AffiliateProfileSerializer(profile).data)


class AdminAffiliateSettingsView(APIView):
    """Admin: lê/configura as definições globais do programa."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        return Response(AffiliateSettingsSerializer(AffiliateSettings.get_settings()).data)

    def patch(self, request):
        settings_obj = AffiliateSettings.get_settings()
        serializer = AffiliateSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminAffiliateCommissionListView(generics.ListAPIView):
    """Admin: lista todas as comissões."""
    serializer_class = AffiliateCommissionSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return AffiliateCommission.objects.select_related('affiliate__user', 'order', 'product').order_by('-created_at')


class AdminAffiliateCommissionActionView(APIView):
    """Admin: aprova/rejeita manualmente uma comissão."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk):
        comm = get_object_or_404(AffiliateCommission, pk=pk)
        action = request.data.get('action')
        if action == 'approve' and comm.status == 'pending':
            comm.status = 'approved'
            comm.save(update_fields=['status'])
            AffiliateProfile.objects.filter(pk=comm.affiliate_id).update(
                total_commission=F('total_commission') + comm.amount
            )
        elif action == 'reject' and comm.status in ['pending', 'approved']:
            was_approved = comm.status == 'approved'
            comm.status = 'rejected'
            comm.rejection_reason = request.data.get('reason', 'Rejeitada pelo admin')
            comm.save(update_fields=['status', 'rejection_reason'])
            if was_approved:
                AffiliateProfile.objects.filter(pk=comm.affiliate_id).update(
                    total_commission=F('total_commission') - comm.amount
                )
        return Response(AffiliateCommissionSerializer(comm).data)


class AdminAffiliatePayoutListView(generics.ListAPIView):
    """Admin: lista os pedidos de saque."""
    serializer_class = AffiliatePayoutSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return AffiliatePayout.objects.select_related('affiliate__user').order_by('-created_at')


class AdminAffiliatePayoutActionView(APIView):
    """Admin: aprova/rejeita um pedido de saque."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk):
        payout = get_object_or_404(AffiliatePayout, pk=pk)
        action = request.data.get('action')
        if action == 'approve' and payout.status == 'pending':
            payout.status = 'paid'
            payout.paid_at = timezone.now()
            payout.approved_by = request.user
            payout.save(update_fields=['status', 'paid_at', 'approved_by'])
            AffiliateProfile.objects.filter(pk=payout.affiliate_id).update(
                total_withdrawn=F('total_withdrawn') + payout.amount
            )
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=payout.affiliate.user,
                title='Saque aprovado',
                message=f'O seu saque de {payout.amount} MZN foi aprovado.',
                notification_type='affiliate',
                link='/affiliate/earnings',
            )
        elif action == 'reject' and payout.status == 'pending':
            payout.status = 'rejected'
            payout.notes = request.data.get('notes', '')
            payout.save(update_fields=['status', 'notes'])
        return Response(AffiliatePayoutSerializer(payout).data)


class AdminAffiliateKYCListView(generics.ListAPIView):
    """Admin: lista as verificações KYC dos afiliados."""
    serializer_class = AffiliateKYCSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        return AffiliateKYC.objects.select_related('affiliate__user').order_by('-created_at')


class AdminAffiliateKYCActionView(APIView):
    """Admin: aprova/rejeita a verificação KYC de um afiliado."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk):
        kyc = get_object_or_404(AffiliateKYC, pk=pk)
        action = request.data.get('action')
        if action == 'approve':
            kyc.status = 'approved'
        elif action == 'reject':
            kyc.status = 'rejected'
        kyc.review_notes = request.data.get('notes', '')
        kyc.reviewed_by = request.user
        kyc.save(update_fields=['status', 'review_notes', 'reviewed_by'])

        from apps.notifications.models import Notification
        Notification.objects.create(
            user=kyc.affiliate.user,
            title='Verificação de conta actualizada',
            message=f'A sua verificação de conta foi {"aprovada" if kyc.status == "approved" else "rejeitada"}.',
            notification_type='affiliate',
            link='/affiliate/earnings',
        )
        return Response(AffiliateKYCSerializer(kyc).data)
