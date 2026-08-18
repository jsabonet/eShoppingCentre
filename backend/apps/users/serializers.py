from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import UserProfile, Address

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password2',
                  'phone', 'first_name', 'last_name')

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'As passwords não coincidem.'})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        user.roles = ['buyer']
        user.save()
        UserProfile.objects.create(user=user)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'phone', 'first_name', 'last_name',
                  'avatar', 'roles', 'is_verified', 'date_of_birth', 'bio',
                  'date_joined', 'is_staff', 'is_active')
        read_only_fields = ('id', 'email', 'roles', 'is_verified', 'date_joined', 'is_staff', 'is_active')


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ('user',)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate(self, attrs):
        if attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError({'new_password': 'A nova password deve ser diferente da anterior.'})
        return attrs


class FirebaseTokenSerializer(serializers.Serializer):
    """Serializer for Firebase ID token exchange."""
    id_token = serializers.CharField(required=True)
    firebase_uid = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    is_new_user = serializers.BooleanField(read_only=True)


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Admin: criar utilizador com password e roles."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password2',
                  'phone', 'first_name', 'last_name', 'roles',
                  'is_verified', 'is_staff')

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'As passwords não coincidem.'})
        if not attrs.get('email'):
            raise serializers.ValidationError({'email': 'Email é obrigatório.'})
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop('roles', ['buyer'])
        is_staff = validated_data.pop('is_staff', False)
        is_verified = validated_data.pop('is_verified', False)
        user = User.objects.create_user(**validated_data)
        user.roles = roles
        user.is_staff = is_staff
        user.is_verified = is_verified
        user.save()
        return user


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField()

    def validate(self, attrs):
        user = User.objects.filter(email__iexact=attrs['email']).first()
        if user is None:
            # Erro genérico: não revelar se o email existe
            raise serializers.ValidationError({'code': 'Código inválido ou expirado.'})
        try:
            validate_password(attrs['new_password'], user=user)
        except ValidationError as exc:
            raise serializers.ValidationError({'new_password': exc.messages})
        if user.check_password(attrs['new_password']):
            raise serializers.ValidationError({'new_password': 'A nova password deve ser diferente da anterior.'})
        attrs['user'] = user
        return attrs
