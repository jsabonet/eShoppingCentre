"""Test script for all Roadmap features."""
import django, os, json, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model

User = get_user_model()
factory = APIRequestFactory()
errors = []

def check(desc, condition):
    status = "PASS" if condition else "FAIL"
    if not condition:
        errors.append(desc)
    print(f"  [{status}] {desc}")

# Setup
admin = User.objects.get(email='admin@eshopping.co.mz')
vendor = User.objects.get(email='vendedor@email.com')
client = User.objects.get(email='cliente@email.com')

print("=" * 60)
print("1. DASHBOARD + STATS")
print("=" * 60)

from apps.stores.views_earnings import StoreStatsView, StoreEarningsView
view = StoreStatsView.as_view()

# Vendor with store
req = factory.get('/api/v1/stores/me/stats/')
force_authenticate(req, user=vendor)
resp = view(req)
d = resp.data
check("Status 200 for vendor", resp.status_code == 200)
check("Has today_sales", d.get('today_sales', -1) >= 0)
check("Has total_products", d.get('total_products', -1) >= 0)
check("Has total_revenue", d.get('total_revenue', -1) >= 0)
check("Has recent_orders list", isinstance(d.get('recent_orders'), list))
check("Has top_products list", isinstance(d.get('top_products'), list))
check("Has store_rating", isinstance(d.get('store_rating'), (int, float)))

# User without store
req2 = factory.get('/api/v1/stores/me/stats/')
force_authenticate(req2, user=client)
resp2 = view(req2)
check("User without store returns 200", resp2.status_code == 200)
check("User without store gets empty data", resp2.data.get('total_products') == 0)

# Earnings view
view_e = StoreEarningsView.as_view()
req_e = factory.get('/api/v1/stores/me/earnings/')
force_authenticate(req_e, user=vendor)
resp_e = view_e(req_e)
check("Earnings status 200", resp_e.status_code == 200)
check("Earnings has transactions", isinstance(resp_e.data.get('transactions'), list))

print()
print("=" * 60)
print("2. SELLER LEVELS (TIER)")
print("=" * 60)

from apps.stores.models import Store
from apps.stores.serializers import StoreSerializer

vendor_store = vendor.store
check("Store has tier property", hasattr(vendor_store, 'tier'))
check("Tier is valid string", vendor_store.tier in ('bronze', 'silver', 'gold', 'diamond'))
check("Tier display is formatted", 'Bronze' in vendor_store.tier_display or 'Prata' in vendor_store.tier_display or 'Ouro' in vendor_store.tier_display or 'Diamante' in vendor_store.tier_display)

ser = StoreSerializer(vendor_store, context={'request': req})
check("Serializer exports tier", 'tier' in ser.data)
check("Serializer exports tier_display", 'tier_display' in ser.data)

print()
print("=" * 60)
print("3. PRODUCT VARIANTS")
print("=" * 60)

from apps.products.models import Product, ProductVariant
from apps.products.views import ProductVariantListView, ProductVariantDetailView
from apps.products.serializers import ProductVariantSerializer

