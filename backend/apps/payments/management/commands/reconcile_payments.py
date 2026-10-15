"""Reconciliação manual de pagamentos ZumboPay.

Pergunta ao gateway o estado real das encomendas pendentes e fecha as que já
foram pagas. Serve de alternativa ao Celery beat (por exemplo em ambientes sem
Redis) e de apoio quando um webhook se perdeu.

Uso:
    python manage.py reconcile_payments              # lote pendente (regras do .env)
    python manage.py reconcile_payments --all        # inclui pendentes recentes
    python manage.py reconcile_payments --reference PED-2601-0001
    python manage.py reconcile_payments --order 1e4b...   # ID ou numero da encomenda
    python manage.py reconcile_payments --limit 5    # tamanho do lote

Nota: a saída usa apenas ASCII — a consola padrão do Windows (cp1252) rebenta com
emoji, o que deixaria a ferramenta inutilizável exactamente quando é precisa.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Reconcilia pagamentos pendentes junto do gateway ZumboPay'

    def add_arguments(self, parser):
        parser.add_argument('--reference', help='Referencia do checkout (Order.payment_id)')
        parser.add_argument('--order', help='ID ou numero da encomenda')
        parser.add_argument('--all', action='store_true',
                            help='Nao respeita a idade minima (inclui pendentes recentes)')
        parser.add_argument('--limit', type=int, help='Maximo de referencias por lote')
        parser.add_argument('--min-age', type=int, dest='min_age',
                            help='Idade minima em minutos (defeito: ZUMBOPAY_RECONCILE_MIN_AGE_MINUTES)')
        parser.add_argument('--max-age', type=int, dest='max_age',
                            help='Idade maxima em horas (defeito: ZUMBOPAY_RECONCILE_MAX_AGE_HOURS)')

    def handle(self, *args, **options):
        from apps.payments.services.reconciliation import (
            reconcile_checkout,
            reconcile_stale_payments,
        )

        reference = (options.get('reference') or '').strip()
        order_key = (options.get('order') or '').strip()

        if reference or order_key:
            self._single(reference, order_key, reconcile_checkout)
            return

        min_age = 0 if options['all'] else options.get('min_age')
        summary = reconcile_stale_payments(
            min_age_minutes=min_age,
            max_age_hours=options.get('max_age'),
            limit=options.get('limit'),
        )

        if summary['error']:
            self.stdout.write(self.style.ERROR(f'ERRO: {summary["error"]}'))
            return

        self.stdout.write(
            f"Candidatos: {summary['candidates']} | verificados: {summary['checked']} | "
            f"pagos: {summary['completed']} | falhados: {summary['failed']} | "
            f"pendentes: {summary['pending']} | erros: {summary['errors']}"
        )
        if summary['orders_completed']:
            self.stdout.write(self.style.SUCCESS(
                f"[OK] Encomendas fechadas: {', '.join(summary['orders_completed'])}"
            ))
        if summary['orders_failed']:
            self.stdout.write(self.style.WARNING(
                f"[!] Marcadas como falhadas: {', '.join(summary['orders_failed'])}"
            ))
        if summary['too_old']:
            self.stdout.write(self.style.WARNING(
                f"[!] {summary['too_old']} fora do prazo — revisao manual necessaria"
            ))

    def _single(self, reference, order_key, reconcile_checkout):
        from apps.orders.models import Order
        from apps.payments.services.references import (
            find_transaction_for_order,
            merchant_reference,
        )

        if not reference:
            order = Order.objects.filter(order_number=order_key).first()
            if order is None:
                try:
                    order = Order.objects.filter(pk=order_key).first()
                except (ValueError, TypeError):
                    order = None
            if order is None:
                self.stdout.write(self.style.ERROR('ERRO: encomenda nao encontrada.'))
                return
            reference = order.payment_id
            if not reference:
                txn = find_transaction_for_order(order)
                reference = merchant_reference(txn.idempotency_key) if txn else ''
            if not reference:
                self.stdout.write(self.style.ERROR(
                    'ERRO: esta encomenda nao tem nenhum pagamento online iniciado.'
                ))
                return

        self.stdout.write(f'A verificar "{reference}" junto do gateway...')
        result = reconcile_checkout(reference)

        if result['error']:
            self.stdout.write(self.style.ERROR(f'ERRO: {result["error"]}'))
            return

        if result['checked']:
            self.stdout.write(
                f"   Gateway: referencia {result['gateway_reference'] or '-'} | "
                f"estado \"{result['gateway_status'] or '-'}\" -> {result['status']}"
            )
        if result['completed']:
            self.stdout.write(self.style.SUCCESS(
                f"[OK] Pagamento confirmado em {timezone.now():%d/%m/%Y %H:%M} — "
                f"encomendas: {', '.join(result['completed'])}"
            ))
        elif result['failed']:
            self.stdout.write(self.style.WARNING(
                f"[!] Gateway reporta falha — encomendas: {', '.join(result['failed'])}"
            ))
        else:
            self.stdout.write('Ainda pendente no gateway; nada foi alterado.')
