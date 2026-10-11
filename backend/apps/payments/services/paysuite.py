"""Cliente PaySuite — gateway único de pagamentos (mPesa, e-Mola, Mkesh, cartões).

Contrato oficial: https://paysuite.tech/docs/

  - Base URL: ``https://paysuite.tech/api``
  - Autenticação: ``Authorization: Bearer {API_TOKEN}``
  - Criar pagamento: ``POST /v1/payments``
  - Consultar estado: ``GET /v1/payments/{id}``
  - Webhook: cabeçalho ``X-Signature`` = HMAC-SHA256 (hex) do corpo bruto,
    assinado com o segredo do webhook.
"""
import hashlib
import hmac
import logging

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class PaysuiteClient:
    """Cliente HTTP para a API PaySuite."""

    def __init__(self, base_url=None, api_key=None, webhook_secret=None):
        self.base_url = (base_url or settings.PAYSUITE_BASE_URL).rstrip('/')
        self.api_key = api_key or settings.PAYSUITE_API_KEY
        self.webhook_secret = webhook_secret or settings.PAYSUITE_WEBHOOK_SECRET
        self.timeout = settings.PAYSUITE_TIMEOUT

        self.session = requests.Session()
        retries = Retry(
            total=settings.PAYSUITE_RETRY_TOTAL,
            backoff_factor=settings.PAYSUITE_RETRY_BACKOFF,
            status_forcelist=[502, 503, 504],
            allowed_methods=['GET', 'HEAD', 'OPTIONS'],
        )
        self.session.mount('https://', HTTPAdapter(max_retries=retries))
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        })
        if self.api_key:
            self.session.headers.update({'Authorization': f'Bearer {self.api_key}'})

    def create_payment(self, *, amount, reference, description=None,
                       return_url=None, webhook_url=None, method=None,
                       contact_id=None):
        """Cria um pagamento e devolve a ``checkout_url`` hospedada.

        Retorna um dicionário normalizado:
        ``{ok, data, message, http_status}``.
        """
        payload = {
            'amount': str(amount),
            'reference': reference,
        }
        if description:
            payload['description'] = description
        if return_url:
            payload['return_url'] = return_url
        if webhook_url:
            payload['webhook_url'] = webhook_url
        if method:
            payload['method'] = method
        if contact_id:
            payload['contact_id'] = contact_id

        try:
            resp = self.session.post(
                f'{self.base_url}/v1/payments',
                json=payload,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('PaySuite create_payment request failed: %s', exc)
            return {'ok': False, 'data': None, 'message': str(exc), 'http_status': None}

        body = self._json_or_empty(resp)
        if resp.status_code == 201 and body.get('status') == 'success':
            return {'ok': True, 'data': body.get('data'), 'message': None, 'http_status': resp.status_code}

        logger.error('PaySuite create_payment error %s: %s', resp.status_code, body)
        return {'ok': False, 'data': None, 'message': body.get('message', 'Erro ao criar pagamento'), 'http_status': resp.status_code}

    def get_payment(self, payment_id):
        """Consulta o estado de um pagamento por id do gateway."""
        try:
            resp = self.session.get(
                f'{self.base_url}/v1/payments/{payment_id}',
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('PaySuite get_payment request failed: %s', exc)
            return {'ok': False, 'data': None, 'message': str(exc), 'http_status': None}

        body = self._json_or_empty(resp)
        if resp.status_code == 200 and body.get('status') == 'success':
            return {'ok': True, 'data': body.get('data'), 'message': None, 'http_status': resp.status_code}

        logger.error('PaySuite get_payment error %s: %s', resp.status_code, body)
        return {'ok': False, 'data': None, 'message': body.get('message', 'Erro ao consultar pagamento'), 'http_status': resp.status_code}

    def verify_signature(self, payload_body, signature):
        """Valida a assinatura HMAC-SHA256 do webhook.

        Suporta o formato simples (hex) documentado pela PaySuite e o formato
        estilo Stripe ``t=<ts>,v1=<hex>`` usado por algumas versões do gateway.
        """
        if not self.webhook_secret or not signature:
            return False
        if signature.startswith('t='):
            parts = dict(p.split('=', 1) for p in signature.split(',') if '=' in p)
            signature = parts.get('v1', '')
        expected = hmac.new(
            self.webhook_secret.encode(),
            payload_body.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def _json_or_empty(resp):
        try:
            return resp.json() if resp.text else {}
        except ValueError:
            return {}
