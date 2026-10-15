"""Cliente ZumboPay — gateway de pagamentos (M-Pesa, e-Mola, mKesh, cartões).

Contrato oficial: https://zumbopay.com/documentacao

  - Base URL: ``https://zumbopay.com/api/public/v1``
  - Autenticação: ``Authorization: Bearer <api key>`` + ``X-Merchant-Id``
  - Criar link de pagamento: ``POST /payments`` → ``checkout_url``
  - Consultar estado: ``GET /payments/<reference-ou-slug>``
  - Diagnóstico: ``GET /merchant/validate``
  - Webhook: cabeçalho ``x-zumbopay-signature`` = HMAC-SHA256 (hex) do corpo
    bruto, assinado com o webhook secret.

Quatro particularidades do contrato que condicionam a integração:

  * ``wallet_id`` é **obrigatório** no pedido de pagamento. Sem ele o gateway
    responde ``400 invalid_input``. Existe uma carteira por método.
  * O ``reference`` é **gerado pelo gateway** (``ZP…``) — a API não aceita uma
    referência do comerciante, pelo que o mapeamento encomenda↔pagamento tem de
    ser persistido localmente no ``initiate`` e reconstruído no webhook.
  * A URL do webhook **não vai no pedido**: é registada no Painel ZumboPay.
  * Os erros usam o envelope ``{"error": {"code", "message"}}``, e não o
    ``{"status": "success"}`` usado por outros gateways.
"""
import hashlib
import hmac
import logging
from decimal import Decimal

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

#: Canais suportados pelo gateway. ``mkesh`` só fica disponível quando a
#: respectiva carteira estiver configurada.
SUPPORTED_CHANNELS = ('mpesa', 'emola', 'card', 'mkesh')


