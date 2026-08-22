import uuid
from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from .models import Order, OrderItem, ReturnRequest, ReturnImage, OrderStatusHistory, SupportTicket, SupportTicketImage
from apps.products.models import Product


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('id', 'product_name', 'product_image', 'quantity', 'unit_price', 'total_price', 'product_type')
        read_only_fields = ('product_name', 'product_image', 'unit_price', 'total_price', 'product_type')


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
    product_names = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = ReturnRequest
        fields = (
            'id', 'order', 'order_number', 'reason', 'reason_type', 'reason_type_display',
            'rma_number', 'status', 'vendor_notes', 'refund_amount',
            'return_instructions', 'return_address', 'buyer_tracking_code', 'shipping_notes',
            'buyer_name', 'buyer_email', 'buyer_phone', 'store_name', 'images',
            'product_names', 'product_image', 'created_at', 'disputed_at',
        )
        read_only_fields = ('id', 'buyer', 'store', 'rma_number', 'created_at')

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def get_buyer_email(self, obj):
        return obj.buyer.email

    def get_buyer_phone(self, obj):
        return obj.buyer.phone

    def get_product_names(self, obj):
        items = obj.order.items.all()
        return [item.product_name for item in items]

    def get_product_image(self, obj):
        first = obj.order.items.first()
        return first.product_image if first else None

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
    refund_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
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
    has_physical_items = serializers.SerializerMethodField()
    is_digital_only = serializers.SerializerMethodField()

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

    def get_has_physical_items(self, obj):
        return obj.has_physical_items

    def get_is_digital_only(self, obj):
        return obj.is_digital_only


class CreateOrderItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    variation_id = serializers.UUIDField(required=False)


