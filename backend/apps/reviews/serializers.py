from rest_framework import serializers
from .models import Review, StoreReview


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ('id', 'user_name', 'user_avatar', 'product', 'rating', 'title', 'comment',
                  'is_verified_purchase', 'helpful_count', 'seller_reply',
                  'seller_replied_at', 'created_at')
        read_only_fields = ('is_verified_purchase', 'helpful_count', 'seller_replied_at')
        extra_kwargs = {'product': {'write_only': True}}

    def get_user_avatar(self, obj):
        if obj.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.avatar.url)
            return obj.user.avatar.url
        return None

    def get_user_name(self, obj):
        name = obj.user.first_name
        if name:
            return name
        email = obj.user.email
        return email.split('@')[0] if '@' in email else email

    def create(self, validated_data):
        user = self.context['request'].user
        product = validated_data.get('product')

        # Auto-verify purchase
        is_verified = False
        if product and user:
            is_verified = user.orders.filter(
                items__product=product,
                status__in=('delivered', 'confirmed', 'processing', 'shipped'),
            ).exists()

        validated_data['user'] = user
        validated_data['is_verified_purchase'] = is_verified
        return super().create(validated_data)


class StoreReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = StoreReview
        fields = (
            'id', 'user_name', 'communication_rating',
            'shipping_rating', 'accuracy_rating', 'overall_rating',
            'title', 'comment', 'is_verified_purchase',
            'helpful_count', 'seller_reply', 'seller_replied_at', 'created_at',
            'is_hidden', 'report_count',
        )
        read_only_fields = ('is_verified_purchase', 'helpful_count', 'seller_replied_at', 'is_hidden', 'report_count')

    def get_user_name(self, obj):
        name = obj.user.first_name
        if name:
            return name
        email = obj.user.email
        return email.split('@')[0] if '@' in email else email

    def create(self, validated_data):
        user = self.context['request'].user
        store = self.context.get('store')  # injected by view

        is_verified = user.orders.filter(
            store=store,
            status__in=('delivered', 'confirmed', 'shipped'),
        ).exists()

        validated_data['user'] = user
        validated_data['store'] = store
        validated_data['is_verified_purchase'] = is_verified

        if store.product_type != 'physical':
            validated_data['shipping_rating'] = None

        return super().create(validated_data)