prod = Product.objects.filter(store=vendor_store, product_type='physical').first()
if prod:
    print(f"  Testing on: {prod.name}")

    # List
    view_v = ProductVariantListView.as_view()
    req_v = factory.get('/api/v1/products/{}/variants/'.format(prod.id))
    force_authenticate(req_v, user=vendor)
    resp_v = view_v(req_v, product_id=prod.id)
    check("List variants returns 200", resp_v.status_code == 200)

    # Create
    req_c = factory.post(
        '/api/v1/products/{}/variants/'.format(prod.id),
        {'name': 'Teste Azul', 'sku': 'TST-AZUL-001', 'price': '', 'stock': '10',
         'attributes': json.dumps({'Cor': 'Azul'}), 'is_active': True},
        format='json')
    force_authenticate(req_c, user=vendor)
    resp_c = view_v(req_c, product_id=prod.id)
    check("Create variant returns 201", resp_c.status_code == 201)
    variant_id = resp_c.data.get('id') if resp_c.status_code == 201 else None

    if variant_id:
        # Update
        view_d = ProductVariantDetailView.as_view()
        req_u = factory.patch(
            '/api/v1/products/{}/variants/{}/'.format(prod.id, variant_id),
            {'name': 'Teste Azul Editado', 'stock': '15'}, format='json')
        force_authenticate(req_u, user=vendor)
        resp_u = view_d(req_u, product_id=prod.id, pk=variant_id)
        check("Update variant returns 200", resp_u.status_code == 200)
        check("Name updated", resp_u.data.get('name') == 'Teste Azul Editado')

        # Delete
        req_d = factory.delete('/api/v1/products/{}/variants/{}/'.format(prod.id, variant_id))
        force_authenticate(req_d, user=vendor)
        resp_d = view_d(req_d, product_id=prod.id, pk=variant_id)
        check("Delete variant returns 204", resp_d.status_code == 204)

    # Product detail serializer includes variants
    from apps.products.serializers import ProductDetailSerializer
    from apps.products.views import ProductDetailView
    view_pd = ProductDetailView.as_view()
    req_pd = factory.get('/api/v1/products/{}/'.format(prod.slug))
    resp_pd = view_pd(req_pd, slug=prod.slug)
    check("Product detail has variants field", 'variants' in resp_pd.data)
else:
    print("  SKIP: No physical product found for vendor")

print()
print("=" * 60)
print("4. LOW STOCK ALERTS")
print("=" * 60)

from apps.stores.models import Store as StoreModel
from apps.notifications.models import Notification

check("Store has low_stock_threshold", hasattr(vendor_store, 'low_stock_threshold'))
check("Threshold default is 5", vendor_store.low_stock_threshold == 5)

# Test signal by saving a product with low stock
if prod:
    old_stock = prod.stock
    prod.stock = 2  # Below threshold of 5
    prod.save()
    notif = Notification.objects.filter(
        user=vendor, notification_type='low_stock'
    ).order_by('-created_at').first()
    check("Low stock notification created", notif is not None)
    if notif:
        check("Notification has title", notif.title == '⚠️ Stock Baixo')
        check("Notification has link", notif.link != '')
        print(f"    Message: {notif.message[:80]}...")
    # Restore stock
    prod.stock = old_stock
    prod.save()

print()
print("=" * 60)
print("5. EMAIL NOTIFICATION (STORE APPROVAL)")
print("=" * 60)

from django.conf import settings
check("EMAIL_BACKEND is configured", hasattr(settings, 'EMAIL_BACKEND'))
check("DEFAULT_FROM_EMAIL is set", bool(settings.DEFAULT_FROM_EMAIL))

from apps.users.views_admin import AdminStoreManageView
view_admin = AdminStoreManageView.as_view()

# Create a pending store for testing
test_store, _ = StoreModel.objects.get_or_create(
    owner=client,
    defaults={
        'name': 'Loja Teste Aprovacao',
        'slug': 'loja-teste-aprovacao',
        'description': 'Teste de aprovacao',
        'category': 'eletronicos',
        'phone': '840000000',
        'email': client.email,
        'location': 'Maputo',
        'status': 'pending',
    }
)
test_store.status = 'pending'
test_store.save()

# Test approve (sends email to console backend)
req_a = factory.patch('/api/v1/admin/stores/{}/manage/'.format(test_store.id),
    {'action': 'approve'}, format='json')
force_authenticate(req_a, user=admin)
resp_a = view_admin(req_a, pk=test_store.id)
check("Approve store returns 200", resp_a.status_code == 200)
check("Store status changed to active", resp_a.data.get('status') == 'active')
print("    (Email sent to console - check server output)")

# Clean up
test_store.status = 'pending'
test_store.save()

print()
print("=" * 60)
print("6. RETURNS / DEVOLUTIONS")
print("=" * 60)

from apps.orders.models import Order, ReturnRequest
from apps.orders.views import CreateReturnView, StoreReturnsView, ManageReturnView
from apps.orders.serializers import ReturnRequestSerializer

