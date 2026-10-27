"""Serviço da Carteira — operações atómicas sobre saldos + ledger (W1)."""
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.utils import timezone
from .models import Wallet, WalletTransaction, WalletEntry, EscrowHolding
from apps.notifications import email_service


class InsufficientFunds(Exception):
    """Saldo insuficiente para executar o movimento."""


def get_wallet(user):
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


def _apply(wallet, amount, *, kind, ref_type, ref_id, description, txn_type,
           idempotency_key=None, counterparty='platform'):
    """
    Aplica um movimento atómico de saldo.
    amount > 0 → crédito; amount < 0 → débito.
    kind: 'buyer' (balance) | 'payout' (payout_balance) | 'platform' (tratado como buyer).
    idempotency_key: se fornecido e já existir um movimento com a mesma chave,
    devolve o movimento existente sem alterar saldos (idempotência).
    counterparty: contraparte do movimento no ledger (ver WalletEntry.COUNTERPARTY_CHOICES).
    """
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

    if idempotency_key:
        existing = WalletTransaction.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    if kind == 'payout':
        balance_before = wallet.payout_balance
        wallet.payout_balance += amount
        if amount > 0:
            wallet.total_earned += amount
        else:
            wallet.total_earned = max(wallet.total_earned - abs(amount), Decimal('0'))
        update_fields = ['payout_balance', 'total_earned']
        balance_after = wallet.payout_balance
    else:  # buyer (e platform por agora)
        balance_before = wallet.balance
        wallet.balance += amount
        update_fields = ['balance']
        balance_after = wallet.balance

    if balance_after < 0:
        raise InsufficientFunds(
            f'Saldo insuficiente na carteira. Disponível: {balance_before}, Necessário: {abs(amount)}.'
        )

    wallet.save(update_fields=update_fields)

    txn = WalletTransaction.objects.create(
        wallet=wallet,
        type=txn_type,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        reference_type=ref_type,
        reference_id=ref_id,
        description=description,
        status='completed',
        idempotency_key=idempotency_key,
    )
    WalletEntry.objects.create(
        wallet=wallet,
        transaction=txn,
        direction='credit' if amount >= 0 else 'debit',
        amount=abs(amount),
        balance_before=balance_before,
        balance_after=balance_after,
        kind=kind,
        counterparty=counterparty,
    )
    return txn


@transaction.atomic
def credit(wallet, amount, *, kind='buyer', ref_type='system', ref_id, description='',
           txn_type='sale', idempotency_key=None, counterparty='platform'):
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError('credit: amount deve ser positivo')
    return _apply(wallet, amount, kind=kind, ref_type=ref_type, ref_id=ref_id,
                  description=description, txn_type=txn_type,
                  idempotency_key=idempotency_key, counterparty=counterparty)


@transaction.atomic
def debit(wallet, amount, *, kind='buyer', ref_type='system', ref_id, description='',
          txn_type='withdrawal', idempotency_key=None, counterparty='platform'):
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError('debit: amount deve ser positivo')
    return _apply(wallet, -amount, kind=kind, ref_type=ref_type, ref_id=ref_id,
                  description=description, txn_type=txn_type,
                  idempotency_key=idempotency_key, counterparty=counterparty)


@transaction.atomic
def settle_payment(order):
    """
    Após pagamento confirmado: produtos digitais/cursos são creditados de imediato;
    produtos físicos ficam retidos em escrow até entrega + janela de devolução.
    """
    net = order.total - (order.platform_fee or 0) - (order.affiliate_commission or 0)
    if net <= 0:
        return None
    seller = order.store.owner if order.store else None
    if not seller:
        return None

    has_physical = order.has_physical_items
    if has_physical:
        escrow, _created = EscrowHolding.objects.get_or_create(
            order=order,
            defaults={'amount': net, 'status': 'held'},
        )
        return escrow

    credit(get_wallet(seller), net, kind='payout',
           ref_type='order', ref_id=order.id,
           description=f'Venda {order.order_number} (digital/curso)', txn_type='sale',
           idempotency_key=f'order:{order.id}:settle', counterparty='external')
    return None


@transaction.atomic
def release_escrow(escrow):
    """Liberta um escrow retido, creditando o vendedor no saldo de saque."""
    escrow = EscrowHolding.objects.select_for_update().get(pk=escrow.pk)
    if escrow.status != 'held':
        return escrow
    order = escrow.order
    seller = order.store.owner if order.store else None
    if seller:
        credit(get_wallet(seller), escrow.amount, kind='payout',
               ref_type='order', ref_id=order.id,
               description=f'Libertação de escrow {order.order_number}', txn_type='sale',
               idempotency_key=f'escrow:{escrow.id}:release', counterparty='escrow')
    escrow.status = 'released'
    escrow.released_at = timezone.now()
    escrow.save(update_fields=['status', 'released_at'])
    return escrow


@transaction.atomic
def reverse_escrow(order):
    """Reverte um escrow ainda retido (ex: cancelamento/reembolso). Retorna True se reverteu."""
    escrow = EscrowHolding.objects.select_for_update().filter(order=order, status='held').first()
    if escrow:
        escrow.status = 'reversed'
        escrow.save(update_fields=['status'])
        return True
    return False


