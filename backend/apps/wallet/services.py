"""Serviço da Carteira — operações atómicas sobre saldos + ledger (W1)."""
from decimal import Decimal
from django.db import transaction
from .models import Wallet, WalletTransaction, WalletEntry


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
