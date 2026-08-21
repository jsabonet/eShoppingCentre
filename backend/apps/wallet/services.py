"""Serviço da Carteira — operações atómicas sobre saldos + ledger (W1)."""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import Wallet, WalletTransaction, WalletEntry, EscrowHolding
from apps.notifications import email_service


class InsufficientFunds(Exception):
    """Saldo insuficiente para executar o movimento."""


def get_wallet(user):
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


def _apply(wallet, amount, *, kind, ref_type, ref_id, description, txn_type):
    """
    Aplica um movimento atómico de saldo.
    amount > 0 → crédito; amount < 0 → débito.
    kind: 'buyer' (balance) | 'payout' (payout_balance) | 'platform' (tratado como buyer).
    """
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

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
    )
    WalletEntry.objects.create(
        wallet=wallet,
        transaction=txn,
        direction='credit' if amount >= 0 else 'debit',
        amount=abs(amount),
        balance_before=balance_before,
        balance_after=balance_after,
        kind=kind,
    )
    return txn


@transaction.atomic
def credit(wallet, amount, *, kind='buyer', ref_type='system', ref_id, description='', txn_type='sale'):
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError('credit: amount deve ser positivo')
    return _apply(wallet, amount, kind=kind, ref_type=ref_type, ref_id=ref_id,
                  description=description, txn_type=txn_type)


@transaction.atomic
def debit(wallet, amount, *, kind='buyer', ref_type='system', ref_id, description='', txn_type='withdrawal'):
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError('debit: amount deve ser positivo')
    return _apply(wallet, -amount, kind=kind, ref_type=ref_type, ref_id=ref_id,
                  description=description, txn_type=txn_type)


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
           description=f'Venda {order.order_number} (digital/curso)', txn_type='sale')
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
               description=f'Libertação de escrow {order.order_number}', txn_type='sale')
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


def process_refund(order, seller, buyer, refund_amount, description):
    """
    Reembolso: reverte o escrow se ainda retido; senão debita o vendedor;
    e credita o comprador. Deve ser chamado dentro de transaction.atomic().
    """
    if not reverse_escrow(order) and seller:
        debit(get_wallet(seller), refund_amount, kind='payout',
              ref_type='order', ref_id=order.id, description=description, txn_type='refund')
    credit(get_wallet(buyer), refund_amount, kind='buyer',
           ref_type='order', ref_id=order.id, description=description, txn_type='refund')


# ─── Payouts manuais (W3/W4) ───

def get_available_balance(wallet):
    return wallet.payout_balance - wallet.reserved_balance


@transaction.atomic
def request_payout(user, *, role, amount, method, account_details):
    """Cria um pedido de saque e reserva o valor no saldo de saque."""
    from .models import PayoutRequest
    wallet = get_wallet(user)
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError('Valor de saque inválido.')

    available = get_available_balance(wallet)
    if amount > available:
        raise InsufficientFunds(
            f'Saldo insuficiente. Disponível para saque: {available} MZN.'
        )

    payout = PayoutRequest.objects.create(
        user=user, role=role, amount=amount, method=method,
        account_details=account_details or {},
    )
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
    wallet.reserved_balance += amount
    wallet.save(update_fields=['reserved_balance'])

    transaction.on_commit(
        lambda: email_service.dispatch(
            email_service.send_admin_alert_email,
            'Novo pedido de saque',
            f'{user.email} solicitou um saque de {amount} MZN ({role}).',
        )
    )
    return payout


@transaction.atomic
def approve_payout(payout, admin):
    if payout.status != 'pending':
        return payout
    payout.status = 'approved'
    payout.approved_by = admin
    payout.approved_at = timezone.now()
    payout.save(update_fields=['status', 'approved_by', 'approved_at'])
    return payout


@transaction.atomic
def pay_payout(payout, admin, reference=''):
    """Admin confirma o pagamento manual → debita o saldo e marca como pago."""
    if payout.status not in ('pending', 'approved'):
        return payout

    wallet = Wallet.objects.select_for_update().get(pk=get_wallet(payout.user).pk)
    wallet.reserved_balance = max(wallet.reserved_balance - payout.amount, Decimal('0'))
    if wallet.payout_balance < payout.amount:
        raise InsufficientFunds('Saldo de saque insuficiente.')
    balance_before = wallet.payout_balance
    wallet.payout_balance -= payout.amount
    wallet.total_withdrawn += payout.amount
    wallet.save(update_fields=['reserved_balance', 'payout_balance', 'total_withdrawn'])
    balance_after = wallet.payout_balance

    txn = WalletTransaction.objects.create(
        wallet=wallet, type='withdrawal', amount=-payout.amount,
        balance_before=balance_before, balance_after=balance_after,
        reference_type='payout', reference_id=payout.id,
        description=f'Saque ({payout.get_method_display()})', status='completed',
    )
    WalletEntry.objects.create(
        wallet=wallet, transaction=txn, direction='debit', amount=payout.amount,
        balance_before=balance_before, balance_after=balance_after, kind='payout',
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
    if payout.status not in ('pending', 'approved'):
        return payout

    wallet = Wallet.objects.select_for_update().get(pk=get_wallet(payout.user).pk)
    wallet.reserved_balance = max(wallet.reserved_balance - payout.amount, Decimal('0'))
    wallet.save(update_fields=['reserved_balance'])

    payout.status = 'rejected'
    payout.rejection_reason = reason or 'Rejeitado pelo admin'
    payout.save(update_fields=['status', 'rejection_reason'])

    transaction.on_commit(
        lambda: email_service.dispatch(email_service.send_payout_rejected_email, str(payout.id))
    )
    return payout
