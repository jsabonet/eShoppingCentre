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


def _fmt_date(dt) -> str:
    try:
        return timezone.localtime(dt).strftime('%d/%m/%Y às %H:%M')
    except Exception:
        return str(dt or '')


def _admin_recipient_emails() -> list:
    """Emails de todos os utilizadores ativos com permissões de administração.

    Abrange as três formas de se tornar admin no sistema:
      1. Superadmin criado via `manage.py createsuperuser` (is_superuser=True,
         is_staff=True, roles vazio);
      2. Utilizador promovido com role 'admin' (o signal `sync_admin_permissions`
         sincroniza is_staff=True automaticamente);
      3. Utilizador com is_staff=True definido manualmente (Django admin/API).
    """
    from django.db.models import Q
    from apps.users.models import User
    admins = User.objects.filter(is_active=True).filter(
        Q(is_staff=True) | Q(is_superuser=True) | Q(roles__contains=['admin'])
    )
    return sorted({email for email in admins.values_list('email', flat=True) if email})


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
    is_digital = not order.has_physical_items
    template = 'order_confirmation_digital.html' if is_digital else 'order_confirmation.html'
    send_templated(
        subject=f'Encomenda {order.order_number} recebida — {SITE_NAME}',
        template_name=template,
        recipient=order.buyer.email,
        text_message=f'Recebemos a tua encomenda {order.order_number} no valor de {_fmt_money(order.total)} MZN.',
        context=base_context(
            first_name=order.buyer.first_name,
            order_number=order.order_number,
            store_name=order.store_name or SITE_NAME,
            total=_fmt_money(order.total),
            order_link=f'/account/orders/{order.id}',
            downloads_link='/account/downloads',
            is_digital=is_digital,
        ),
    )