class CreateOrderSerializer(serializers.Serializer):
    items = CreateOrderItemSerializer(many=True, min_length=1)
    shipping_address = serializers.DictField(required=False, default=dict)
    payment_method = serializers.CharField()
    shipping_selections = serializers.DictField(
        required=False, default=dict,
        help_text='{"store_id": "rate_id"} — método de envio escolhido por loja'
    )
    affiliate_code = serializers.CharField(required=False, allow_blank=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    buyer_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_items(self, items):
        user = self.context['request'].user
        for item in items:
            try:
                product = Product.objects.get(id=item['product_id'], status='active')
                # Impedir compra dos próprios produtos
                if product.store.owner_id == user.id:
                    raise serializers.ValidationError(
                        f'Não pode comprar o seu próprio produto "{product.name}".'
                    )
                if product.product_type == 'physical' and not product.allow_backorder and item['quantity'] > product.stock:
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
        # Fallback: ler o cookie de atribuição (definido no clique /r/{code})
        if not affiliate_code:
            request = self.context.get('request')
            if request:
                affiliate_code = request.COOKIES.get('ref')
        coupon_code = validated_data.pop('coupon_code', '').strip().upper()
        shipping_selections = validated_data.pop('shipping_selections', {})
        province = validated_data.get('shipping_address', {}).get('province', '')

        # Agrupar itens por loja (produtos de lojas diferentes geram encomendas separadas)
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

        # Comissão de afiliado (total, repartida proporcionalmente depois)
        affiliate = None
        affiliate_profile = None
        affiliate_link = None
        affiliate_commission = 0
        effective_rate = None
        if affiliate_code:
            from apps.affiliates.models import AffiliateLink, AffiliateSettings
            from apps.affiliates.services import get_tier_multiplier
            settings_obj = AffiliateSettings.get_settings()
            link = AffiliateLink.objects.filter(code=affiliate_code).select_related('affiliate', 'product').first()
            if (settings_obj.affiliate_program_active and link and link.affiliate.is_active
                    and link.affiliate.user != user  # anti auto-referência
                    and getattr(link.product, 'affiliate_enabled', True)):
                affiliate = link.affiliate.user
                affiliate_profile = link.affiliate
                affiliate_link = link
                multiplier = get_tier_multiplier(link.affiliate)
                effective_rate = link.product.affiliate_commission * multiplier
                for store_data in store_orders.values():
                    for item in store_data['items']:
                        # Bloquear comissão sobre produtos da própria loja do afiliado
                        if item['product'].store.owner_id == link.affiliate.user_id:
                            continue
                        # Só produtos com afiliação habilitada geram comissão
                        if not getattr(item['product'], 'affiliate_enabled', True):
                            continue
                        affiliate_commission += (item['total_price'] * item['product'].affiliate_commission * multiplier) / 100
                # Se nenhum item for elegível, não atribuir comissão
                if affiliate_commission <= 0:
                    affiliate = None
                    affiliate_profile = None
                    affiliate_link = None

        # Frete por loja
        store_shipping = {}  # store_id -> {'cost', 'method_name', 'is_pickup'}
        if shipping_selections:
            from apps.shipping.models import ShippingRate, ShippingSettings
            for store_id, rate_id in shipping_selections.items():
                rate_id = str(rate_id)

                # ─── Frete de fallback da plataforma (loja sem envio configurado) ───
                if rate_id.startswith('platform:'):
                    province_slug = rate_id[len('platform:'):]
                    try:
                        store_data = store_orders.get(uuid.UUID(store_id))
                    except ValueError:
                        continue
                    if not store_data:
                        continue
                    try:
                        shipping_settings = ShippingSettings.get_settings()
                        if shipping_settings.fallback_enabled:
                            store_shipping[store_data['store'].id] = {
                                'cost': Decimal(str(shipping_settings.get_rate(province_slug))),
                                'method_name': shipping_settings.fallback_label,
                                'is_pickup': False,
                            }
                    except Exception:
                        # Sem fallback disponível — encomenda segue sem frete
                        continue
                    continue

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
                            store_shipping[store_data['store'].id] = {
                                'cost': Decimal(str(calc['price'])),
                                'method_name': rate.method.name,
                                'is_pickup': rate.method.method_type == 'pickup',
                            }
                except (ValueError, ShippingRate.DoesNotExist):
                    continue

        # ─── Cupão / desconto ───
        discounts = {}  # store_id -> Decimal (valor do desconto aplicado)
        applied_coupon = None
        if coupon_code:
            from apps.products.models import Coupon, CouponUsage
            try:
                coupon = Coupon.objects.get(code=coupon_code)
            except Coupon.DoesNotExist:
                raise serializers.ValidationError({'coupon_code': 'Cupão inválido.'})
            if not coupon.is_valid:
                raise serializers.ValidationError({'coupon_code': 'Cupão expirado ou esgotado.'})

            # Valor elegível por loja (respeitando restrições de produto/categoria)
            eligible = {}  # store_id -> total elegível
            for sid, sd in store_orders.items():
                if coupon.store and coupon.store.id != sid:
                    continue
                total = 0
                for item in sd['items']:
                    p = item['product']
                    if coupon.product and p.id != coupon.product.id:
                        continue
                    if coupon.category and p.category_id != coupon.category.id:
                        continue
                    total += item['total_price']
                if total > 0:
                    eligible[sid] = total

            if not eligible:
                raise serializers.ValidationError({'coupon_code': 'Este cupão não se aplica aos produtos do carrinho.'})

            eligible_total = sum(eligible.values())
            if eligible_total < coupon.min_purchase:
                raise serializers.ValidationError(
                    {'coupon_code': f'Este cupão exige um mínimo de {coupon.min_purchase} MZN.'}
                )

            if coupon.max_per_user > 0:
                if CouponUsage.objects.filter(coupon=coupon, user=user).count() >= coupon.max_per_user:
                    raise serializers.ValidationError({'coupon_code': 'Já usou este cupão o número máximo de vezes.'})

            if coupon.discount_type == 'percentage':
                discount_total = eligible_total * coupon.discount_value / 100
            else:
                discount_total = min(coupon.discount_value, eligible_total)

            for sid, e_total in eligible.items():
                discounts[sid] = (discount_total * e_total / eligible_total) if eligible_total else 0
            applied_coupon = coupon

        is_test = validated_data['payment_method'] == 'test'
        payment_status = 'completed' if is_test else 'pending'
        order_status = 'confirmed' if is_test else 'pending'

        from apps.products.models import StockLog

        orders = []
        for store_id, store_data in store_orders.items():
            ship = store_shipping.get(store_id, {'cost': 0, 'method_name': '', 'is_pickup': False})
            store_total = store_data['store_total']
            order_discount = discounts.get(store_id, 0)
            platform_fee = (store_total * 8) / 100
            store_affiliate_commission = (affiliate_commission * store_total / subtotal) if subtotal else 0

            order = Order.objects.create(
                buyer=user,
                store=store_data['store'],
                subtotal=store_total,
                shipping_cost=ship['cost'],
                discount=order_discount,
                coupon_code=(coupon_code if order_discount > 0 else ''),
                total=store_total + ship['cost'] - order_discount,
                platform_fee=platform_fee,
                affiliate=affiliate,
                affiliate_commission=round(store_affiliate_commission, 2),
                payment_method=validated_data['payment_method'],
                payment_status=payment_status,
                status=order_status,
                shipping_address=validated_data['shipping_address'],
                shipping_method=ship['method_name'],
                is_pickup=ship['is_pickup'],
                buyer_notes=validated_data.get('buyer_notes', ''),
            )

            for item in store_data['items']:
                OrderItem.objects.create(
                    order=order,
                    product=item['product'],
                    product_name=item['product'].name,
                    product_image=self._get_product_image(item['product']),
                    quantity=item['quantity'],
                    unit_price=item['unit_price'],
                    total_price=item['total_price'],
                    product_type=item['product'].product_type,
                )

                # Deduzir stock e registar no histórico (à prova de concorrência)
                if item['product'].product_type == 'physical':
                    from django.db.models import Case, F, When
                    product = item['product']
                    old_stock = product.stock

                    if product.allow_backorder:
                        # Venda permitida sem stock: nunca descer abaixo de zero
                        Product.objects.filter(pk=product.pk).update(
                            stock=Case(
                                When(stock__gte=item['quantity'], then=F('stock') - item['quantity']),
                                default=0,
                            )
                        )
                    else:
                        updated = Product.objects.filter(
                            pk=product.pk, stock__gte=item['quantity']
                        ).update(stock=F('stock') - item['quantity'])
                        if not updated:
                            raise serializers.ValidationError(
                                f'Stock insuficiente para {product.name}. Disponível: {product.stock}'
                            )

                    product.refresh_from_db(fields=['stock'])
                    StockLog.objects.create(
                        product=product, change_type='sale',
                        quantity=-item['quantity'],
                        stock_before=old_stock, stock_after=product.stock,
                        reference=order.order_number,
                        changed_by=user,
                        notes=f'Venda de {item["quantity"]} unidade(s)',
                    )

            # Processar entregas digitais e matrículas imediatamente
            if order.payment_status == 'completed':
                self._process_delivery(order)

            orders.append(order)

        # Registar utilização do cupão
        if applied_coupon:
            applied_coupon.used_count += 1
            applied_coupon.save(update_fields=['used_count'])
            from apps.products.models import CouponUsage
            for order in orders:
                if order.discount > 0:
                    CouponUsage.objects.create(
                        coupon=applied_coupon, user=user, order=order,
                        discount_applied=order.discount,
                    )

        # Registar comissão de afiliado + incrementar conversões
        if affiliate_profile and affiliate_link:
            from django.db.models import F
            from apps.affiliates.models import AffiliateCommission, AffiliateProfile
            from apps.affiliates.services import update_tier
            for order in orders:
                if order.affiliate_commission > 0:
                    AffiliateCommission.objects.create(
                        affiliate=affiliate_profile,
                        order=order,
                        product=affiliate_link.product,
                        amount=order.affiliate_commission,
                        commission_rate=round(effective_rate or affiliate_link.product.affiliate_commission, 2),
                        status='pending',
                    )
            AffiliateLink.objects.filter(pk=affiliate_link.pk).update(conversions=F('conversions') + len(orders))
            AffiliateProfile.objects.filter(pk=affiliate_profile.pk).update(total_sales=F('total_sales') + len(orders))
            # Recalcular tier com base no novo volume de vendas
            fresh_profile = AffiliateProfile.objects.get(pk=affiliate_profile.pk)
            update_tier(fresh_profile)

        # ─── W2 Escrow: liquidar pagamento (crédito imediato ou retenção) ───
        from apps.wallet.services import settle_payment
        for order in orders:
            if order.payment_status == 'completed':
                settle_payment(order)

        return orders

    def _process_delivery(self, order):
        """Liberta downloads digitais e matricula em cursos após pagamento confirmado."""
        for item in order.items.all():
            product = item.product
            if not product:
                continue

            if product.product_type == 'digital':
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

        # Pedidos 100% digitais/cursos são concluídos de imediato (não há envio)
        if order.is_digital_only and order.status != 'delivered':
            from django.utils import timezone
            now = timezone.now()
            order.status = 'delivered'
            order.confirmed_at = order.confirmed_at or now
            order.delivered_at = order.delivered_at or now
            order.save(update_fields=['status', 'confirmed_at', 'delivered_at'])

    def _get_product_image(self, product):
        img = product.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else ''
        return ''


class SupportTicketImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicketImage
        fields = ('id', 'image', 'caption', 'created_at')
        read_only_fields = ('id', 'created_at')


class SupportTicketSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    buyer_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    images = SupportTicketImageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = ('id', 'order', 'order_number', 'subject', 'category', 'category_display',
                  'description', 'status', 'status_display', 'resolution', 'resolved_at',
                  'buyer_name', 'created_at', 'images')
        read_only_fields = ('id', 'buyer', 'resolved_at', 'created_at')

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def create(self, validated_data):
        validated_data['buyer'] = self.context['request'].user
        return super().create(validated_data)
