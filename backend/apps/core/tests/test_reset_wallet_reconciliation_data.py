import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.affiliates.models import AffiliateCommission, AffiliatePayout, AffiliateProfile
from apps.orders.models import Order, OrderItem
from apps.payments.models import PaymentTransaction
from apps.stores.models import Store
from apps.wallet.views import AdminReconciliationView
from apps.wallet.models import (
    EscrowHolding,
    PayoutRequest,
    Wallet,
    WalletEntry,
    WalletTransaction,
)


class ResetWalletReconciliationDataTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='seller-reset@example.com',
            username='seller-reset',
            password='SecurePassword123!',
            is_staff=True,
        )
        self.buyer = user_model.objects.create_user(
            email='buyer-reset@example.com',
            username='buyer-reset',
            password='SecurePassword123!',
        )
        self.store = Store.objects.create(
            owner=self.admin,
            name='Loja para reset',
            description='Dados de teste.',
            category='geral',
            phone='840000001',
            email='reset-store@example.com',
            location='Maputo',
            status='active',
        )
        self.order = Order.objects.create(
            buyer=self.buyer,
            store=self.store,
            order_number='PED-RESET001',
            subtotal='100.00',
            total='100.00',
            platform_fee='10.00',
            payment_method='mpesa',
            payment_status='completed',
            shipping_address={},
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            product_name='Produto pago',
            quantity=1,
            unit_price='100.00',
            total_price='100.00',
        )
        self.payment = PaymentTransaction.objects.create(
            order=self.order,
            provider='vpay',
            amount='100.00',
            status='completed',
        )
        self.wallet = Wallet.objects.get(user=self.admin)
        self.wallet.balance = '15.00'
        self.wallet.payout_balance = '25.00'
        self.wallet.reserved_balance = '5.00'
        self.wallet.total_earned = '50.00'
        self.wallet.total_withdrawn = '10.00'
        self.wallet.save()
        self.wallet_transaction = WalletTransaction.objects.create(
            wallet=self.wallet,
            type='refund',
            amount='5.00',
            balance_before='10.00',
            balance_after='15.00',
            reference_type='order',
            reference_id=self.order.id,
            status='completed',
        )
        self.wallet_entry = WalletEntry.objects.create(
            wallet=self.wallet,
            transaction=self.wallet_transaction,
            direction='credit',
            amount='5.00',
            balance_before='10.00',
            balance_after='15.00',
        )
        self.escrow = EscrowHolding.objects.create(
            order=self.order,
            amount='20.00',
            status='held',
        )
        self.payout_request = PayoutRequest.objects.create(
            user=self.admin,
            role='seller',
            amount='10.00',
            status='paid',
        )
        self.affiliate = AffiliateProfile.objects.create(
            user=self.admin,
            referral_code='RESET-AFFILIATE',
        )
        self.commission = AffiliateCommission.objects.create(
            affiliate=self.affiliate,
            order=self.order,
            amount='3.00',
            commission_rate='10.00',
        )
        self.affiliate_payout = AffiliatePayout.objects.create(
            affiliate=self.affiliate,
            amount='3.00',
            status='paid',
        )

    def _call(self, output, *args):
        call_command(
            'reset_wallet_reconciliation_data',
            *args,
            stdout=output,
        )

    def test_dry_run_reports_full_impact_without_mutations(self):
        output = StringIO()
        self._call(output)
        report = json.loads(output.getvalue())

        self.assertTrue(report['read_only'])
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['orders']['all_records'], 1)
        self.assertEqual(report['orders']['payment_completed'], 1)
        self.assertEqual(report['wallet_rows_to_zero'], 2)
        self.assertEqual(report['deletion_manifest']['orders.orderitem'], 1)
        self.assertEqual(
            report['deletion_manifest']['affiliates.affiliatecommission'],
            1,
        )
        self.assertTrue(Order.objects.filter(pk=self.order.pk).exists())
        self.assertTrue(PaymentTransaction.objects.filter(pk=self.payment.pk).exists())
        self.assertTrue(WalletTransaction.objects.filter(
            pk=self.wallet_transaction.pk
        ).exists())
        self.assertEqual(Wallet.objects.get(pk=self.wallet.pk).balance, 15)

    def test_requires_backup_and_history_confirmation(self):
        with self.assertRaisesMessage(CommandError, 'backup restaurável'):
            self._call(StringIO(), '--execute')
        with self.assertRaisesMessage(
            CommandError,
            '--confirm-financial-history-erasure',
        ):
            self._call(
                StringIO(),
                '--execute',
                '--backup-verified',
                '--confirm-impact',
                '0' * 64,
            )

    def test_confirmed_reset_deletes_sources_and_zeros_wallets(self):
        preview_output = StringIO()
        self._call(preview_output)
        preview = json.loads(preview_output.getvalue())

        output = StringIO()
        self._call(
            output,
            '--execute',
            '--backup-verified',
            '--confirm-financial-history-erasure',
            '--confirm-impact',
            preview['impact_sha256'],
        )
        report = json.loads(output.getvalue())

        self.assertTrue(report['mutations_performed'])
        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderItem.objects.exists())
        self.assertFalse(PaymentTransaction.objects.exists())
        self.assertFalse(AffiliateCommission.objects.exists())
        self.assertFalse(AffiliatePayout.objects.exists())
        self.assertFalse(PayoutRequest.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())
        self.assertFalse(WalletEntry.objects.exists())
        self.assertFalse(EscrowHolding.objects.exists())
        self.assertTrue(get_user_model().objects.filter(pk=self.admin.pk).exists())
        self.assertTrue(Store.objects.filter(pk=self.store.pk).exists())
        wallet = Wallet.objects.get(pk=self.wallet.pk)
        for field in (
            'balance',
            'payout_balance',
            'reserved_balance',
            'total_earned',
            'total_withdrawn',
        ):
            self.assertEqual(getattr(wallet, field), 0)

        request = APIRequestFactory().get(
            '/api/v1/wallet/admin/reconciliation/'
        )
        force_authenticate(request, user=self.admin)
        response = AdminReconciliationView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        for field, value in response.data.items():
            if field.endswith('_count'):
                self.assertEqual(value, 0)
            else:
                try:
                    self.assertEqual(float(value), 0)
                except (TypeError, ValueError):
                    continue

    def test_changed_impact_hash_rolls_back_without_changes(self):
        with self.assertRaisesMessage(CommandError, 'O plano mudou'):
            self._call(
                StringIO(),
                '--execute',
                '--backup-verified',
                '--confirm-financial-history-erasure',
                '--confirm-impact',
                '0' * 64,
            )
        self.assertTrue(Order.objects.filter(pk=self.order.pk).exists())
        self.assertEqual(Wallet.objects.get(pk=self.wallet.pk).balance, 15)
