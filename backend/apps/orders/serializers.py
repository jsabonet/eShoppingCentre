from rest_framework import serializers
from django.db import transaction
from .models import Order, OrderItem, ReturnRequest, ReturnImage, OrderStatusHistory
from apps.products.models import Product


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('id', 'product_name', 'product_image', 'quantity', 'unit_price', 'total_price')
        read_only_fields = ('product_name', 'product_image', 'unit_price', 'total_price')


class ReturnImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnImage
        fields = ('id', 'image', 'caption', 'created_at')
        read_only_fields = ('id', 'created_at')


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = ('id', 'previous_status', 'new_status', 'changed_by_name', 'notes', 'created_at')

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.email
        return 'Sistema'


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    buyer_name = serializers.SerializerMethodField()
    buyer_email = serializers.SerializerMethodField()
    buyer_phone = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    images = ReturnImageSerializer(many=True, read_only=True)
    reason_type_display = serializers.CharField(source='get_reason_type_display', read_only=True)

    class Meta:
        model = ReturnRequest
        fields = (
            'id', 'order', 'order_number', 'reason', 'reason_type', 'reason_type_display',
            'rma_number', 'status', 'vendor_notes', 'refund_amount',
            'return_instructions', 'return_address', 'buyer_tracking_code', 'shipping_notes',
            'buyer_name', 'buyer_email', 'buyer_phone', 'store_name', 'images', 'created_at', 'disputed_at',
        )
        read_only_fields = ('id', 'buyer', 'store', 'rma_number', 'created_at')

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def get_buyer_email(self, obj):
        return obj.buyer.email

    def get_buyer_phone(self, obj):
        return obj.buyer.phone

    def create(self, validated_data):
        validated_data['buyer'] = self.context['request'].user
        return super().create(validated_data)


class ReturnResolveSerializer(serializers.Serializer):
    """Usado pelo seller para aprovar/rejeitar uma devolução."""
    action = serializers.ChoiceField(choices=[('approved', 'Aprovar'), ('rejected', 'Rejeitar')])
    vendor_notes = serializers.CharField(required=False, allow_blank=True)
    refund_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    return_instructions = serializers.CharField(required=False, allow_blank=True)
    return_address = serializers.CharField(required=False, allow_blank=True)


class ReturnShipSerializer(serializers.Serializer):
    """Usado pelo buyer para confirmar envio da devolução. Tracking opcional (realidade MZ)."""
    buyer_tracking_code = serializers.CharField(required=False, allow_blank=True, default='')
    shipping_notes = serializers.CharField(required=False, allow_blank=True, default='')


class AdminOverrideSerializer(serializers.Serializer):
    """Usado pelo admin para forçar uma decisão numa devolução em disputa."""
    action = serializers.ChoiceField(choices=[
        ('approve', 'Forçar Aprovação'),
        ('reject', 'Forçar Rejeição'),
        ('refund', 'Forçar Reembolso'),
    ])
    admin_notes = serializers.CharField(required=True, help_text='Justificação obrigatória da decisão')
    refund_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    return_instructions = serializers.CharField(required=False, allow_blank=True, default='')
    return_address = serializers.CharField(required=False, allow_blank=True, default='')


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    buyer_email = serializers.CharField(source='buyer.email', read_only=True)
    buyer_phone = serializers.SerializerMethodField()
    buyer_name = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_phone = serializers.SerializerMethodField()
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('buyer', 'order_number', 'subtotal', 'shipping_cost',
                           'platform_fee', 'total', 'affiliate_commission',
                           'shipped_at', 'confirmed_at', 'shipping_notes', 'shipping_evidence')

    def get_buyer_phone(self, obj):
        return obj.buyer.phone

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def get_store_phone(self, obj):
        if obj.store:
            return obj.store.phone
        return ''


class CreateOrderItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    variation_id = serializers.UUIDField(required=False)


