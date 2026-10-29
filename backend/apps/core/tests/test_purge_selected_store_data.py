import json
from io import StringIO
from unittest.mock import patch
from uuid import UUID

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.courses.models import (
    Course,
    CourseCertificate,
    CourseCertificateEvent,
    CourseLesson,
    CourseModule,
    Enrollment,
    LessonAttachment,
)
from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.products.models import Product
from apps.stores.models import Store
from apps.wallet.models import PayoutRequest, Wallet, WalletEntry, WalletTransaction

STORE_IDS = [
    UUID('7595e91f-964c-44af-8479-9b3d368f3b7f'),
    UUID('2f7b76a7-c89f-4bdd-815e-e925b753cb51'),
    UUID('4f8388f9-f9e0-4a38-8d6e-f41695a87bd7'),
    UUID('b5f693a9-e200-48eb-b545-03a3bbdb874d'),
]


class PurgeSelectedStoreDataCommandTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owners = [
            user_model.objects.create_user(
                email=f'owner-{index}@example.com',
                username=f'owner-{index}',
                password='SecurePassword123!',
            )
            for index in range(4)
        ]
        self.external_owner = user_model.objects.create_user(
            email='external-owner@example.com',
            username='external-owner',
            password='SecurePassword123!',
        )
        self.store_names = [
            'Dale Carnigie Store',
            'English Class',
            'Loja De PDFs',
            'TechMoz Store',
        ]
        self.stores = [
            Store.objects.create(
                id=store_id,
                owner=owner,
                name=f'{name} Test {index}',
                description='Loja usada no teste.',
                category='geral',
                phone=f'84000000{index}',
                email=f'store-{index}@example.com',
                location='Maputo',
                status='active',
            )
            for index, (store_id, owner, name) in enumerate(
                zip(STORE_IDS, self.owners, self.store_names)
            )
        ]
        self.external_store = Store.objects.create(
            owner=self.external_owner,
            name='Loja externa de teste',
            description='Não deve ser eliminada.',
            category='geral',
            phone='840000099',
            email='external-store@example.com',
            location='Maputo',
            status='active',
        )
        self.selected_order = Order.objects.create(
            buyer=self.external_owner,
            store=self.stores[0],
            order_number='PED-PURGE001',
            subtotal='120.00',
            total='120.00',
            payment_method='test',
            payment_status='completed',
            shipping_address={},
        )
        self.external_order = Order.objects.create(
            buyer=self.owners[0],
            store=self.external_store,
            order_number='PED-EXTERNAL1',
            subtotal='30.00',
            total='30.00',
            payment_method='mpesa',
            payment_status='completed',
            shipping_address={},
        )
        self.transaction = PaymentTransaction.objects.create(
            order=self.selected_order,
            provider='vpay',
            amount='150.00',
            status='completed',
        )
        self.transaction.orders.add(self.external_order)

        self.product = Product.objects.create(
            store=self.stores[1],
            name='Curso para purga',
            description='Curso usado no teste.',
            price='50.00',
            product_type='course',
        )
        course = Course.objects.create(
            product=self.product,
            instructor=self.owners[1],
            duration='1 hora',
        )
        module = CourseModule.objects.create(course=course, title='Módulo')
        lesson = CourseLesson.objects.create(
            module=module,
            title='Aula',
            cloudflare_video_uid='video-de-teste',
        )
        LessonAttachment.objects.create(
            lesson=lesson,
            title='Material de teste',
            file='courses/attachments/test/material.pdf',
        )
        enrollment = Enrollment.objects.create(
            user=self.external_owner,
            course=course,
            order=self.selected_order,
        )
        certificate = CourseCertificate.objects.create(
            enrollment=enrollment,
            recipient_name='Aluno de teste',
            course_title=self.product.name,
        )
        self.certificate_event = CourseCertificateEvent.objects.create(
            certificate=certificate,
            actor=self.owners[1],
            action='issued',
        )

        self.wallet = Wallet.objects.get(
            user=self.owners[0],
        )
        self.wallet.balance = '25.00'
        self.wallet.payout_balance = '35.00'
        self.wallet.total_earned = '60.00'
        self.wallet.save(update_fields=[
            'balance',
            'payout_balance',
            'total_earned',
        ])
        self.wallet_transaction = WalletTransaction.objects.create(
            wallet=self.wallet,
            type='sale',
            amount='25.00',
            balance_before='0.00',
            balance_after='25.00',
            reference_type='order',
            reference_id=self.selected_order.id,
            status='completed',
        )
        self.wallet_entry = WalletEntry.objects.create(
            wallet=self.wallet,
            transaction=self.wallet_transaction,
            direction='credit',
            amount='25.00',
            balance_before='0.00',
            balance_after='25.00',
        )
        self.payout_request = PayoutRequest.objects.create(
            user=self.owners[0],
            role='seller',
            amount='10.00',
        )

    def _call(self, output, *extra_args):
        call_command(
            'purge_selected_store_data',
            *[str(store_id) for store_id in STORE_IDS],
            *extra_args,
            stdout=output,
        )

    def test_dry_run_rolls_back_certificate_event_deletion(self):
        output = StringIO()
        self._call(output)

        report = json.loads(output.getvalue())
        self.assertTrue(report['read_only'])
        self.assertFalse(report['mutations_performed'])
        self.assertEqual(report['direct_store_order_count'], 1)
        self.assertEqual(report['connected_order_count'], 2)
        self.assertEqual(report['connected_external_order_count'], 1)
        self.assertEqual(
            report['deletion_manifest']['products.product'],
            1,
        )
        self.assertEqual(
            report['deletion_manifest']['courses.lessonattachment'],
            1,
        )
        self.assertEqual(
            report['external_asset_cleanup']['remote_cloudflare_videos'],
            1,
        )
        self.assertTrue(
            CourseCertificateEvent.objects.filter(
                pk=self.certificate_event.pk
            ).exists()
        )
        self.assertTrue(Store.objects.filter(pk=self.stores[0].pk).exists())
        self.assertTrue(Order.objects.filter(pk=self.selected_order.pk).exists())
        self.assertTrue(Wallet.objects.filter(pk=self.wallet.pk).exists())

    def test_confirmed_purge_deletes_connected_data_but_preserves_users(self):
        preview_output = StringIO()
        self._call(preview_output)
        preview = json.loads(preview_output.getvalue())

        execute_output = StringIO()
        with patch(
            'apps.courses.services.cloudflare_stream.delete_video'
        ) as delete_video:
            self._call(
                execute_output,
                '--execute',
                '--backup-verified',
                '--confirm-impact',
                preview['impact_sha256'],
            )
        delete_video.assert_called_once_with('video-de-teste')

        report = json.loads(execute_output.getvalue())
        self.assertTrue(report['mutations_performed'])
        self.assertEqual(report['deleted_store_count'], 4)
        self.assertEqual(report['connected_order_count'], 2)
        self.assertEqual(Store.objects.filter(id__in=STORE_IDS).count(), 0)
        self.assertTrue(
            Store.objects.filter(pk=self.external_store.pk).exists()
        )
        self.assertFalse(Order.objects.filter(
            pk__in=[self.selected_order.pk, self.external_order.pk]
        ).exists())
        self.assertFalse(PaymentTransaction.objects.filter(
            pk=self.transaction.pk
        ).exists())
        self.assertFalse(Wallet.objects.filter(pk=self.wallet.pk).exists())
        self.assertFalse(WalletTransaction.objects.filter(
            pk=self.wallet_transaction.pk
        ).exists())
        self.assertFalse(WalletEntry.objects.filter(pk=self.wallet_entry.pk).exists())
        self.assertFalse(PayoutRequest.objects.filter(
            pk=self.payout_request.pk
        ).exists())
        self.assertFalse(CourseCertificateEvent.objects.filter(
            pk=self.certificate_event.pk
        ).exists())
        self.assertFalse(CourseLesson.objects.filter(
            module__course__product=self.product
        ).exists())
        self.assertFalse(LessonAttachment.objects.filter(
            lesson__module__course__product=self.product
        ).exists())
        for owner in self.owners:
            self.assertTrue(get_user_model().objects.filter(pk=owner.pk).exists())
        self.assertTrue(
            get_user_model().objects.filter(pk=self.external_owner.pk).exists()
        )

    def test_refuses_changed_hash_without_mutating_data(self):
        with self.assertRaisesMessage(CommandError, 'O plano mudou'):
            self._call(
                StringIO(),
                '--execute',
                '--backup-verified',
                '--confirm-impact',
                '0' * 64,
            )
        self.assertTrue(Store.objects.filter(pk=self.stores[0].pk).exists())
        self.assertTrue(Order.objects.filter(pk=self.selected_order.pk).exists())
        self.assertTrue(Wallet.objects.filter(pk=self.wallet.pk).exists())

    def test_requires_backup_and_impact_confirmation_before_execution(self):
        with self.assertRaisesMessage(CommandError, 'cópia de segurança'):
            self._call(StringIO(), '--execute')
        with self.assertRaisesMessage(CommandError, '--confirm-impact'):
            self._call(
                StringIO(),
                '--execute',
                '--backup-verified',
            )

        self.assertTrue(Store.objects.filter(pk=self.stores[0].pk).exists())
        self.assertTrue(Order.objects.filter(pk=self.selected_order.pk).exists())
        self.assertTrue(Wallet.objects.filter(pk=self.wallet.pk).exists())
