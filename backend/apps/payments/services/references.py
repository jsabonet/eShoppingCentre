"""Mapeamento entre as referências do gateway e as encomendas.

O ZumboPay gera as suas próprias referências (``ZP…``) e a API não aceita uma
referência do comerciante. Há por isso duas direcções a resolver:

  * ``reference`` do comerciante → encomendas (`Order.payment_id`);
  * referência do gateway → transacção persistida → referência do comerciante.

Este módulo centraliza esse mapeamento (sem I/O de rede), usado tanto pelo
webhook como pela reconciliação de pagamentos.
"""
from apps.orders.models import Order
from apps.payments.models import PaymentTransaction

#: Prefixo das chaves de idempotência das transacções de checkout.
KEY_PREFIX = 'zumbopay:'

#: Prefixo das transacções registadas quando o gateway cobrou algo que não foi
#: possível mapear para nenhuma encomenda (auditoria, não são reconciliáveis).
FAILED_KEY_PREFIX = 'zumbopay:failed:'


def idempotency_key(reference):
    """Chave de idempotência da transacção de checkout (``zumbopay:<referência>``)."""
    return f'{KEY_PREFIX}{reference}'


def merchant_reference(key):
    """Referência do comerciante contida numa chave de idempotência (``''`` se não houver)."""
    if not key or not key.startswith(KEY_PREFIX) or key.startswith(FAILED_KEY_PREFIX):
        return ''
    return key[len(KEY_PREFIX):]


def resolve_orders(reference):
    """Encomendas de um checkout, pela referência gravada em ``Order.payment_id``."""
    if not reference:
        return Order.objects.none()
    return Order.objects.filter(payment_id=reference)


def find_transaction(*, idem_key='', gateway_reference=''):
    """Transacção de checkout, pela chave de idempotência ou pela referência do gateway."""
    if idem_key:
        txn = PaymentTransaction.objects.filter(idempotency_key=idem_key).first()
        if txn:
            return txn
    if gateway_reference:
        return PaymentTransaction.objects.filter(
            provider='zumbopay', provider_transaction_id=gateway_reference,
        ).first()
    return None


def find_transaction_for_order(order):
    """Transacção ZumboPay associada a uma encomenda (a mais recente)."""
    return PaymentTransaction.objects.filter(
        provider='zumbopay', order=order,
    ).order_by('-created_at').first()


def resolve_orders_from_gateway(payload_data):
    """Mapeia o payload do webhook para as encomendas e a referência do checkout.

    O ZumboPay gera a própria ``reference`` (``ZP…``) e a API não aceita uma
    referência do comerciante. O mapeamento é por isso reconstruído a partir da
    transacção persistida no ``initiate``: testa-se primeiro a hipótese de o
    gateway ecoar a nossa referência e, em alternativa, resolve-se pela
    referência do gateway gravada em ``provider_transaction_id``.

    Devolve ``(queryset de encomendas, referência do checkout)``.
    """
    candidates = [payload_data.get('reference'), payload_data.get('id'), payload_data.get('slug')]
    candidates = [c for c in candidates if c]

    for candidate in candidates:
        orders = resolve_orders(candidate)
        if orders.exists():
            return orders, candidate

    for candidate in candidates:
        txn = find_transaction(gateway_reference=candidate)
        reference = merchant_reference(txn.idempotency_key) if txn else ''
        if reference:
            orders = resolve_orders(reference)
            if orders.exists():
                return orders, reference

    return Order.objects.none(), ''