class CreateOrderSerializer(serializers.Serializer):
    items = CreateOrderItemSerializer(many=True, min_length=1)
    shipping_address = serializers.DictField()
    payment_method = serializers.CharField()
    shipping_selections = serializers.DictField(
        required=False, default=dict,
        help_text='{"store_id": "rate_id"} — método de envio escolhido por loja'
    )
    affiliate_code = serializers.CharField(required=False, allow_blank=True)
    buyer_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_items(self, items):
        user = self.context['request'].user
        for item in items:
            try:
                product = Product.objects.get(id=item['product_id'], status='active')
                if product.product_type == 'physical' and item['quantity'] > product.stock:
                    raise serializers.ValidationError(
                        f'Stock insuficiente para {product.name}. Disponível: {product.stock}'
                    )
                # Impedir compra duplicada de cursos
                if product.product_type == 'course' and hasattr(product, 'course'):
                    from apps.courses.models import Enrollment
                    if Enrollment.objects.filter(user=user, course=product.course).exists():
                        raise serializers.ValidationError(
                            f'Já está inscrito no curso "{product.name}".'
                        )
            except Product.DoesNotExist:
                raise serializers.ValidationError(f'Produto {item["product_id"]} não encontrado.')
        return items

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        items_data = validated_data.pop('items')
        affiliate_code = validated_data.pop('affiliate_code', None)

        # Criar encomenda por loja (produtos de lojas diferentes podem ser divididos)
        store_orders = {}
        subtotal = 0

        for item_data in items_data:
            product = Product.objects.select_related('store').get(id=item_data['product_id'])
            store = product.store

            if store.id not in store_orders:
                store_orders[store.id] = {'store': store, 'items': [], 'store_total': 0}

            item_total = product.price * item_data['quantity']
            store_orders[store.id]['items'].append({
                'product': product,
                'quantity': item_data['quantity'],
                'unit_price': product.price,
                'total_price': item_total,
            })
            store_orders[store.id]['store_total'] += item_total
            subtotal += item_total

            # Reduzir stock
            if product.product_type == 'physical':
                product.stock -= item_data['quantity']
                product.save(update_fields=['stock'])

        # Calcular comissão de afiliado
        affiliate = None
        affiliate_commission = 0
        if affiliate_code:
            from apps.affiliates.models import AffiliateLink
            link = AffiliateLink.objects.filter(code=affiliate_code).first()
            if link:
                affiliate = link.affiliate.user
                for store_data in store_orders.values():
                    for item in store_data['items']:
                        product = item['product']
                        affiliate_commission += (item['total_price'] * product.affiliate_commission) / 100

        # ─── Calcular frete ───
        shipping_cost = 0
        shipping_method_name = ''
        shipping_selections = validated_data.pop('shipping_selections', {})
        if shipping_selections:
            from apps.shipping.models import ShippingRate
            province = validated_data.get('shipping_address', {}).get('province', '')
            for store_id, rate_id in shipping_selections.items():
                try:
                    rate = ShippingRate.objects.select_related('method', 'zone').get(
                        id=rate_id,
                        is_active=True,
                        method__is_active=True,
                        zone__is_active=True,
                    )
                    store_data = store_orders.get(uuid.UUID(store_id))
                    if store_data and rate.zone.covers_province(province):
                        weight = sum(
                            float(item['product'].weight or 0.5) * item['quantity']
                            for item in store_data['items']
                            if item['product'].product_type == 'physical'
                        )
                        calc = rate.calculate(weight, store_data['store_total'])
                        if calc:
                            shipping_cost += calc['price']
                            if not shipping_method_name:
                                shipping_method_name = rate.method.name
                except (ValueError, ShippingRate.DoesNotExist):
                    continue

        # Criar a primeira encomenda (podemos dividir por loja depois)
        first_store = list(store_orders.values())[0]
        platform_fee = (first_store['store_total'] * 8) / 100

        is_test = validated_data['payment_method'] == 'test'
        order = Order.objects.create(
            buyer=user,
            store=first_store['store'],
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            total=first_store['store_total'] + shipping_cost,
            platform_fee=platform_fee,
            affiliate=affiliate,
            affiliate_commission=affiliate_commission,
            payment_method=validated_data['payment_method'],
            payment_status='completed' if is_test else 'pending',
            status='confirmed' if is_test else 'pending',
            shipping_address=validated_data['shipping_address'],
            shipping_method=shipping_method_name,
            buyer_notes=validated_data.get('buyer_notes', ''),
        )

        for item in first_store['items']:
            OrderItem.objects.create(
                order=order,
                product=item['product'],
                product_name=item['product'].name,
                product_image=self._get_product_image(item['product']),
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                total_price=item['total_price'],
            )

        # ── Processar entregas digitais e matrículas imediatamente ──
        if order.payment_status == 'completed':
            self._process_delivery(order)

        return order

    def _process_delivery(self, order):
        """Liberta downloads digitais e matricula em cursos após pagamento confirmado."""
        for item in order.items.all():
            product = item.product
            if not product:
                continue

            if product.product_type == 'digital' and order.status in ('confirmed', 'processing'):
                from apps.products.models import DigitalDownload
                DigitalDownload.objects.get_or_create(
                    user=order.buyer,
                    product=product,
                    order=order,
                )

            elif product.product_type == 'course' and hasattr(product, 'course'):
                from apps.courses.models import Enrollment
                from django.utils import timezone
                from datetime import timedelta

                course = product.course
                defaults = {'order': order}
                if course.access_duration_days:
                    defaults['access_expires_at'] = timezone.now() + timedelta(days=course.access_duration_days)

                Enrollment.objects.get_or_create(
                    user=order.buyer,
                    course=course,
                    defaults=defaults,
                )

    def _get_product_image(self, product):
        img = product.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else ''
        return ''
