from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from .throttles import LoginRateThrottle
from .serializers import RegisterSerializer, UserProfileSerializer, AddressSerializer, ChangePasswordSerializer
from apps.orders.serializers import OrderSerializer
from apps.orders.models import Order
from apps.products.models import WishlistItem
from apps.products.serializers import WishlistItemSerializer

User = get_user_model()


def _user_payload(user):
    return {
        'id': str(user.id),
        'email': user.email,
        'username': user.username,
        'phone': user.phone,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'avatar': user.avatar.url if user.avatar else None,
        'roles': user.roles,
        'is_verified': user.is_verified,
    }


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': _user_payload(user),
        }, status=status.HTTP_201_CREATED)


class LoginTokenObtainPairView(BaseTokenObtainPairView):
    """Login com throttle dedicado (anti brute-force)."""
    throttle_classes = [LoginRateThrottle]


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user

        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Password actual incorrecta.'},
                          status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password alterada com sucesso.'})


class AddressListView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user).order_by('-created_at')


class MyDownloadsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        downloads = []
        return Response(downloads)


class WishlistView(generics.ListCreateAPIView):
    serializer_class = WishlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.wishlist.all()

    def get_serializer_context(self):
        return {'request': self.request}


class WishlistDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.wishlist.all()


from .views_admin import (
    AdminStatsView, PendingStoresView, ApproveStoreView,
    PendingPayoutsView, ApprovePayoutView,
)

# ──────────────────────────────────────────────
# Firebase Authentication
# ──────────────────────────────────────────────

from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import FirebaseTokenSerializer
from .firebase_auth import _init_firebase
from firebase_admin import auth as firebase_auth_module
import logging

logger = logging.getLogger(__name__)


class FirebaseTokenObtainPairView(APIView):
    """
    Exchange a Firebase ID token for JWT tokens.

    POST /api/v1/auth/firebase/
    Body: { "id_token": "<firebase_id_token>" }

    Returns: { "access": "...", "refresh": "...", "user": {...}, "is_new_user": bool }
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # No DRF auth needed — we verify Firebase token manually
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = FirebaseTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        id_token = serializer.validated_data['id_token']

        try:
            _init_firebase()
            decoded_token = firebase_auth_module.verify_id_token(id_token)
        except Exception as e:
            logger.warning(f'Firebase token exchange failed: {e}')
            return Response(
                {'error': f'Token Firebase inválido: {str(e)}'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        firebase_uid = decoded_token.get('uid')
        email = decoded_token.get('email', '')
        email_verified = decoded_token.get('email_verified', False)
        name = decoded_token.get('name', '')
        firebase_provider = decoded_token.get('firebase', {}).get('sign_in_provider', 'google')

        if not firebase_uid:
            return Response(
                {'error': 'Token Firebase sem UID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Segurança: nunca ligar/criar conta com email não verificado
        if email and not email_verified:
            return Response(
                {'error': 'O email da conta não está verificado. Verifique o email e tente novamente.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        is_new_user = False

        # Try to find existing user by firebase_uid
        try:
            user = User.objects.get(firebase_uid=firebase_uid)
        except User.DoesNotExist:
            # Try to find by email (account linking)
            if email:
                try:
                    user = User.objects.get(email=email)
                    user.firebase_uid = firebase_uid
                    user.auth_provider = firebase_provider
                    user.is_verified = True
                    user.save(update_fields=['firebase_uid', 'auth_provider', 'is_verified'])
                except User.DoesNotExist:
                    user = self._create_user_from_firebase(
                        firebase_uid, email, name, firebase_provider
                    )
                    is_new_user = True
            else:
                user = self._create_user_from_firebase(
                    firebase_uid, email, name, firebase_provider
                )
                is_new_user = True

        if not user.is_active:
            return Response(
                {'error': 'Conta de utilizador desativada.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': str(user.id),
                'email': user.email,
                'username': user.username,
                'phone': user.phone,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'avatar': user.avatar.url if user.avatar else None,
                'roles': user.roles,
                'is_verified': user.is_verified,
            },
            'is_new_user': is_new_user,
        })

    def _create_user_from_firebase(self, firebase_uid, email, name, provider):
        """Create a new Django User from Firebase data."""
        if email:
            base_username = email.split('@')[0]
        else:
            base_username = f'user_{firebase_uid[:8]}'

        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base_username}{counter}'
            counter += 1

        name_parts = name.strip().split(' ', 1) if name else ['', '']
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        from .models import UserProfile

        user = User.objects.create_user(
            username=username,
            email=email or f'{firebase_uid}@firebase.user',
            first_name=first_name,
            last_name=last_name,
            firebase_uid=firebase_uid,
            auth_provider=provider,
            is_verified=True,
            roles=['buyer'],
        )
        UserProfile.objects.create(user=user)

        logger.info(f'Created new user from Firebase: {email or firebase_uid}')
        return user
