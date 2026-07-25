from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
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
                  'avatar', 'roles', 'is_verified', 'date_of_birth', 'bio')
        read_only_fields = ('id', 'email', 'roles', 'is_verified')


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ('user',)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])


class FirebaseTokenSerializer(serializers.Serializer):
    """Serializer for Firebase ID token exchange."""
    id_token = serializers.CharField(required=True)
    firebase_uid = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    is_new_user = serializers.BooleanField(read_only=True)
