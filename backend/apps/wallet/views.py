from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import PayoutRequest
from .serializers import WalletSerializer, WalletTransactionSerializer, PayoutRequestSerializer
from .services import request_payout, approve_payout, pay_payout, reject_payout, InsufficientFunds


class MyWalletView(generics.RetrieveAPIView):
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.wallet


class MyTransactionsView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.wallet.transactions.order_by('-created_at')


class WalletPayoutView(APIView):
    """GET: listar os meus pedidos de saque; POST: solicitar saque (pagamento manual pelo admin)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payouts = PayoutRequest.objects.filter(user=request.user).order_by('-created_at')
        return Response(PayoutRequestSerializer(payouts, many=True).data)

    def post(self, request):
        role = request.data.get('role', 'seller')
        if role == 'affiliate':
            from apps.affiliates.models import AffiliateKYC
            kyc = AffiliateKYC.objects.filter(affiliate__user=request.user).first()
            if not kyc or kyc.status != 'approved':
                return Response(
                    {'detail': 'É necessária a verificação da conta (KYC) antes de solicitar saques.'},
                    status=400,
                )

        try:
            payout = request_payout(
                request.user, role=role,
                amount=request.data.get('amount'),
                method=request.data.get('method', 'mpesa'),
                account_details=request.data.get('account_details', {}) or {},
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
        return PayoutRequest.objects.select_related('user').order_by('-created_at')


class AdminPayoutApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def post(self, request, pk):
        payout = get_object_or_404(PayoutRequest, pk=pk)
        approve_payout(payout, request.user)
        return Response(PayoutRequestSerializer(payout).data)


class AdminPayoutPayView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def post(self, request, pk):
        payout = get_object_or_404(PayoutRequest, pk=pk)
        try:
            pay_payout(payout, request.user, request.data.get('reference', ''))
        except InsufficientFunds as e:
            return Response({'detail': str(e)}, status=400)
        return Response(PayoutRequestSerializer(payout).data)


class AdminPayoutRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def post(self, request, pk):
        payout = get_object_or_404(PayoutRequest, pk=pk)
        reject_payout(payout, request.user, request.data.get('reason', ''))
        return Response(PayoutRequestSerializer(payout).data)