@shared_task
def send_new_sale_email(order_id: str) -> None:
    """Aviso de nova venda para o vendedor, com detalhes completos."""
    from apps.orders.models import Order
    try:
        order = Order.objects.select_related('buyer', 'store__owner').prefetch_related('items').get(id=order_id)
    except Order.DoesNotExist:
        return
    owner = order.store.owner if order.store else None
    if not owner or not owner.email:
        return
    buyer_name = order.buyer.get_full_name() or order.buyer.email
    is_digital = not order.has_physical_items
    template = 'new_sale_digital.html' if is_digital else 'new_sale.html'

    items = [
        {
            'name': item.product_name,
            'quantity': item.quantity,
            'unit_price': _fmt_money(item.unit_price),
            'total_price': _fmt_money(item.total_price),
        }
        for item in order.items.all()
    ]
    platform_fee = order.platform_fee or 0
    affiliate_commission = order.affiliate_commission or 0
    net_value = order.total - platform_fee - affiliate_commission

    text_items = '; '.join(f'{i["name"]} (x{i["quantity"]})' for i in items)
    text_message = (
        f'Recebeste uma nova venda ({order.order_number}) no valor de {_fmt_money(order.total)} MZN. '
        f'Produtos: {text_items}. Valor líquido: {_fmt_money(net_value)} MZN.'
    )

    send_templated(
        subject=f'Nova venda: {order.order_number} — {SITE_NAME}',
        template_name=template,
        recipient=owner.email,
        text_message=text_message,
        context=base_context(
            first_name=owner.first_name,
            order_number=order.order_number,
            buyer_name=buyer_name,
            items=items,
            items_count=len(items),
            subtotal=_fmt_money(order.subtotal),
            shipping_cost=_fmt_money(order.shipping_cost),
            discount=_fmt_money(order.discount),
            platform_fee=_fmt_money(platform_fee),
            affiliate_commission=_fmt_money(affiliate_commission),
            total=_fmt_money(order.total),
            net_value=_fmt_money(net_value),
            sale_date=_fmt_date(order.created_at),
            order_link=f'/seller/orders',
            is_digital=is_digital,
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
    if not order.has_physical_items:
        return  # encomendas digitais não são enviadas — nunca notificar envio
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


@shared_task
def send_admin_new_sale_email(order_id: str) -> None:
    """Notifica todos os administradores sobre cada nova venda."""
    from apps.orders.models import Order
    try:
        order = Order.objects.select_related('buyer', 'store__owner').get(id=order_id)
    except Order.DoesNotExist:
        return
    buyer_name = order.buyer.get_full_name() or order.buyer.email
    seller_email = order.store.owner.email if order.store and order.store.owner else ''
    is_digital = not order.has_physical_items
    for email in _admin_recipient_emails():
        if email == seller_email:
            continue  # evita duplicado quando o vendedor também é admin
        send_templated(
            subject=f'Nova venda: {order.order_number} — {SITE_NAME}',
            template_name='new_sale_admin.html',
            recipient=email,
            text_message=(f'Nova venda {order.order_number} na loja {order.store_name or SITE_NAME} '
                          f'no valor de {_fmt_money(order.total)} MZN.'),
            context=base_context(
                order_number=order.order_number,
                store_name=order.store_name or SITE_NAME,
                buyer_name=buyer_name,
                total=_fmt_money(order.total),
                is_digital=is_digital,
                admin_order_link=f'/django-admin/orders/order/{order.id}/change/',
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
def send_affiliate_welcome_email(profile_id: str) -> None:
    """Email de boas-vindas após o registo no programa de afiliados."""
    from apps.affiliates.models import AffiliateProfile
    try:
        profile = AffiliateProfile.objects.select_related('user').get(id=profile_id)
    except AffiliateProfile.DoesNotExist:
        return
    user = profile.user
    if not user.email:
        return
    send_templated(
        subject=f'Bem-vindo ao Programa de Afiliados — {SITE_NAME}',
        template_name='affiliate_welcome.html',
        recipient=user.email,
        text_message=(
            f'A tua conta de afiliado foi criada com sucesso. '
            f'Código de indicação: {profile.referral_code}. '
            'Começa a partilhar links e a ganhar comissões.'
        ),
        context=base_context(
            first_name=user.first_name,
            referral_code=profile.referral_code,
            dashboard_link='/affiliate/dashboard',
            products_link='/affiliate/products',
            terms_link='/affiliate/terms',
        ),
    )


@shared_task
def send_affiliate_sale_email(order_id: str) -> None:
    """Aviso imediato ao afiliado de que uma venda foi realizada pelo seu link."""
    from apps.orders.models import Order
    try:
        order = Order.objects.select_related('buyer', 'affiliate').prefetch_related('items').get(id=order_id)
    except Order.DoesNotExist:
        return
    affiliate_user = order.affiliate
    if not affiliate_user or not affiliate_user.email:
        return
    if not order.affiliate_commission or order.affiliate_commission <= 0:
        return

    products = [item.product_name for item in order.items.all()]
    product_name = ', '.join(products) if products else 'Produto(s) referenciado(s)'

    send_templated(
        subject=f'Venda realizada — {SITE_NAME}',
        template_name='affiliate_sale.html',
        recipient=affiliate_user.email,
        text_message=(
            f'Uma venda foi realizada através do teu link: {order.order_number}. '
            f'Produto: {product_name}. Comissão: {_fmt_money(order.affiliate_commission)} MZN.'
        ),
        context=base_context(
            first_name=affiliate_user.first_name,
            order_number=order.order_number,
            product_name=product_name,
            total=_fmt_money(order.total),
            commission=_fmt_money(order.affiliate_commission),
            sale_date=_fmt_date(order.created_at),
            earnings_link='/affiliate/earnings',
        ),
    )


@shared_task
def send_affiliate_commission_email(commission_id: str) -> None:
    """Comissão de afiliado aprovada."""
    from apps.affiliates.models import AffiliateCommission
    try:
        commission = AffiliateCommission.objects.select_related(
            'affiliate__user', 'order', 'product'
        ).get(id=commission_id)
    except AffiliateCommission.DoesNotExist:
        return
    user = commission.affiliate.user
    if not user.email:
        return
    product_name = commission.product.name if commission.product else ''
    send_templated(
        subject=f'Comissão aprovada — {SITE_NAME}',
        template_name='affiliate_commission.html',
        recipient=user.email,
        text_message=(
            f'A tua comissão de {_fmt_money(commission.amount)} MZN '
            f'da venda {commission.order.order_number} foi aprovada.'
        ),
        context=base_context(
            first_name=user.first_name,
            amount=_fmt_money(commission.amount),
            order_number=commission.order.order_number,
            product_name=product_name,
            sale_date=_fmt_date(commission.order.created_at),
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


# ─────────────────────────────────────────────────────────────
# Inventário / Seguidores
# ─────────────────────────────────────────────────────────────

@shared_task
def send_low_stock_email(email, first_name, product_name, current_stock, link) -> None:
    """Aviso de stock baixo ao vendedor."""
    send_templated(
        subject=f'⚠️ Stock baixo: {product_name} — {SITE_NAME}',
        template_name='low_stock.html',
        recipient=email,
        text_message=f'{product_name} está com apenas {current_stock} unidade(s) em stock.',
        context=base_context(
            first_name=first_name,
            product_name=product_name,
            current_stock=current_stock,
            product_link=link,
        ),
    )


@shared_task
def send_new_product_email(email, first_name, store_name, product_name, price, link) -> None:
    """Aviso de novo produto a seguidores da loja."""
    send_templated(
        subject=f'Novo produto na {store_name} — {SITE_NAME}',
        template_name='new_product.html',
        recipient=email,
        text_message=f'{store_name} publicou "{product_name}" — {price} MZN.',
        context=base_context(
            first_name=first_name,
            store_name=store_name,
            product_name=product_name,
            price=price,
            product_link=link,
        ),
    )


# ─────────────────────────────────────────────────────────────
# Devoluções
# ─────────────────────────────────────────────────────────────

@shared_task
def send_return_status_email(return_id: str, recipient: str = 'buyer') -> None:
    """Atualização do estado de uma devolução (buyer ou seller)."""
    from apps.orders.models import ReturnRequest
    try:
        rr = ReturnRequest.objects.select_related('buyer', 'store__owner', 'order').get(id=return_id)
    except ReturnRequest.DoesNotExist:
        return

    if recipient == 'seller':
        user = rr.store.owner if rr.store else None
        if not user or not user.email:
            return
        subject = f'Devolução #{rr.rma_number} enviada pelo cliente — {SITE_NAME}'
        message = f'O cliente enviou a devolução #{rr.rma_number} (encomenda {rr.order.order_number}).'
        status_label = rr.get_status_display()
        action_link = f'/seller/orders'
        action_label = 'Ver encomenda'
    else:
        user = rr.buyer
        if not user.email:
            return
        status_label = rr.get_status_display()
        msgs = {
            'approved': f'A tua devolução #{rr.rma_number} foi aprovada. Segue as instruções de envio.',
            'rejected': f'A tua devolução #{rr.rma_number} foi rejeitada pelo vendedor.',
            'received': f'O vendedor recebeu a tua devolução #{rr.rma_number}.',
            'refunded': f'O reembolso da devolução #{rr.rma_number} foi processado.',
            'disputed': f'A tua contestação da devolução #{rr.rma_number} foi enviada para análise.',
        }
        message = msgs.get(rr.status, f'A tua devolução #{rr.rma_number} foi atualizada para "{status_label}".')
        subject = f'Devolução #{rr.rma_number} — {status_label} — {SITE_NAME}'
        action_link = f'/account/orders/{rr.order_id}'
        action_label = 'Ver encomenda'

    send_templated(
        subject=subject,
        template_name='return_update.html',
        recipient=user.email,
        text_message=message,
        context=base_context(
            first_name=user.first_name,
            message=message,
            status_label=status_label,
            rma=rr.rma_number,
            action_link=action_link,
            action_label=action_label,
        ),
    )


# ─────────────────────────────────────────────────────────────
# Suporte
# ─────────────────────────────────────────────────────────────

@shared_task
def send_ticket_email(ticket_id: str, event: str = 'updated') -> None:
    """Email de confirmação/actualização de ticket de suporte."""
    from apps.orders.models import SupportTicket
    try:
        ticket = SupportTicket.objects.select_related('buyer').get(id=ticket_id)
    except SupportTicket.DoesNotExist:
        return
    if not ticket.buyer.email:
        return

    if event == 'created':
        subject = f'Ticket #{ticket.id} recebido — {SITE_NAME}'
        message = f'Recebemos o teu ticket "{ticket.subject}". A nossa equipa vai responder em breve.'
        status_label = 'Recebido'
    else:
        subject = f'Ticket #{ticket.id} actualizado — {SITE_NAME}'
        message = f'O teu ticket "{ticket.subject}" foi {ticket.get_status_display().lower()}.'
        status_label = ticket.get_status_display()

    send_templated(
        subject=subject,
        template_name='support_ticket.html',
        recipient=ticket.buyer.email,
        text_message=message,
        context=base_context(
            first_name=ticket.buyer.first_name,
            ticket_subject=ticket.subject,
            message=message,
            status_label=status_label,
            action_link=f'/account/orders/{ticket.order_id}',
            action_label='Ver encomenda',
        ),
    )


# ─────────────────────────────────────────────────────────────
# Chat — resumo diário
# ─────────────────────────────────────────────────────────────

@shared_task
def send_chat_digest_email(user_id: str) -> None:
    """Resumo de mensagens não lidas para um utilizador."""
    from django.contrib.auth import get_user_model
    from django.db.models import Q
    from apps.chat.models import Message

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    if not user.email:
        return

    unread = Message.objects.filter(
        Q(conversation__buyer=user) | Q(conversation__seller=user),
        is_read=False,
        is_deleted=False,
    ).exclude(sender=user).count()
    if unread <= 0:
        return

    send_templated(
        subject=f'Tens {unread} mensagens por ler — {SITE_NAME}',
        template_name='chat_digest.html',
        recipient=user.email,
        text_message=f'Tens {unread} mensagens por ler no e-Shopping Centre.',
        context=base_context(
            first_name=user.first_name,
            unread_count=unread,
            inbox_link='/account/messages',
        ),
    )


@shared_task
def send_unread_chat_digests() -> None:
    """Tarefa agendada: envia resumo diário a utilizadores com mensagens não lidas."""
    from apps.chat.models import Message

    buyer_ids = set(Message.objects.filter(
        is_read=False, is_deleted=False
    ).values_list('conversation__buyer_id', flat=True).distinct())
    seller_ids = set(Message.objects.filter(
        is_read=False, is_deleted=False
    ).values_list('conversation__seller_id', flat=True).distinct())

    for uid in {u for u in (buyer_ids | seller_ids) if u}:
        dispatch(send_chat_digest_email, str(uid))


# ─────────────────────────────────────────────────────────────
# Segurança & Conta
# ─────────────────────────────────────────────────────────────

@shared_task
def send_password_changed_email(email, first_name) -> None:
    """Alerta de segurança: password alterada."""
    send_templated(
        subject=f'A tua password foi alterada — {SITE_NAME}',
        template_name='password_changed.html',
        recipient=email,
        text_message='A tua password foi alterada com sucesso. Se não foste tu, contacta o suporte.',
        context=base_context(first_name=first_name),
    )


@shared_task
def send_account_blocked_email(email, first_name) -> None:
    """Aviso de conta desativada/bloqueada."""
    send_templated(
        subject=f'A tua conta foi desativada — {SITE_NAME}',
        template_name='account_blocked.html',
        recipient=email,
        text_message='A tua conta foi desativada. Contacta o suporte para mais informações.',
        context=base_context(first_name=first_name),
    )


@shared_task
def send_kyc_status_email(email, first_name, approved) -> None:
    """Resultado da verificação KYC de afiliado."""
    if approved:
        subject = f'Verificação de conta aprovada — {SITE_NAME}'
        message = 'A tua verificação de conta (KYC) foi aprovada. Já podes solicitar saques.'
        status_label = 'Aprovada'
    else:
        subject = f'Verificação de conta rejeitada — {SITE_NAME}'
        message = 'A tua verificação de conta (KYC) foi rejeitada. Revê os dados e tenta novamente.'
        status_label = 'Rejeitada'
    send_templated(
        subject=subject,
        template_name='kyc_status.html',
        recipient=email,
        text_message=message,
        context=base_context(first_name=first_name, message=message, status_label=status_label),
    )


# ─────────────────────────────────────────────────────────────
# Avaliações
# ─────────────────────────────────────────────────────────────

@shared_task
def send_new_review_email(email, first_name, item_name, rating, link) -> None:
    """Aviso de nova avaliação ao vendedor."""
    send_templated(
        subject=f'Nova avaliação ({rating}★) — {SITE_NAME}',
        template_name='new_review.html',
        recipient=email,
        text_message=f'Recebeste uma nova avaliação de {rating}★ em "{item_name}".',
        context=base_context(first_name=first_name, item_name=item_name, rating=rating, review_link=link),
    )


@shared_task
def send_review_reply_email(email, first_name, item_name, link) -> None:
    """Aviso de resposta do vendedor ao comprador."""
    send_templated(
        subject=f'O vendedor respondeu à tua avaliação — {SITE_NAME}',
        template_name='review_reply.html',
        recipient=email,
        text_message=f'O vendedor respondeu à tua avaliação de "{item_name}".',
        context=base_context(first_name=first_name, item_name=item_name, review_link=link),
    )


# ─────────────────────────────────────────────────────────────
# Cursos
# ─────────────────────────────────────────────────────────────

@shared_task
def send_course_enrollment_email(email, first_name, course_title, link) -> None:
    """Confirmação de matrícula num curso."""
    send_templated(
        subject=f'Matriculado em "{course_title}" — {SITE_NAME}',
        template_name='course_enrollment.html',
        recipient=email,
        text_message=f'Estás matriculado no curso "{course_title}". Bom estudo!',
        context=base_context(first_name=first_name, course_title=course_title, course_link=link),
    )


@shared_task
def send_course_completion_email(email, first_name, course_title, link) -> None:
    """Parabéns pela conclusão de um curso."""
    send_templated(
        subject=f'Parabéns! Concluíste "{course_title}" — {SITE_NAME}',
        template_name='course_completion.html',
        recipient=email,
        text_message=f'Concluíste o curso "{course_title}". Parabéns!',
        context=base_context(first_name=first_name, course_title=course_title, course_link=link),
    )


@shared_task
def send_admin_alert_email(subject: str, message: str) -> None:
    """Alerta operacional para todos os administradores (email de texto)."""
    recipients = _admin_recipient_emails() or [settings.DEFAULT_FROM_EMAIL]
    try:
        send_mail(
            subject=f'[Admin] {subject}',
            message=message,
            from_email=f'{SITE_NAME} <{settings.DEFAULT_FROM_EMAIL}>',
            recipient_list=recipients,
            fail_silently=False,
        )
    except Exception:
        logger.exception('Falha ao enviar alerta administrativo.')