@transaction.atomic
def process_refund(order, seller, buyer, refund_amount, description, *, refund_id):
    """
    Reembolso: reverte o escrow se ainda retido; senão debita o vendedor;
    e credita o comprador. Deve ser chamado dentro de transaction.atomic().
    """
    from django.db.models import Sum
    from apps.orders.models import Order

    order = Order.objects.select_for_update().get(pk=order.pk)
    refund_amount = Decimal(str(refund_amount))
    if order.payment_status != 'completed':
        raise ValueError('Só é possível reembolsar encomendas pagas.')
    if refund_amount <= 0:
        raise ValueError('O valor do reembolso deve ser positivo.')

    credit_key = f'order:{order.id}:refund:{refund_id}:credit'
    if WalletTransaction.objects.filter(idempotency_key=credit_key).exists():
        return WalletTransaction.objects.get(idempotency_key=credit_key)

    refunded_before = WalletTransaction.objects.filter(
        type='refund',
        reference_type='order',
        reference_id=order.id,
        amount__gt=0,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    remaining = max(order.total - refunded_before, Decimal('0.00'))
    if refund_amount > remaining:
        raise ValueError(
            f'O reembolso excede o valor ainda reembolsável ({remaining} MZN).'
        )

    seller_net = max(
        order.total - (order.platform_fee or 0) - (order.affiliate_commission or 0),
        Decimal('0.00'),
    )
    seller_share = (
        (seller_net * refund_amount / order.total).quantize(Decimal('0.01'))
        if order.total else Decimal('0.00')
    )
    escrow = EscrowHolding.objects.select_for_update().filter(order=order).first()
    if escrow and escrow.status == 'held':
        escrow_reversal = min(seller_share, escrow.amount)
        escrow.amount -= escrow_reversal
        if escrow.amount == 0:
            escrow.status = 'reversed'
            escrow.save(update_fields=['amount', 'status'])
        else:
            escrow.save(update_fields=['amount'])
    elif seller and seller_share > 0:
        debit(
            get_wallet(seller), seller_share, kind='payout',
            ref_type='order', ref_id=order.id, description=description, txn_type='refund',
            idempotency_key=f'order:{order.id}:refund:{refund_id}:debit',
        )

    refund_txn = credit(
        get_wallet(buyer), refund_amount, kind='buyer',
        ref_type='order', ref_id=order.id, description=description, txn_type='refund',
        idempotency_key=credit_key,
    )
    if refunded_before + refund_amount >= order.total:
        order.status = 'refunded'
        order.save(update_fields=['status', 'updated_at'])
    return refund_txn


def get_refundable_amount(order):
    from django.db.models import Sum

    refunded = WalletTransaction.objects.filter(
        type='refund',
        reference_type='order',
        reference_id=order.id,
        amount__gt=0,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    return max(order.total - refunded, Decimal('0.00'))


# ─── Payouts manuais (W3/W4) ───

def get_available_balance(wallet):
    return wallet.payout_balance - wallet.reserved_balance


@transaction.atomic
def request_payout(user, *, role, amount, method, account_details):
    """Cria um pedido de saque, reserva o valor bruto e fixa a taxa aplicada."""
    from .models import PayoutRequest
    try:
        amount = Decimal(str(amount))
        rounded_amount = amount.quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError('Valor de saque inválido.') from exc
    if not amount.is_finite() or amount != rounded_amount or amount <= 0:
        raise ValueError('Valor de saque inválido.')
    if role not in ('seller', 'affiliate'):
        raise ValueError('Perfil de saque inválido.')
    if method not in ('mpesa', 'emola', 'bank'):
        raise ValueError('Método de saque inválido.')

    from apps.affiliates.models import AffiliateKYC, AffiliateProfile
    affiliate_profile = AffiliateProfile.objects.filter(user=user).first()
    if role == 'affiliate':
        if not affiliate_profile:
            raise ValueError('Não existe uma conta de afiliado para este utilizador.')
        if not affiliate_profile.is_active or affiliate_profile.status != 'active':
            raise ValueError('A conta de afiliado não está ativa para solicitar saques.')
        kyc = AffiliateKYC.objects.filter(affiliate=affiliate_profile, status='approved').first()
        from apps.affiliates.services import has_verified_seller_account
        if not kyc and not has_verified_seller_account(user):
            raise ValueError('É necessária a verificação aprovada da conta (KYC) antes de solicitar saques.')
        from apps.affiliates.models import AffiliateSettings
        settings_obj = AffiliateSettings.get_settings()
        if amount < settings_obj.min_payout_amount:
            raise ValueError(f'O valor mínimo de saque é {settings_obj.min_payout_amount} MZN.')
        fee_percent = Decimal('5.00')
    else:
        fee_percent = Decimal('11.00')

    fee = (amount * fee_percent / Decimal('100')).quantize(Decimal('0.01'))

    wallet = Wallet.objects.select_for_update().get(pk=get_wallet(user).pk)
    available = get_available_balance(wallet)
    if amount > available:
        raise InsufficientFunds(
            f'Saldo insuficiente. Disponível para saque: {available} MZN.'
        )

    payout = PayoutRequest.objects.create(
        user=user, role=role, amount=amount, fee_percent=fee_percent, fee=fee, method=method,
        account_details=account_details or {},
    )
    wallet.reserved_balance += amount
    wallet.save(update_fields=['reserved_balance'])

    transaction.on_commit(
        lambda: email_service.dispatch(
            email_service.send_admin_alert_email,
            'Novo pedido de saque',
            f'{user.email} solicitou um saque bruto de {amount} MZN ({role}). '
            f'Taxa: {fee} MZN; valor líquido para transferência manual: {amount - fee} MZN.',
        )
    )
    return payout


@transaction.atomic
def approve_payout(payout, admin):
    from .models import PayoutRequest
    payout = PayoutRequest.objects.select_for_update().get(pk=payout.pk)
    if payout.status != 'pending':
        return payout
    payout.status = 'approved'
    payout.approved_by = admin
    payout.approved_at = timezone.now()
    payout.save(update_fields=['status', 'approved_by', 'approved_at'])
    return payout


@transaction.atomic
def pay_payout(payout, admin, reference=''):
    """Admin confirma o pagamento manual → debita o saldo e marca como pago.

    Exige aprovação prévia (status == 'approved'): o pagamento manual não pode
    saltar o passo de aprovação.
    """
    from .models import PayoutRequest
    payout = PayoutRequest.objects.select_for_update().get(pk=payout.pk)
    if payout.status != 'approved':
        raise ValueError('O saque deve ser aprovado antes de ser marcado como pago.')
    reference = reference.strip()
    if not reference:
        raise ValueError('Indique a referência da transferência manual antes de marcar o saque como pago.')

    wallet = Wallet.objects.select_for_update().get(pk=get_wallet(payout.user).pk)

    idem_key = f'payout:{payout.id}:pay'
    if WalletTransaction.objects.filter(idempotency_key=idem_key).exists():
        return payout

    if wallet.reserved_balance < payout.amount:
        raise ValueError('A reserva deste saque não corresponde ao saldo reservado da carteira.')
    if wallet.payout_balance < payout.amount:
        raise InsufficientFunds('Saldo de saque insuficiente.')
    balance_before = wallet.payout_balance
    wallet.payout_balance -= payout.amount
    wallet.reserved_balance -= payout.amount
    wallet.total_withdrawn += payout.amount
    wallet.save(update_fields=['reserved_balance', 'payout_balance', 'total_withdrawn'])
    transfer_balance_after = balance_before - payout.net_amount

    txn = WalletTransaction.objects.create(
        wallet=wallet, type='withdrawal', amount=-payout.net_amount,
        balance_before=balance_before, balance_after=transfer_balance_after,
        reference_type='payout', reference_id=payout.id,
        description=f'Transferência manual de saque ({payout.get_method_display()})', status='completed',
        idempotency_key=idem_key,
    )
    WalletEntry.objects.create(
        wallet=wallet, transaction=txn, direction='debit', amount=payout.net_amount,
        balance_before=balance_before, balance_after=transfer_balance_after, kind='payout',
        counterparty='external',
    )
    if payout.fee:
        fee_balance_after = transfer_balance_after - payout.fee
        fee_txn = WalletTransaction.objects.create(
            wallet=wallet, type='fee', amount=-payout.fee,
            balance_before=transfer_balance_after, balance_after=fee_balance_after,
            reference_type='payout', reference_id=payout.id,
            description=f'Taxa de saque ({payout.fee_percent}%)', status='completed',
            idempotency_key=f'payout:{payout.id}:fee',
        )
        WalletEntry.objects.create(
            wallet=wallet, transaction=fee_txn, direction='debit', amount=payout.fee,
            balance_before=transfer_balance_after, balance_after=fee_balance_after,
            kind='payout', counterparty='platform',
        )

    payout.status = 'paid'
    payout.paid_by = admin
    payout.paid_at = timezone.now()
    payout.admin_reference = reference or ''
    payout.save(update_fields=['status', 'paid_by', 'paid_at', 'admin_reference'])

    transaction.on_commit(
        lambda: email_service.dispatch(email_service.send_payout_paid_email, str(payout.id))
    )
    return payout


@transaction.atomic
def reject_payout(payout, admin, reason=''):
    from .models import PayoutRequest
    payout = PayoutRequest.objects.select_for_update().get(pk=payout.pk)
    if payout.status not in ('pending', 'approved'):
        return payout

    wallet = Wallet.objects.select_for_update().get(pk=get_wallet(payout.user).pk)
    if wallet.reserved_balance < payout.amount:
        raise ValueError('A reserva deste saque não corresponde ao saldo reservado da carteira.')
    wallet.reserved_balance -= payout.amount
    wallet.save(update_fields=['reserved_balance'])

    payout.status = 'rejected'
    payout.rejection_reason = reason or 'Rejeitado pelo admin'
    payout.save(update_fields=['status', 'rejection_reason'])

    transaction.on_commit(
        lambda: email_service.dispatch(email_service.send_payout_rejected_email, str(payout.id))
    )
    return payout
