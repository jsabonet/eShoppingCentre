from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from .models import PayoutRequest
from .serializers import WalletSerializer, WalletTransactionSerializer, PayoutRequestSerializer
from .services import request_payout, approve_payout, pay_payout, reject_payout, InsufficientFunds
from apps.users.permissions import IsVerified


class MyWalletView(generics.RetrieveAPIView):
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        from .services import get_wallet
        return get_wallet(self.request.user)


class MyTransactionsView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.wallet.transactions.order_by('-created_at')


class WalletPayoutView(APIView):
    """GET: listar os meus pedidos de saque; POST: solicitar saque (pagamento manual pelo admin)."""

    def get_permissions(self):
        permission_classes = [permissions.IsAuthenticated]
        if self.request.method == 'POST':
            permission_classes.append(IsVerified)
        return [permission() for permission in permission_classes]

    def get(self, request):
        payouts = PayoutRequest.objects.filter(user=request.user).order_by('-created_at')
        return Response(PayoutRequestSerializer(payouts, many=True).data)

    def post(self, request):
        role = request.data.get('role')
        if role not in ('seller', 'affiliate'):
            return Response({'detail': 'Indique um perfil de saque válido.'}, status=400)

        from apps.affiliates.models import AffiliateProfile
        affiliate = AffiliateProfile.objects.filter(user=request.user).first()
        if role == 'seller':
            from apps.stores.models import Store
            if 'seller' not in (request.user.roles or []) or not Store.objects.filter(owner=request.user).exists():
                return Response({'detail': 'Apenas vendedores com loja podem solicitar este saque.'}, status=403)
        elif not affiliate or not affiliate.is_active or affiliate.status != 'active':
            return Response({'detail': 'Não existe uma conta de afiliado ativa para este utilizador.'}, status=403)

        method = request.data.get('method', 'mpesa')
        account_details = request.data.get('account_details', {})
        if method not in ('mpesa', 'emola', 'bank') or not isinstance(account_details, dict):
            return Response({'detail': 'Método ou dados de pagamento inválidos.'}, status=400)
        if role == 'affiliate':
            from apps.affiliates.services import get_affiliate_payout_account_details
            try:
                account_details = get_affiliate_payout_account_details(
                    affiliate, method, account_details,
                )
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=400)
        else:
            required_fields = ('bank_name', 'bank_account') if method == 'bank' else ('phone',)
            if any(not str(account_details.get(field, '')).strip() for field in required_fields):
                return Response({'detail': 'Preencha os dados da conta de destino do saque.'}, status=400)

        try:
            payout = request_payout(
                request.user, role=role,
                amount=request.data.get('amount'),
                method=method,
                account_details=account_details,
            )
        except InsufficientFunds as e:
            return Response({'detail': str(e)}, status=400)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        return Response(PayoutRequestSerializer(payout).data, status=201)


# ─── Admin: pagamentos manuais ───

class AdminPayoutListView(generics.ListAPIView):
    serializer_class = PayoutRequestSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        queryset = PayoutRequest.objects.select_related('user')
        params = self.request.query_params
        allowed = {'page', 'page_size', 'search', 'status', 'method', 'role', 'date_from', 'date_to'}
        unsupported = set(params) - allowed
        if unsupported:
            raise ValidationError({
                'query_params': f'Filtros não suportados: {", ".join(sorted(unsupported))}.',
            })

        search = params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(user__email__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(admin_reference__icontains=search)
            )

        for field in ('status', 'method', 'role'):
            value = params.get(field, '').strip()
            if value:
                queryset = queryset.filter(**{field: value})

        for field, lookup in (('date_from', 'created_at__date__gte'), ('date_to', 'created_at__date__lte')):
            value = params.get(field)
            if value:
                parsed = parse_date(value)
                if parsed is None:
                    raise ValidationError({field: 'Use uma data válida no formato AAAA-MM-DD.'})
                queryset = queryset.filter(**{lookup: parsed})

        return queryset.order_by('-created_at')


class AdminPayoutApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def post(self, request, pk):
        payout = get_object_or_404(PayoutRequest, pk=pk)
        payout = approve_payout(payout, request.user)
        return Response(PayoutRequestSerializer(payout).data)


class AdminPayoutPayView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def post(self, request, pk):
        payout = get_object_or_404(PayoutRequest, pk=pk)
        try:
            payout = pay_payout(payout, request.user, request.data.get('reference', ''))
        except (InsufficientFunds, ValueError) as e:
            return Response({'detail': str(e)}, status=400)
        return Response(PayoutRequestSerializer(payout).data)


class AdminPayoutRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def post(self, request, pk):
        payout = get_object_or_404(PayoutRequest, pk=pk)
        payout = reject_payout(payout, request.user, request.data.get('reason', ''))
        return Response(PayoutRequestSerializer(payout).data)


class AdminReconciliationView(APIView):
    """GET /api/v1/wallet/admin/reconciliation/ — relatório de reconciliação."""
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        from django.db.models import F, Sum
        from apps.orders.models import Order
        from apps.affiliates.models import AffiliateCommission, AffiliatePayout
        from apps.payments.models import PaymentTransaction
        from .models import EscrowHolding, Wallet, WalletTransaction

        def s(qs, field):
            return qs.aggregate(v=Sum(field))['v'] or 0

        paid_orders = Order.objects.filter(payment_status='completed')
        collected = s(paid_orders, 'total')
        gateway_collected = s(
            paid_orders.exclude(payment_method__in=['wallet', 'test']),
            'total',
        )
        wallet_funded = s(paid_orders.filter(payment_method='wallet'), 'total')
        simulated = s(paid_orders.filter(payment_method='test'), 'total')
        refunds = s(WalletTransaction.objects.filter(
            type='refund', reference_type='order', amount__gt=0,
        ), 'amount')
        platform_fees = s(paid_orders, 'platform_fee')
        affiliate_commissions = AffiliateCommission.objects.filter(status__in=['approved', 'paid'])
        affiliate_paid = affiliate_commissions.aggregate(
            total=Sum(F('amount') - F('reversed_amount')),
        )['total'] or 0
        affiliate_pending = AffiliateCommission.objects.filter(status='pending').aggregate(
            total=Sum(F('amount') - F('reversed_amount')),
        )['total'] or 0
        affiliate_commissions_uncredited = s(
            affiliate_commissions.filter(status='approved').exclude(
                pk__in=WalletTransaction.objects.filter(
                    reference_type='affiliate_commission',
                ).values('reference_id')
            ).annotate(net_amount=F('amount') - F('reversed_amount')),
            'net_amount',
        )
        payouts_paid = (
            s(PayoutRequest.objects.filter(status='paid'), 'amount')
            + s(AffiliatePayout.objects.filter(status='paid'), 'amount')
        )
        payouts_pending = (
            s(PayoutRequest.objects.filter(status__in=['pending', 'approved']), 'amount')
            + s(AffiliatePayout.objects.filter(status__in=['pending', 'approved']), 'amount')
        )
        escrow_held = s(EscrowHolding.objects.filter(status='held'), 'amount')
        wallets_payout = s(Wallet.objects.all(), 'payout_balance')
        wallets_reserved = s(Wallet.objects.all(), 'reserved_balance')
        wallets_buyer = s(Wallet.objects.all(), 'balance')
        gateway_refunds_pending = PaymentTransaction.objects.filter(
            provider='vpay', status='refund_pending',
        )
        gateway_open = PaymentTransaction.objects.filter(
            provider='vpay', status__in=['pending', 'processing'],
        )
        gateway_failed = PaymentTransaction.objects.filter(
            provider='vpay', status='failed',
        )

        net_collected = collected - refunds
        # Reserved payout balances are already included in payout_balance.
        liabilities = wallets_payout + escrow_held + wallets_buyer + affiliate_commissions_uncredited

        return Response({
            'collected_total': float(collected),
            'gateway_collected_total': float(gateway_collected),
            'wallet_funded_total': float(wallet_funded),
            'simulated_test_total': float(simulated),
            'gateway_refunds_pending_count': gateway_refunds_pending.count(),
            'gateway_refunds_pending_total': float(s(gateway_refunds_pending, 'amount')),
            'gateway_open_count': gateway_open.count(),
            'gateway_open_total': float(s(gateway_open, 'amount')),
            'gateway_failed_count': gateway_failed.count(),
            'gateway_failed_total': float(s(gateway_failed, 'amount')),
            'refunds_total': float(refunds),
            'net_collected': float(net_collected),
            'platform_fees': float(platform_fees),
            'affiliate_commissions': float(affiliate_paid),
            'affiliate_commissions_pending': float(affiliate_pending),
            'affiliate_commissions_uncredited': float(affiliate_commissions_uncredited),
            'payouts_paid': float(payouts_paid),
            'payouts_pending': float(payouts_pending),
            'escrow_held': float(escrow_held),
            'wallets_payout_balance': float(wallets_payout),
            'wallets_reserved_balance': float(wallets_reserved),
            'wallets_buyer_balance': float(wallets_buyer),
            'liabilities': float(liabilities),
        })
