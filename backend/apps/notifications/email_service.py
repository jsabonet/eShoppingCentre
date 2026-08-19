"""Serviço central de envio de emails transacionais.

Todos os emails do marketplace devem passar por aqui para garantir:
- envio assíncrono via Celery (com fallback síncrono se o broker falhar);
- templates HTML consistentes;
- contexto base comum (logo, site, ano, suporte).

Os tasks recebem apenas IDs/strings (serializáveis pelo Celery) e
resolvem os objectos internamente, evitando importações circulares.
"""
import logging
from decimal import Decimal, InvalidOperation

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

SITE_NAME = 'e-Shopping Centre'
logger = logging.getLogger(__name__)


def _logo_src() -> str:
    return getattr(settings, 'EMAIL_LOGO_URL', '')


def base_context(**extra):
    ctx = {
        'site_name': SITE_NAME,
        'logo_src': _logo_src(),
        'frontend_url': settings.SITE_URL,
        'support_email': settings.DEFAULT_FROM_EMAIL,
        'year': timezone.now().year,
    }
    ctx.update(extra)
    return ctx


def _fmt_money(value) -> str:
    try:
        v = Decimal(str(value))
        return f"{v:,.2f}".replace(',', ' ').replace('.', ',')
    except (InvalidOperation, ValueError, TypeError):
        return str(value)


def send_templated(subject, template_name, recipient, text_message, context):
    context['subject'] = subject
    html = render_to_string(f'emails/{template_name}', context)
    send_mail(
        subject=subject,
        message=text_message,
        from_email=f'{SITE_NAME} <{settings.DEFAULT_FROM_EMAIL}>',
        recipient_list=[recipient],
        html_message=html,
        fail_silently=False,
    )


def dispatch(task_func, *args):
    """Celery em produção; síncrono em dev; fallback síncrono se o broker falhar."""
    if settings.DEBUG:
        try:
            task_func(*args)
        except Exception:
            logger.exception('Falha ao enviar email (dev).')
        return
    try:
        task_func.delay(*args)
    except Exception:
        logger.exception('Celery indisponível — a enviar email de forma síncrona.')
        try:
            task_func(*args)
        except Exception:
            logger.exception('Falha no envio síncrono do email.')


# ─────────────────────────────────────────────────────────────
# Encomendas
# ─────────────────────────────────────────────────────────────

@shared_task
def send_order_confirmation_email(order_id: str) -> None:
    """Confirmação de encomenda para o comprador."""
    from apps.orders.models import Order
    try:
        order = Order.objects.select_related('buyer').get(id=order_id)
    except Order.DoesNotExist:
        return
    if not order.buyer.email:
        return
    send_templated(
        subject=f'Encomenda {order.order_number} recebida — {SITE_NAME}',
        template_name='order_confirmation.html',
        recipient=order.buyer.email,
        text_message=f'Recebemos a tua encomenda {order.order_number} no valor de {_fmt_money(order.total)} MZN.',
        context=base_context(
            first_name=order.buyer.first_name,
            order_number=order.order_number,
            store_name=order.store_name or SITE_NAME,
            total=_fmt_money(order.total),
            order_link=f'/account/orders/{order.id}',
        ),
    )


@shared_task
def send_new_sale_email(order_id: str) -> None:
    """Aviso de nova venda para o vendedor."""
    from apps.orders.models import Order
    try:
        order = Order.objects.select_related('buyer', 'store__owner').get(id=order_id)
    except Order.DoesNotExist:
        return
    owner = order.store.owner if order.store else None
    if not owner or not owner.email:
        return
    buyer_name = order.buyer.get_full_name() or order.buyer.email
    send_templated(
        subject=f'Nova venda: {order.order_number} — {SITE_NAME}',
        template_name='new_sale.html',
        recipient=owner.email,
        text_message=f'Recebeste uma nova venda ({order.order_number}) no valor de {_fmt_money(order.total)} MZN.',
        context=base_context(
            first_name=owner.first_name,
            order_number=order.order_number,
            buyer_name=buyer_name,
            total=_fmt_money(order.total),
            order_link=f'/seller/orders/{order.id}',
        ),
    )


@shared_task
def send_order_shipped_email(order_id: str) -> None:
    """Encomenda enviada, com código de tracking."""
    from apps.orders.models import Order
    try:
        order = Order.objects.select_related('buyer').get(id=order_id)
    except Order.DoesNotExist:
        return
    if not order.buyer.email:
        return
    send_templated(
        subject=f'A tua encomenda {order.order_number} foi enviada — {SITE_NAME}',
        template_name='order_shipped.html',
        recipient=order.buyer.email,
        text_message=(
            f'A tua encomenda {order.order_number} foi enviada.'
            + (f' Código de tracking: {order.tracking_code}.' if order.tracking_code else '')
        ),
        context=base_context(
            first_name=order.buyer.first_name,
            order_number=order.order_number,
            store_name=order.store_name or SITE_NAME,
            tracking_code=order.tracking_code or '',
            order_link=f'/account/orders/{order.id}',
        ),
    )


