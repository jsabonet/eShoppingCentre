from rest_framework import serializers
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.first_name', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'user_name', 'rating', 'title', 'comment',
                  'is_verified_purchase', 'helpful_count', 'created_at')
        read_only_fields = ('is_verified_purchase', 'helpful_count')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
