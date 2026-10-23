"""Cliente VPay para criação e consulta de pedidos e validação de webhooks."""
import hashlib
import hmac
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class VPayClient:
    def __init__(self, base_url=None, client_id=None, client_secret=None,
                 webhook_secret=None):
        self.base_url = (base_url or settings.VPAY_BASE_URL).rstrip('/')
        self.client_id = client_id if client_id is not None else settings.VPAY_CLIENT_ID
        self.client_secret = (
            client_secret if client_secret is not None else settings.VPAY_CLIENT_SECRET
        )
        self.webhook_secret = (
            webhook_secret if webhook_secret is not None else settings.VPAY_WEBHOOK_SECRET
        )
        self.timeout = settings.VPAY_TIMEOUT
        cache_identity = hashlib.sha256(
            f'{self.base_url}:{self.client_id}:{self.client_secret}'.encode()
        ).hexdigest()
        self.token_cache_key = f'vpay:access-token:{cache_identity}'
        self.session = requests.Session()
        retries = Retry(
            total=settings.VPAY_RETRY_TOTAL,
            backoff_factor=settings.VPAY_RETRY_BACKOFF,
            status_forcelist=[502, 503, 504],
            allowed_methods=['GET', 'HEAD', 'OPTIONS'],
        )
        self.session.mount('https://', HTTPAdapter(max_retries=retries))
        self.session.headers.update({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        })

    def create_order(self, payload):
        token_result = self._get_access_token()
        if not token_result['ok']:
            return token_result

        try:
            response = self.session.post(
                f'{self.base_url}/v1/orders',
                json=payload,
                headers={'Authorization': f"Bearer {token_result['data']}"},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('VPay create_order request failed: %s', exc)
            return self._failure('Não foi possível contactar a VPay.')

        body = self._json_or_empty(response)
        if (response.ok and isinstance(body, dict)
                and body.get('orderId')
                and (body.get('success') is True or body.get('status'))):
            return {
                'ok': True,
                'data': body,
                'message': None,
                'http_status': response.status_code,
            }

        logger.error('VPay create_order failed with HTTP %s', response.status_code)
        return self._failure(
            body.get('message') if isinstance(body, dict) else None,
            response.status_code,
            body,
        )

    def get_order_status(self, order_id):
        token_result = self._get_access_token()
        if not token_result['ok']:
            return token_result

        try:
            response = self.session.get(
                f'{self.base_url}/v1/orders/{order_id}/status',
                headers={'Authorization': f"Bearer {token_result['data']}"},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('VPay get_order_status request failed: %s', exc)
            return self._failure('Não foi possível consultar a VPay.')

        body = self._json_or_empty(response)
        order_data = body.get('data') if isinstance(body.get('data'), dict) else None
        if response.ok and body.get('success') is True and order_data:
            return {
                'ok': True,
                'data': order_data,
                'message': None,
                'http_status': response.status_code,
            }

        logger.error('VPay get_order_status failed with HTTP %s', response.status_code)
        return self._failure(
            body.get('message') if isinstance(body, dict) else None,
            response.status_code,
            body,
        )

    def _get_access_token(self):
        cached_token = cache.get(self.token_cache_key)
        if cached_token:
            return {'ok': True, 'data': cached_token, 'message': None, 'http_status': 200}

        if not self.client_id or not self.client_secret:
            logger.error('VPay credentials are not configured.')
            return self._failure('Credenciais VPay não configuradas.')

        try:
            response = self.session.post(
                f'{self.base_url}/v1/auth/token',
                json={
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                },
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.error('VPay authentication request failed: %s', exc)
            return self._failure('Não foi possível autenticar na VPay.')

        body = self._json_or_empty(response)
        token_data = body.get('data') if isinstance(body.get('data'), dict) else body
        access_token = token_data.get('access_token') if isinstance(token_data, dict) else None
        if response.ok and access_token:
            cache.set(self.token_cache_key, access_token, timeout=50 * 60)
            return {
                'ok': True,
                'data': access_token,
                'message': None,
                'http_status': response.status_code,
            }

        logger.error('VPay authentication failed with HTTP %s', response.status_code)
        return self._failure(
            body.get('message') if isinstance(body, dict) else None,
            response.status_code,
            body,
        )

    def verify_signature(self, payload_body, signature):
        if not self.webhook_secret or not signature.startswith('sha256='):
            return False
        digest = signature[len('sha256='):]
        if len(digest) != 64:
            return False
        try:
            bytes.fromhex(digest)
        except ValueError:
            return False
        expected = hmac.new(
            self.webhook_secret.encode(),
            payload_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, digest.lower())

    @staticmethod
    def _json_or_empty(response):
        try:
            body = response.json()
        except ValueError:
            return {}
        return body if isinstance(body, dict) else {}

    @staticmethod
    def _failure(message, http_status=None, data=None):
        return {
            'ok': False,
            'data': data,
            'message': message or 'A VPay recusou o pedido.',
            'http_status': http_status,
        }
