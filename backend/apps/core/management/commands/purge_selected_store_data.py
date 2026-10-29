"""Delete the approved stores and their full connected data set."""
import hashlib
import json
import uuid

import requests
from botocore.exceptions import BotoCoreError
from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import DEFAULT_DB_ALIAS, connections, transaction
from django.db.models import Q
from django.db.models.deletion import Collector
from django.db.models.fields.files import FileField
from django.utils import timezone

from apps.affiliates.models import AffiliateCommission, AffiliatePayout
from apps.chat.models import Conversation
from apps.core.management.commands.inventory_store_purge_impact import (
    _connected_order_ids,
)
from apps.courses.models import CourseCertificateEvent
from apps.orders.models import Order
from apps.payments.models import PaymentTransaction
from apps.products.models import Coupon, CouponUsage
from apps.reviews.models import SellerRating
from apps.stores.models import Store
from apps.wallet.models import PayoutRequest, Wallet

APPROVED_STORE_IDS = frozenset({
    uuid.UUID('7595e91f-964c-44af-8479-9b3d368f3b7f'),
    uuid.UUID('2f7b76a7-c89f-4bdd-815e-e925b753cb51'),
    uuid.UUID('4f8388f9-f9e0-4a38-8d6e-f41695a87bd7'),
    uuid.UUID('b5f693a9-e200-48eb-b545-03a3bbdb874d'),
})


def _storage_signature(storage):
    try:
        path, args, kwargs = storage.deconstruct()
        identity = [path, args, kwargs]
    except (AttributeError, TypeError, ValueError):
        identity = [
            storage.__class__.__module__,
            storage.__class__.__qualname__,
        ]
    return hashlib.sha256(
        json.dumps(identity, sort_keys=True, default=str).encode('utf-8')
    ).hexdigest()


def _build_plan(store_ids, using, certificate_event_ids):
    stores = list(
        Store.objects.using(using).filter(id__in=store_ids)
        .select_related('owner').order_by('id')
    )
    if {store.id for store in stores} != set(store_ids):
        raise CommandError('Uma ou mais lojas aprovadas não foram encontradas.')

    seed_orders = Order.objects.using(using).filter(
        Q(store_id__in=store_ids)
        | Q(items__product__store_id__in=store_ids)
    ).distinct()
    seed_order_ids = set(seed_orders.values_list('id', flat=True))
    order_ids, payment_transaction_ids = _connected_order_ids(seed_order_ids)
    owner_ids = {store.owner_id for store in stores}
    collector = Collector(using=using)
    roots = (
        (Order.objects.using(using).filter(id__in=order_ids),),
        (PaymentTransaction.objects.using(using).filter(
            id__in=payment_transaction_ids
        ),),
        (Store.objects.using(using).filter(id__in=store_ids),),
        (Coupon.objects.using(using).filter(
            Q(store_id__in=store_ids) | Q(product__store_id__in=store_ids)
        ).distinct(),),
        (AffiliateCommission.objects.using(using).filter(
            Q(order_id__in=order_ids) | Q(product__store_id__in=store_ids)
        ).distinct(),),
        (Wallet.objects.using(using).filter(user_id__in=owner_ids),),
        (PayoutRequest.objects.using(using).filter(user_id__in=owner_ids),),
        (AffiliatePayout.objects.using(using).filter(
            affiliate__user_id__in=owner_ids
        ),),
        (Conversation.objects.using(using).filter(
            Q(store_id__in=store_ids) | Q(order_id__in=order_ids)
        ).distinct(),),
        (CouponUsage.objects.using(using).filter(order_id__in=order_ids),),
        (SellerRating.objects.using(using).filter(user_id__in=owner_ids),),
    )

    def collect_roots():
        for (queryset,) in roots:
            collector.collect(queryset)

    collect_roots()

    objects_by_model = {
        model: {obj.pk: obj for obj in objects}
        for model, objects in collector.data.items()
    }
    for queryset in collector.fast_deletes:
        model_objects = objects_by_model.setdefault(queryset.model, {})
        for obj in queryset.iterator():
            model_objects[obj.pk] = obj

    rows_by_model = {
        model._meta.label_lower: sorted(str(pk) for pk in objects)
        for model, objects in objects_by_model.items()
    }
    if certificate_event_ids:
        rows_by_model[CourseCertificateEvent._meta.label_lower] = sorted(
            str(value) for value in certificate_event_ids
        )

    file_references = []
    remote_videos = []
    for model, objects_by_id in objects_by_model.items():
        file_fields = [
            field for field in model._meta.concrete_fields
            if isinstance(field, FileField)
        ]
        for obj in objects_by_id.values():
            for field in file_fields:
                file_value = getattr(obj, field.name)
                name = file_value.name
                if name:
                    storage = field.storage
                    storage_id = _storage_signature(storage)
                    file_references.append({
                        'model': model,
                        'record_id': str(obj.pk),
                        'field': field.name,
                        'name': name,
                        'storage': storage,
                        'storage_id': storage_id,
                    })
        if model._meta.label_lower == 'courses.courselesson':
            for obj in objects_by_id.values():
                video_uid = getattr(obj, 'cloudflare_video_uid', '')
                if video_uid:
                    remote_videos.append({
                        'lesson_id': str(obj.pk),
                        'provider': obj.video_provider,
                        'uid': video_uid,
                    })

    transaction_edges = []
    for payment in PaymentTransaction.objects.using(using).filter(
        id__in=payment_transaction_ids
    ).prefetch_related('orders'):
        transaction_edges.append({
            'transaction_id': str(payment.id),
            'direct_order_id': (
                str(payment.order_id) if payment.order_id else None
            ),
            'linked_order_ids': sorted(
                str(value) for value in payment.orders.values_list('id', flat=True)
            ),
        })

    owner_rows = [
        {
            'owner_id': str(store.owner_id),
            'store_id': str(store.id),
            'store_name': store.name,
        }
        for store in stores
    ]
    file_manifest = sorted(
        (
            reference['model']._meta.label_lower,
            reference['record_id'],
            reference['field'],
            reference['storage_id'],
            hashlib.sha256(reference['name'].encode('utf-8')).hexdigest(),
        )
        for reference in file_references
    )
    video_manifest = sorted(
        (
            video['lesson_id'],
            video['provider'],
            hashlib.sha256(video['uid'].encode('utf-8')).hexdigest(),
        )
        for video in remote_videos
    )
    canonical_manifest = json.dumps({
        'rows': rows_by_model,
        'payment_edges': transaction_edges,
        'store_owners': owner_rows,
        'files': file_manifest,
        'videos': video_manifest,
    }, sort_keys=True, separators=(',', ':')).encode('utf-8')

    order_rows = list(
        Order.objects.using(using).filter(id__in=order_ids)
        .select_related('store')
        .order_by('order_number', 'id')
        .values(
            'id',
            'order_number',
            'store_id',
            'store__name',
            'buyer_id',
            'status',
            'payment_method',
            'payment_status',
            'total',
        )
    )
    file_objects = {}
    for reference in file_references:
        file_objects.setdefault(
            (reference['storage_id'], reference['name']),
            (reference['storage'], reference['name']),
        )
    unique_remote_videos = {
        video['uid']: video
        for video in remote_videos
        if video['provider'] == 'cloudflare'
    }
    return {
        'stores': stores,
        'owner_ids': owner_ids,
        'seed_order_ids': seed_order_ids,
        'order_ids': order_ids,
        'payment_transaction_ids': payment_transaction_ids,
        'collector': collector,
        'certificate_event_ids': certificate_event_ids,
        'rows_by_model': rows_by_model,
        'file_references': file_references,
        'file_objects': list(file_objects.values()),
        'remote_videos': list(unique_remote_videos.values()),
        'order_rows': order_rows,
        'manifest_sha256': hashlib.sha256(canonical_manifest).hexdigest(),
        'transaction_edges': transaction_edges,
        'owner_rows': owner_rows,
    }