# ─────────────────────────────────────────────────────────────
# Carteira / Saques
# ─────────────────────────────────────────────────────────────

@shared_task
def send_payout_paid_email(payout_id: str) -> None:
    """Saque pago — envia a referência de pagamento ao utilizador."""
    from apps.wallet.models import PayoutRequest
    try:
        payout = PayoutRequest.objects.select_related('user').get(id=payout_id)
    except PayoutRequest.DoesNotExist:
        return
    if not payout.user.email:
        return
    reference = payout.admin_reference or '—'
    send_templated(
        subject=f'O teu saque foi pago — {SITE_NAME}',
        template_name='payout_paid.html',
        recipient=payout.user.email,
        text_message=(
            f'O teu saque de {_fmt_money(payout.amount)} MZN foi pago. '
            f'Referência: {reference}.'
        ),
        context=base_context(
            first_name=payout.user.first_name,
            amount=_fmt_money(payout.amount),
            reference=reference,
            method=payout.get_method_display(),
        ),
    )


@shared_task
def send_payout_rejected_email(payout_id: str) -> None:
    """Saque rejeitado — informa o motivo."""
    from apps.wallet.models import PayoutRequest
    try:
        payout = PayoutRequest.objects.select_related('user').get(id=payout_id)
    except PayoutRequest.DoesNotExist:
        return
    if not payout.user.email:
        return
    send_templated(
        subject=f'O teu saque foi rejeitado — {SITE_NAME}',
        template_name='payout_rejected.html',
        recipient=payout.user.email,
        text_message=(
            f'O teu saque de {_fmt_money(payout.amount)} MZN foi rejeitado. '
            f'Motivo: {payout.rejection_reason or "Não especificado"}.'
        ),
        context=base_context(
            first_name=payout.user.first_name,
            amount=_fmt_money(payout.amount),
            reason=payout.rejection_reason or 'Não especificado',
        ),
    )


# ─────────────────────────────────────────────────────────────
# Afiliados
# ─────────────────────────────────────────────────────────────

@shared_task
def send_affiliate_commission_email(commission_id: str) -> None:
    """Comissão de afiliado aprovada."""
    from apps.affiliates.models import AffiliateCommission
    try:
        commission = AffiliateCommission.objects.select_related(
            'affiliate__user'
        ).get(id=commission_id)
    except AffiliateCommission.DoesNotExist:
        return
    user = commission.affiliate.user
    if not user.email:
        return
    send_templated(
        subject=f'Comissão aprovada — {SITE_NAME}',
        template_name='affiliate_commission.html',
        recipient=user.email,
        text_message=f'A tua comissão de {_fmt_money(commission.amount)} MZN foi aprovada.',
        context=base_context(
            first_name=user.first_name,
            amount=_fmt_money(commission.amount),
            earnings_link='/affiliate/earnings',
        ),
    )


# ─────────────────────────────────────────────────────────────
# Lojas
# ─────────────────────────────────────────────────────────────

@shared_task
def send_store_submitted_email(store_id: str) -> None:
    """Confirmação de submissão de loja ao vendedor."""
    from apps.stores.models import Store
    try:
        store = Store.objects.select_related('owner').get(id=store_id)
    except Store.DoesNotExist:
        return
    if not store.owner.email:
        return
    send_templated(
        subject=f'Recebemos a tua loja "{store.name}" — {SITE_NAME}',
        template_name='store_submitted.html',
        recipient=store.owner.email,
        text_message=(
            f'A tua loja "{store.name}" foi recebida e está em análise. '
            'Vais ser notificado assim que for revista.'
        ),
        context=base_context(
            first_name=store.owner.first_name,
            store_name=store.name,
            dashboard_link='/seller/dashboard',
        ),
    )


@shared_task
def send_admin_alert_email(subject: str, message: str) -> None:
    """Alerta operacional simples para a equipa (email de texto)."""
    try:
        send_mail(
            subject=f'[Admin] {subject}',
            message=message,
            from_email=f'{SITE_NAME} <{settings.DEFAULT_FROM_EMAIL}>',
            recipient_list=[settings.DEFAULT_FROM_EMAIL],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Falha ao enviar alerta administrativo.')
