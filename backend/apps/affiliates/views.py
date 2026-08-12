import uuid
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import models
from django.db.models import F
from django.conf import settings
from django.shortcuts import redirect
from .models import AffiliateProfile, AffiliateLink, AffiliateCommission
from .serializers import AffiliateProfileSerializer, AffiliateLinkSerializer, AffiliateCommissionSerializer


class AffiliateRegisterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile, created = AffiliateProfile.objects.get_or_create(
            user=request.user,
            defaults={'referral_code': uuid.uuid4().hex[:12].upper()}
        )
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
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({'detail': 'Solicitação de saque recebida.'}, status=status.HTTP_200_OK)


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
    if link and link.affiliate.is_active:
        AffiliateLink.objects.filter(pk=link.pk).update(clicks=F('clicks') + 1)
        AffiliateProfile.objects.filter(pk=link.affiliate_id).update(total_clicks=F('total_clicks') + 1)

        target = f'{settings.FRONTEND_URL}/product/{link.product.slug}'
        response = redirect(target)
        # Cookie de atribuição: 30 dias (padrão internacional)
        response.set_cookie('ref', link.code, max_age=30 * 24 * 60 * 60, samesite='Lax')
        return response
    return redirect(settings.FRONTEND_URL)