def _preview_plan(store_ids, using):
    with transaction.atomic(using=using):
        certificate_event_ids = set(
            CourseCertificateEvent.objects.using(using).filter(
                certificate__enrollment__course__product__store_id__in=store_ids
            ).values_list('id', flat=True)
        )
        if certificate_event_ids:
            CourseCertificateEvent.objects.using(using).filter(
                id__in=certificate_event_ids
            ).delete()
        plan = _build_plan(store_ids, using, certificate_event_ids)
        transaction.set_rollback(True, using=using)
    return plan


def _file_is_referenced(storage_id, name, using):
    for model in apps.get_models(include_auto_created=False):
        for field in model._meta.concrete_fields:
            if not isinstance(field, FileField):
                continue
            if _storage_signature(field.storage) != storage_id:
                continue
            if model._default_manager.using(using).filter(
                **{field.name: name}
            ).exists():
                return True
    return False


class Command(BaseCommand):
    help = 'Apaga as quatro lojas aprovadas e todos os registos ligados.'

    def add_arguments(self, parser):
        parser.add_argument(
            'store_ids',
            nargs='+',
            help='UUIDs das quatro lojas aprovadas.',
        )
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Executa a eliminação; sem esta opção apenas apresenta o plano.',
        )
        parser.add_argument(
            '--confirm-impact',
            help='SHA-256 do plano de eliminação revisto.',
        )
        parser.add_argument(
            '--backup-verified',
            action='store_true',
            help='Confirma que existe uma cópia de segurança válida da base de dados.',
        )

    def handle(self, *args, **options):
        try:
            requested_ids = {
                uuid.UUID(value) for value in options['store_ids']
            }
        except ValueError as exc:
            raise CommandError('Todos os IDs de loja devem ser UUIDs válidos.') from exc
        if requested_ids != APPROVED_STORE_IDS:
            raise CommandError(
                'Este comando só aceita exatamente as quatro lojas aprovadas.'
            )

        using = DEFAULT_DB_ALIAS
        execute = options['execute']
        if execute and not options['backup_verified']:
            raise CommandError(
                'Antes de executar, crie e verifique uma cópia de segurança '
                'e informe --backup-verified.'
            )
        if execute and not options['confirm_impact']:
            raise CommandError(
                'A execução exige --confirm-impact com o SHA-256 do dry-run.'
            )

        with transaction.atomic(using=using):
            plan = _preview_plan(requested_ids, using)
            if execute and plan['manifest_sha256'] != options['confirm_impact']:
                raise CommandError(
                    'O plano mudou desde o dry-run. Nenhuma eliminação foi feita; '
                    'gere e reveja um novo plano.'
                )
            if execute:
                if plan['certificate_event_ids']:
                    CourseCertificateEvent.objects.using(using).filter(
                        id__in=plan['certificate_event_ids']
                    ).delete()
                execution_plan = _build_plan(
                    requested_ids,
                    using,
                    plan['certificate_event_ids'],
                )
                if execution_plan['manifest_sha256'] != plan['manifest_sha256']:
                    raise CommandError(
                        'O plano mudou durante a validação. Nenhuma eliminação '
                        'foi feita; gere e reveja um novo plano.'
                    )
                plan = execution_plan
                plan['collector'].delete()
                SellerRating.objects.using(using).filter(
                    user_id__in=plan['owner_ids']
                ).delete()

        report = {
            'generated_at': timezone.now().isoformat(),
            'database_alias': using,
            'mode': 'executed' if execute else 'dry_run',
            'read_only': not execute,
            'mutations_performed': execute,
            'deleted_store_count': len(plan['stores']) if execute else 0,
            'affected_store_count': len(plan['stores']),
            'direct_store_order_count': len(plan['seed_order_ids']),
            'connected_order_count': len(plan['order_ids']),
            'connected_external_order_count': len(
                plan['order_ids'] - plan['seed_order_ids']
            ),
            'connected_payment_transaction_count': len(
                plan['payment_transaction_ids']
            ),
            'preserved_owner_account_ids': sorted(
                str(value) for value in plan['owner_ids']
            ),
            'impact_sha256': plan['manifest_sha256'],
            'deletion_manifest': {
                model: len(ids)
                for model, ids in sorted(plan['rows_by_model'].items())
            },
            'external_asset_cleanup': {
                'file_objects_eligible': len(plan['file_objects']),
                'remote_cloudflare_videos': len(plan['remote_videos']),
                'results': [],
            },
            'affected_orders': [
                {
                    'id': str(row['id']),
                    'order_number': row['order_number'],
                    'store_id': str(row['store_id']) if row['store_id'] else None,
                    'store_name': row['store__name'],
                    'buyer_id': str(row['buyer_id']),
                    'status': row['status'],
                    'payment_method': row['payment_method'],
                    'payment_status': row['payment_status'],
                    'total': str(row['total']),
                }
                for row in plan['order_rows']
            ],
        }

        if execute:
            from apps.courses.services.cloudflare_stream import delete_video

            for storage, name in plan['file_objects']:
                storage_id = _storage_signature(storage)
                result = {
                    'type': 'file',
                    'object_sha256': hashlib.sha256(
                        name.encode('utf-8')
                    ).hexdigest(),
                }
                if _file_is_referenced(storage_id, name, using):
                    result['status'] = 'preserved_shared_reference'
                else:
                    try:
                        storage.delete(name)
                    except (OSError, BotoCoreError) as exc:
                        result['status'] = 'failed'
                        result['error'] = type(exc).__name__
                        result['storage_name'] = name
                    else:
                        result['status'] = 'deleted'
                report['external_asset_cleanup']['results'].append(result)

            for video in plan['remote_videos']:
                result = {
                    'type': 'cloudflare_video',
                    'uid_sha256': hashlib.sha256(
                        video['uid'].encode('utf-8')
                    ).hexdigest(),
                }
                if apps.get_model('courses', 'CourseLesson').objects.filter(
                    cloudflare_video_uid=video['uid']
                ).exists():
                    result['status'] = 'preserved_shared_reference'
                else:
                    try:
                        delete_video(video['uid'])
                    except requests.RequestException as exc:
                        result['status'] = 'failed'
                        result['error'] = type(exc).__name__
                        result['video_uid'] = video['uid']
                    else:
                        result['status'] = 'deleted'
                report['external_asset_cleanup']['results'].append(result)

        self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
        failures = [
            item for item in report['external_asset_cleanup']['results']
            if item['status'] == 'failed'
        ]
        if failures:
            raise CommandError(
                f'A base de dados foi eliminada, mas {len(failures)} ficheiro(s) '
                'ou vídeo(s) externo(s) falharam; consulte os resultados JSON.'
            )
