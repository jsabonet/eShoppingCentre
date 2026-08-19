from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from .throttles import LoginRateThrottle
from .serializers import (
    RegisterSerializer, UserProfileSerializer, AddressSerializer, ChangePasswordSerializer,
    VerifyEmailSerializer, ResendVerificationSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
)
from . import otp_service, tasks
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
        from .token_cookies import set_refresh_cookie
        refresh = RefreshToken.for_user(user)
        response = Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': _user_payload(user),
        }, status=status.HTTP_201_CREATED)
        set_refresh_cookie(response, str(refresh))

        # Enviar email de verificação (assíncrono, não bloqueia o registo)
        try:
            code = otp_service.create_otp(user, 'verification')
            tasks.dispatch(tasks.send_verification_email, user.email, code)
        except Exception as exc:
            logger.warning(f'Falha ao enviar email de verificação para {user.email}: {exc}')

        return response


class LoginTokenObtainPairView(BaseTokenObtainPairView):
    """Login com throttle dedicado (anti brute-force) + cookie httpOnly."""
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            from .token_cookies import set_refresh_cookie
            refresh = response.data.get('refresh')
            if refresh:
                set_refresh_cookie(response, refresh)
        return response


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
        logger.info(f'[FirebaseLogin] POST /auth/firebase/ recebido | body keys={list(request.data.keys())} | id_token len={len(request.data.get("id_token", ""))}')
        serializer = FirebaseTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        id_token = serializer.validated_data['id_token']

        try:
            _init_firebase()
            decoded_token = firebase_auth_module.verify_id_token(id_token)
        except Exception as e:
            logger.warning(f'[FirebaseLogin] Falha a verificar id_token: {type(e).__name__}: {e}')
            return Response(
                {'error': f'Token Firebase inválido: {str(e)}'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        firebase_uid = decoded_token.get('uid')
        email = decoded_token.get('email', '')
        email_verified = decoded_token.get('email_verified', False)
        name = decoded_token.get('name', '')
        firebase_provider = decoded_token.get('firebase', {}).get('sign_in_provider', 'google')
        logger.info(f'[FirebaseLogin] Token OK | uid={firebase_uid} email={email} email_verified={email_verified} provider={firebase_provider}')

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
            logger.info(f'[FirebaseLogin] Utilizador encontrado por firebase_uid: {user.email} (id={user.id})')
        except User.DoesNotExist:
            # Try to find by email (account linking)
            if email:
                try:
                    user = User.objects.get(email=email)
                    logger.info(f'[FirebaseLogin] Utilizador encontrado por email: {email} | is_verified={user.is_verified}')
                    # Segurança: só ligar Google a contas com email já verificado (anti pre-hijacking)
                    if not user.is_verified:
                        logger.warning(f'[FirebaseLogin] Bloqueado: email {email} registado mas NÃO verificado')
                        return Response(
                            {'error': 'Este email já está registado mas não foi verificado. '
                                      'Entre com email/password e verifique o seu email primeiro.'},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    user.firebase_uid = firebase_uid
                    user.auth_provider = firebase_provider
                    user.save(update_fields=['firebase_uid', 'auth_provider'])
                    logger.info(f'[FirebaseLogin] Conta ligada ao Google: {email}')
                except User.DoesNotExist:
                    user = self._create_user_from_firebase(
                        firebase_uid, email, name, firebase_provider
                    )
                    is_new_user = True
                    logger.info(f'[FirebaseLogin] Novo utilizador criado: {email}')
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
        logger.info(f'[FirebaseLogin] A gerar JWT para {user.email} (is_new_user={is_new_user})')
        refresh = RefreshToken.for_user(user)

        from .token_cookies import set_refresh_cookie
        response = Response({
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
        set_refresh_cookie(response, str(refresh))
        return response

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


class CookieTokenRefreshView(APIView):
    """POST /api/v1/auth/refresh/ — renova o access token a partir do cookie httpOnly."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from .token_cookies import REFRESH_COOKIE_NAME, set_refresh_cookie
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response({'detail': 'Sem refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(refresh_token)
        except Exception:
            return Response({'detail': 'Refresh token inválido ou expirado.'}, status=status.HTTP_401_UNAUTHORIZED)

        response = Response({'access': str(refresh.access_token)})

        from rest_framework_simplejwt import settings as jwt_settings
        if jwt_settings.api_settings.ROTATE_REFRESH_TOKENS:
            try:
                refresh.blacklist()
            except Exception:
                pass
            new_refresh = RefreshToken.for_user(refresh.user)
            set_refresh_cookie(response, str(new_refresh))
        return response


class CookieLogoutView(APIView):
    """POST /api/v1/auth/logout/ — revoga o refresh token do cookie httpOnly."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from .token_cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass
        response = Response({'detail': 'Sessão terminada.'})
        clear_refresh_cookie(response)
        return response


# ──────────────────────────────────────────────
# Verificação de email e recuperação de password
# ──────────────────────────────────────────────

def _blacklist_user_tokens(user):
    """Revoga todos os refresh tokens existentes do utilizador (blacklist)."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for token in OutstandingToken.objects.filter(user_id=user.id):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception as exc:
        logger.warning(f'Falha ao revogar tokens de {user.email}: {exc}')


class ThrottledPTMixin:
    """Mensagem amigável (PT) quando um pedido é limitado por throttle."""

    def throttled(self, request, wait):
        from rest_framework.exceptions import Throttled
        minutes = max(1, round(wait / 60))
        raise Throttled(wait=wait, detail=f'Muitas tentativas. Tenta novamente em {minutes} minuto(s).')


class VerifyEmailView(ThrottledPTMixin, APIView):
    """POST /api/v1/auth/verify-email/ — valida o OTP e marca a conta como verificada."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return Response({'detail': 'Conta não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        valid, message = otp_service.verify_otp(user, 'verification', code)
        if not valid:
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)

        was_verified = user.is_verified
        user.is_verified = True
        user.save(update_fields=['is_verified'])

        # Email de boas-vindas (só na primeira verificação)
        if not was_verified:
            try:
                tasks.dispatch(tasks.send_welcome_email, user.email, user.first_name)
            except Exception as exc:
                logger.warning(f'Falha ao enviar email de boas-vindas para {user.email}: {exc}')

        return Response({'detail': 'Email verificado com sucesso.', 'user': _user_payload(user)})


class ResendVerificationView(ThrottledPTMixin, APIView):
    """POST /api/v1/auth/resend-verification/ — reenvia o OTP de verificação."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_resend'

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return Response({'detail': 'Conta não encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if user.is_verified:
            return Response({'detail': 'Conta já verificada.'})

        code = otp_service.create_otp(user, 'verification')
        tasks.dispatch(tasks.send_verification_email, user.email, code)
        return Response({'detail': 'Código reenviado para o teu email.'})


class PasswordResetRequestView(ThrottledPTMixin, APIView):
    """POST /api/v1/auth/password/reset/ — envia OTP de recuperação (resposta genérica)."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email).first()
        if user is not None and user.is_active:
            code = otp_service.create_otp(user, 'password_reset')
            tasks.dispatch(tasks.send_password_reset_email, user.email, code)

        # Resposta genérica para não revelar se o email existe
        return Response({'detail': 'Se o email existir, receberás um código de recuperação.'})


class PasswordResetConfirmView(ThrottledPTMixin, APIView):
    """POST /api/v1/auth/password/reset/confirm/ — valida OTP e define nova password."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_reset'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']

        valid, message = otp_service.verify_otp(user, 'password_reset', code)
        if not valid:
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        otp_service.invalidate_otps(user, 'password_reset')
        _blacklist_user_tokens(user)
        return Response({'detail': 'Password redefinida com sucesso.'})