class ZumbopayClient:
    """Cliente HTTP para a API pública do ZumboPay."""

    def __init__(self, base_url=None, api_key=None, merchant_id=None,
                 webhook_secret=None, wallets=None):
        self.base_url = (base_url or settings.ZUMBOPAY_BASE_URL).rstrip('/')
        self.api_key = api_key or settings.ZUMBOPAY_API_KEY
        self.merchant_id = merchant_id or settings.ZUMBOPAY_MERCHANT_ID
        self.webhook_secret = webhook_secret or settings.ZUMBOPAY_WEBHOOK_SECRET
        self.wallets = self._settings_wallets() if wallets is None else wallets
        self.timeout = settings.ZUMBOPAY_TIMEOUT

        self.session = requests.Session()
        # Retry apenas em métodos idempotentes: repetir um POST às cegas
        # arriscaria cobrar duas vezes. A idempotência de escrita é garantida
        # pelo cabeçalho `Idempotency-Key`.
        retries = Retry(
            total=settings.ZUMBOPAY_RETRY_TOTAL,
            backoff_factor=settings.ZUMBOPAY_RETRY_BACKOFF,
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
        if self.merchant_id:
            self.session.headers.update({'X-Merchant-Id': self.merchant_id})

    # ─── Configuração ───

    @staticmethod
    def _settings_wallets():
        return {
            'mpesa': settings.ZUMBOPAY_WALLET_MPESA,
            'emola': settings.ZUMBOPAY_WALLET_EMOLA,
            'card': settings.ZUMBOPAY_WALLET_CARD,
            'mkesh': settings.ZUMBOPAY_WALLET_MKESH,
        }

    def resolve_wallet_id(self, method):
        """``wallet_id`` da carteira do método indicado. Devolve ``''`` se não configurada."""
        return self.wallets.get(method or '', '')

    def available_channels(self):
        """Canais com carteira configurada, pela ordem de ``SUPPORTED_CHANNELS``."""
        return [c for c in SUPPORTED_CHANNELS if self.wallets.get(c)]

    # ─── Cobrança ───

    def create_payment(self, *, amount, reference, title=None, description=None,
                       method=None, channels=None, max_uses=1):
        """Cria um link de pagamento e devolve a ``checkout_url`` hospedada.

        Retorna um dicionário normalizado ``{ok, data, message, http_status}``.
        Em caso de sucesso, ``data`` inclui ``reference`` (gerada pelo gateway),
        ``slug``, ``status`` e ``checkout_url``.

        ``reference`` é a referência do comerciante e serve apenas para o
        cabeçalho de idempotência — o gateway devolve a sua própria.
        """
        if channels is None:
            channels = [method] if method else self.available_channels()
        channels = [c for c in channels if c]

        if not channels:
            return self._fail('Nenhum canal de pagamento disponível.')

        wallet_id = self.resolve_wallet_id(channels[0])
        if not wallet_id:
            return self._fail(
                f'A carteira do método «{channels[0]}» não está configurada no gateway.'
            )

        payload = {
            'title': (title or 'Pagamento e-Shopping Centre')[:120],
            'amount': self._amount(amount),
            'currency': 'MZN',
            'channels': channels,
            'wallet_id': wallet_id,
            'max_uses': max_uses,
        }
        if description:
            payload['description'] = description[:255]

        request_kwargs = {'json': payload, 'timeout': self.timeout}
        if reference:
            request_kwargs['headers'] = {'Idempotency-Key': str(reference)[:120]}

        try:
            resp = self.session.post(f'{self.base_url}/payments', **request_kwargs)
        except requests.RequestException as exc:
            logger.error('ZumboPay create_payment request failed: %s', exc)
            return self._fail(str(exc))

        body = self._json_or_empty(resp)
        if resp.status_code in (200, 201) and body.get('data'):
            return {'ok': True, 'data': body['data'], 'message': None,
                    'http_status': resp.status_code}

        logger.error('ZumboPay create_payment error %s: %s', resp.status_code, body)
        return self._fail(
            self._error_message(body) or 'Erro ao criar pagamento.',
            http_status=resp.status_code,
        )

    def get_payment(self, reference):
        """Consulta o estado de um pagamento por referência ou slug."""
        try:
            resp = self.session.get(
                f'{self.base_url}/payments/{reference}', timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('ZumboPay get_payment request failed: %s', exc)
            return self._fail(str(exc))

        body = self._json_or_empty(resp)
        if resp.status_code == 200 and body.get('data'):
            return {'ok': True, 'data': body['data'], 'message': None,
                    'http_status': resp.status_code}

        logger.error('ZumboPay get_payment error %s: %s', resp.status_code, body)
        return self._fail(
            self._error_message(body) or 'Erro ao consultar pagamento.',
            http_status=resp.status_code,
        )

    # ─── Diagnóstico ───

    def validate_merchant(self):
        """``GET /merchant/validate`` — prontidão da conta para cobrar.

        Devolve ``ready``, ``missing[]`` (o que falta configurar), ``merchant``,
        ``wallets`` por método e o ``webhook`` registado.
        """
        try:
            resp = self.session.get(
                f'{self.base_url}/merchant/validate', timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('ZumboPay validate_merchant request failed: %s', exc)
            return self._fail(str(exc))

        body = self._json_or_empty(resp)
        if resp.status_code == 200:
            return {'ok': True, 'data': body.get('data') or body, 'message': None,
                    'http_status': resp.status_code}

        logger.error('ZumboPay validate_merchant error %s: %s', resp.status_code, body)
        return self._fail(
            self._error_message(body) or 'Erro ao validar as credenciais do gateway.',
            http_status=resp.status_code,
        )

    # ─── Webhook ───

    def verify_signature(self, payload_body, signature):
        """Valida ``x-zumbopay-signature``: HMAC-SHA256 (hex) do corpo bruto."""
        if not self.webhook_secret or not signature:
            return False
        expected = hmac.new(
            self.webhook_secret.encode(),
            payload_body.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature.strip().lower())

    # ─── Auxiliares ───

    @staticmethod
    def _amount(amount):
        """Converte para a unidade principal (número JSON) com 2 decimais."""
        return float(Decimal(str(amount)).quantize(Decimal('0.01')))

    @staticmethod
    def _fail(message, http_status=None):
        return {'ok': False, 'data': None, 'message': message, 'http_status': http_status}

    @staticmethod
    def _error_message(body):
        """Extrai a mensagem do envelope de erro ``{"error": {code, message}}``."""
        error = body.get('error')
        if isinstance(error, dict):
            return error.get('message') or error.get('code') or ''
        if isinstance(error, str):
            return error
        return body.get('message') or ''

    @staticmethod
    def _json_or_empty(resp):
        try:
            return resp.json() if resp.text else {}
        except ValueError:
            return {}
