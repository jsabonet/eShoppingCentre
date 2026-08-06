from rest_framework import serializers
from django.db import transaction
from .models import Order, OrderItem, ReturnRequest
from apps.products.models import Product


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('id', 'product_name', 'product_image', 'quantity', 'unit_price', 'total_price')
        read_only_fields = ('product_name', 'product_image', 'unit_price', 'total_price')


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    buyer_name = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = ReturnRequest
        fields = ('id', 'order', 'order_number', 'reason', 'status', 'vendor_notes',
                  'refund_amount', 'buyer_name', 'store_name', 'created_at')
        read_only_fields = ('id', 'buyer', 'store', 'created_at')

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def create(self, validated_data):
        validated_data['buyer'] = self.context['request'].user
        return super().create(validated_data)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    buyer_email = serializers.CharField(source='buyer.email', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('buyer', 'order_number', 'subtotal', 'shipping_cost',
                           'platform_fee', 'total', 'affiliate_commission')


class CreateOrderItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    variation_id = serializers.UUIDField(required=False)


class CreateOrderSerializer(serializers.Serializer):
    items = CreateOrderItemSerializer(many=True, min_length=1)
    shipping_address = serializers.DictField()
    payment_method = serializers.CharField()
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

        # Criar a primeira encomenda (podemos dividir por loja depois)
        first_store = list(store_orders.values())[0]
        platform_fee = (first_store['store_total'] * 8) / 100

        is_test = validated_data['payment_method'] == 'test'
        order = Order.objects.create(
            buyer=user,
            store=first_store['store'],
            subtotal=subtotal,
            total=first_store['store_total'],
            platform_fee=platform_fee,
            affiliate=affiliate,
            affiliate_commission=affiliate_commission,
            payment_method=validated_data['payment_method'],
            payment_status='completed' if is_test else 'pending',
            status='confirmed' if is_test else 'pending',
            shipping_address=validated_data['shipping_address'],
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