# Find an order for vendor's store
order = Order.objects.filter(store=vendor_store).first()
if order:
    print(f"  Testing with order: {order.order_number}")

    # Create return
    view_ret = CreateReturnView.as_view()
    req_ret = factory.post('/api/v1/orders/returns/',
        {'order': str(order.id), 'reason': 'Produto com defeito'}, format='json')
    force_authenticate(req_ret, user=client)
    resp_ret = view_ret(req_ret)
    check("Create return request returns 201", resp_ret.status_code == 201)
    return_id = resp_ret.data.get('id') if resp_ret.status_code == 201 else None

    if return_id:
        # Vendor lists returns
        view_sr = StoreReturnsView.as_view()
        req_sr = factory.get('/api/v1/orders/returns/store/')
        force_authenticate(req_sr, user=vendor)
        resp_sr = view_sr(req_sr)
        check("Store returns list returns 200", resp_sr.status_code == 200)
        check("Returns list is non-empty", len(resp_sr.data) > 0)

        # Vendor manages return (approve)
        view_mr = ManageReturnView.as_view()
        req_mr = factory.patch('/api/v1/orders/returns/{}/manage/'.format(return_id),
            {'status': 'approved', 'vendor_notes': 'Aprovado, envie o produto'}, format='json')
        force_authenticate(req_mr, user=vendor)
        resp_mr = view_mr(req_mr, pk=return_id)
        check("Manage return returns 200", resp_mr.status_code == 200)
        check("Status changed to approved", resp_mr.data.get('status') == 'approved')
else:
    print("  SKIP: No orders found for vendor store")

print()
print("=" * 60)
print("7. COUPONS")
print("=" * 60)

from apps.products.models import Coupon
from apps.products.views import CouponListView, CouponDetailView, ValidateCouponView
from apps.products.serializers import CouponSerializer

# Create coupon
view_cl = CouponListView.as_view()
from django.utils import timezone
from datetime import timedelta
import uuid

now = timezone.now()
code = 'TEST' + uuid.uuid4().hex[:4].upper()
req_cl = factory.post('/api/v1/products/coupons/',
    {'code': code, 'discount_type': 'percentage', 'discount_value': '20',
     'min_purchase': '100', 'max_uses': '50', 'max_per_user': '1',
     'starts_at': (now - timedelta(days=1)).isoformat(),
     'ends_at': (now + timedelta(days=30)).isoformat(),
     'is_active': True},
    format='json')
force_authenticate(req_cl, user=vendor)
resp_cl = view_cl(req_cl)
check("Create coupon returns 201", resp_cl.status_code == 201)
coupon_id = resp_cl.data.get('id') if resp_cl.status_code == 201 else None

if coupon_id:
    # List coupons
    req_list = factory.get('/api/v1/products/coupons/')
    force_authenticate(req_list, user=vendor)
    resp_list = view_cl(req_list)
    check("List coupons returns 200", resp_list.status_code == 200)
    coupons_list = resp_list.data if isinstance(resp_list.data, list) else resp_list.data.get('results', [])
    check("Has at least 1 coupon", len(coupons_list) > 0)
    first = coupons_list[0] if coupons_list else {}
    check("Coupon is_valid is True", first.get('is_valid') == True)

    # Validate coupon
    view_val = ValidateCouponView.as_view()
    req_val = factory.post('/api/v1/products/coupons/validate/',
        {'code': code}, format='json')
    resp_val = view_val(req_val)
    check("Validate coupon returns 200", resp_val.status_code == 200)
    check("Coupon is valid", resp_val.data.get('valid') == True)
    check("Has discount_value", resp_val.data.get('discount_value') == 20.0)

    # Validate invalid code
    req_val2 = factory.post('/api/v1/products/coupons/validate/',
        {'code': 'NAOEXISTE'}, format='json')
    resp_val2 = view_val(req_val2)
    check("Invalid coupon returns 404", resp_val2.status_code == 404)

    # Delete coupon
    view_cd = CouponDetailView.as_view()
    req_del = factory.delete('/api/v1/products/coupons/{}/'.format(coupon_id))
    force_authenticate(req_del, user=vendor)
    resp_del = view_cd(req_del, pk=coupon_id)
    check("Delete coupon returns 204", resp_del.status_code == 204)

print()
print("=" * 60)
print("SUMMARY")
print("=" * 60)
if errors:
    print(f"FAILED: {len(errors)} test(s)")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
    sys.exit(0)
