from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Store, StoreFollower


class StoreFollowView(APIView):
    """POST /api/v1/stores/{slug}/follow/ — Seguir loja."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        store = get_object_or_404(Store, slug=slug)
        if store.owner == request.user:
            return Response({'detail': 'Nao pode seguir a sua propria loja.'}, status=400)

        follower, created = StoreFollower.objects.get_or_create(
            user=request.user, store=store,
        )
        return Response({
            'following': True,
            'followers_count': store.followers.count(),
        })


class StoreUnfollowView(APIView):
    """POST /api/v1/stores/{slug}/unfollow/ — Deixar de seguir."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        store = get_object_or_404(Store, slug=slug)
        StoreFollower.objects.filter(user=request.user, store=store).delete()
        return Response({
            'following': False,
            'followers_count': store.followers.count(),
        })


class StoreFollowStatusView(APIView):
    """GET /api/v1/stores/{slug}/follow-status/ — Verificar se segue."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        store = get_object_or_404(Store, slug=slug)
        is_following = StoreFollower.objects.filter(
            user=request.user, store=store
        ).exists()
        return Response({
            'following': is_following,
            'followers_count': store.followers.count(),
        })
