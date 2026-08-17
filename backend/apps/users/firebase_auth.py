"""
Firebase Authentication integration for Django DRF.

Provides:
- FirebaseIDTokenAuthentication: DRF authentication class that verifies Firebase ID tokens
- FirebaseAuthBackend: Django auth backend for Firebase-authenticated users

Setup:
1. Place your Firebase service account JSON key at the path defined by
   GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY env var.
2. Add 'apps.users.firebase_auth.FirebaseIDTokenAuthentication' to
   REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] to enable globally,
   or use it per-view.
"""

import logging
import os
from pathlib import Path
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend
from rest_framework import authentication
from rest_framework import exceptions

import firebase_admin
from firebase_admin import auth as firebase_auth_module
from firebase_admin import credentials as firebase_credentials

User = get_user_model()
logger = logging.getLogger(__name__)


def _init_firebase():
    """Initialize Firebase Admin SDK if not already initialized."""
    if not firebase_admin._apps:
        cred_path = getattr(settings, 'FIREBASE_SERVICE_ACCOUNT_KEY', None)
        if cred_path:
            # Resolve relative paths against BASE_DIR
            cred_path_resolved = cred_path
            if not os.path.isabs(cred_path):
                cred_path_resolved = os.path.join(
                    settings.BASE_DIR, cred_path
                )
            logger.info(f'Initializing Firebase with credentials: {cred_path_resolved}')
            cred = firebase_credentials.Certificate(cred_path_resolved)
            firebase_admin.initialize_app(cred)
        else:
            # Use default application credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS env var)
            logger.info('Initializing Firebase with default credentials')
            firebase_admin.initialize_app()


class FirebaseAuthBackend(BaseBackend):
    """
    Django authentication backend that authenticates users by Firebase UID.
    Used by Django's authenticate() function.
    """

    def authenticate(self, request, firebase_uid=None, email=None, **kwargs):
        if firebase_uid is None:
            return None

        try:
            user = User.objects.get(firebase_uid=firebase_uid)
        except User.DoesNotExist:
            # Try to find by email (existing user linking)
            if email:
                try:
                    user = User.objects.get(email=email)
                    # Segurança: só ligar Google a contas com email já verificado (anti pre-hijacking)
                    if not user.is_verified:
                        return None
                    # Link Firebase UID to existing account
                    user.firebase_uid = firebase_uid
                    user.auth_provider = 'google'
                    user.save(update_fields=['firebase_uid', 'auth_provider'])
                    return user
                except User.DoesNotExist:
                    pass
            return None

        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None


class FirebaseIDTokenAuthentication(authentication.BaseAuthentication):
    """
    DRF authentication class that verifies Firebase ID tokens.

    Client sends: Authorization: Bearer <firebase_id_token>
    This class verifies the token with Firebase Admin SDK and returns the
    corresponding Django User.

    If the user doesn't exist yet, it creates one automatically using the
    Firebase user info (email, display name, etc.).
    """

    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).split()

        if not auth_header or auth_header[0].lower() != b'bearer':
            return None

        if len(auth_header) == 1:
            raise exceptions.AuthenticationFailed('Token inválido. Cabeçalho mal formado.')
        elif len(auth_header) > 2:
            raise exceptions.AuthenticationFailed('Token inválido. Cabeçalho mal formado.')

        token = auth_header[1].decode('utf-8')

        return self.authenticate_credentials(token)

    def authenticate_credentials(self, token):
        try:
            _init_firebase()
            decoded_token = firebase_auth_module.verify_id_token(token)
        except Exception as e:
            logger.warning(f'Firebase token verification failed: {e}')
            raise exceptions.AuthenticationFailed(f'Token Firebase inválido: {str(e)}')

        firebase_uid = decoded_token.get('uid')
        email = decoded_token.get('email', '')
        email_verified = decoded_token.get('email_verified', False)
        name = decoded_token.get('name', '')
        picture = decoded_token.get('picture', '')
        firebase_provider = decoded_token.get('firebase', {}).get('sign_in_provider', 'google')

        if not firebase_uid:
            raise exceptions.AuthenticationFailed('Token Firebase sem UID.')

        # Segurança: nunca ligar/criar conta com email não verificado
        if email and not email_verified:
            raise exceptions.AuthenticationFailed('O email da conta não está verificado.')

        # Try to find existing user by firebase_uid
        try:
            user = User.objects.get(firebase_uid=firebase_uid)
        except User.DoesNotExist:
            # Try to find by email (account linking)
            if email:
                try:
                    user = User.objects.get(email=email)
                    # Segurança: só ligar Google a contas com email já verificado (anti pre-hijacking)
                    if not user.is_verified:
                        raise exceptions.AuthenticationFailed(
                            'Este email já está registado mas não foi verificado. '
                            'Entre com email/password e verifique o seu email primeiro.'
                        )
                    user.firebase_uid = firebase_uid
                    user.auth_provider = firebase_provider
                    user.save(update_fields=['firebase_uid', 'auth_provider'])
                except User.DoesNotExist:
                    # Create new user
                    user = self._create_user_from_firebase(
                        firebase_uid=firebase_uid,
                        email=email,
                        name=name,
                        provider=firebase_provider,
                    )
            else:
                # No email from Firebase — create user with generated data
                user = self._create_user_from_firebase(
                    firebase_uid=firebase_uid,
                    email='',
                    name=name,
                    provider=firebase_provider,
                )

        if not user.is_active:
            raise exceptions.AuthenticationFailed('Conta de utilizador desativada.')

        return (user, decoded_token)

    def _create_user_from_firebase(self, firebase_uid, email, name, provider):
        """Create a new Django User from Firebase user data."""
        # Generate username from email or firebase_uid
        if email:
            base_username = email.split('@')[0]
        else:
            base_username = f'user_{firebase_uid[:8]}'

        # Ensure unique username
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base_username}{counter}'
            counter += 1

        # Split name into first/last name
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

        # Create profile
        UserProfile.objects.create(user=user)

        logger.info(f'Created new user from Firebase: {email or firebase_uid}')
        return user

    def authenticate_header(self, request):
        return 'Bearer realm="Firebase"'
