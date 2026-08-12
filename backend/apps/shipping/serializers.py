from rest_framework import serializers
from .models import ShippingZone, ShippingMethod, ShippingRate, MOZAMBIQUE_PROVINCES


class ShippingRateSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    method_name = serializers.CharField(source='method.name', read_only=True)
    estimated_days = serializers.CharField(source='method.estimated_days_display', read_only=True)

    class Meta:
        model = ShippingRate
        fields = (
            'id', 'method', 'zone', 'method_name', 'zone_name',
            'base_price', 'per_kg_price', 'free_shipping_min',
            'max_weight_kg', 'is_active', 'estimated_days',
        )
        read_only_fields = ('id',)


class ShippingRateWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingRate
        fields = (
            'id', 'method', 'zone', 'base_price', 'per_kg_price',
            'free_shipping_min', 'max_weight_kg', 'is_active',
        )

    def validate(self, data):
        method = data.get('method')
        zone = data.get('zone')
        if method and zone and method.store_id != zone.store_id:
            raise serializers.ValidationError(
                'O método e a zona devem pertencer à mesma loja.'
            )
        return data


class ShippingMethodSerializer(serializers.ModelSerializer):
    rates = ShippingRateSerializer(many=True, read_only=True)
    zones_count = serializers.SerializerMethodField()

    class Meta:
        model = ShippingMethod
        fields = (
            'id', 'name', 'method_type', 'description', 'pickup_address',
            'estimated_days_min', 'estimated_days_max', 'estimated_days_display',
            'is_active', 'rates', 'zones_count',
        )
        read_only_fields = ('id',)

    def get_zones_count(self, obj):
        return obj.rates.filter(is_active=True).count()


class ShippingMethodWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        fields = (
            'id', 'name', 'method_type', 'description', 'pickup_address',
            'estimated_days_min', 'estimated_days_max', 'is_active',
        )


class ShippingZoneSerializer(serializers.ModelSerializer):
    rates = ShippingRateSerializer(many=True, read_only=True)
    provinces_display = serializers.SerializerMethodField()

    class Meta:
        model = ShippingZone
        fields = (
            'id', 'name', 'provinces', 'provinces_display',
            'is_active', 'rates',
        )
        read_only_fields = ('id',)

    def get_provinces_display(self, obj):
        province_map = dict(MOZAMBIQUE_PROVINCES)
        return [province_map.get(p, p) for p in (obj.provinces or [])]


class ShippingZoneWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingZone
        fields = ('id', 'name', 'provinces', 'is_active')


# ─── Estimate Serializer ───

class EstimateItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class EstimateRequestSerializer(serializers.Serializer):
    items = EstimateItemSerializer(many=True, min_length=1)
    province = serializers.CharField()


class StoreShippingOptionSerializer(serializers.Serializer):
    """Serializer para o output do endpoint de estimativa."""
    rate_id = serializers.CharField()
    method_name = serializers.CharField()
    zone_name = serializers.CharField()
    price = serializers.FloatField()
    is_free = serializers.BooleanField()
    free_shipping_min = serializers.FloatField(allow_null=True)
    estimated_days = serializers.CharField()


class StoreEstimateSerializer(serializers.Serializer):
    store_id = serializers.CharField()
    store_name = serializers.CharField()
    total_weight_kg = serializers.FloatField()
    subtotal = serializers.FloatField()
    available_methods = StoreShippingOptionSerializer(many=True)
