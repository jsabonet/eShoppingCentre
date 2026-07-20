from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import PaymentTransaction


class MPesaWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        transaction = PaymentTransaction.objects.create(
            provider='mpesa',
            amount=request.data.get('output_Amount', 0),
            provider_response=request.data,
            status='completed' if request.data.get('output_ResponseCode') == 'INS-0' else 'failed',
        )
        return Response({'status': 'ok'})


class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({'status': 'ok'})
