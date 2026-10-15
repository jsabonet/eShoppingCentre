"""Tarefas Celery do app de pagamentos."""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def reconcile_pending_payments():
    """Fecha os pagamentos que o webhook não trouxe.

    Rede de segurança do elo de pagamento: um webhook que se perde deixaria a
    encomenda pendente para sempre, com o comprador já cobrado. Esta tarefa
    pergunta ao gateway o estado real dos checkouts pendentes e fecha os que já
    foram pagos (ou marca como falhados os que o gateway recusa).
    """
    from apps.payments.services.reconciliation import reconcile_stale_payments

    summary = reconcile_stale_payments()

    if summary['error']:
        logger.warning('Reconciliação de pagamentos não correu: %s', summary['error'])
        return f"Reconciliação ignorada: {summary['error']}"

    message = (
        f"{summary['checked']} verificado(s) de {summary['candidates']} candidato(s): "
        f"{summary['completed']} pago(s) fechado(s), {summary['failed']} falhado(s), "
        f"{summary['pending']} ainda pendente(s), {summary['errors']} erro(s)."
    )
    if summary['orders_completed']:
        message += f" Encomendas fechadas: {', '.join(summary['orders_completed'])}."
    if summary['too_old']:
        message += f" {summary['too_old']} fora do prazo (revisão manual necessária)."

    logger.info('Reconciliação de pagamentos: %s', message)
    return message
