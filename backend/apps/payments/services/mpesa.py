import requests
from decouple import config
from .base import BasePaymentService


class MPesaService(BasePaymentService):
    BASE_URL = config('MPESA_BASE_URL', default='https://api.vodacom.co.mz')
    API_KEY = config('MPESA_API_KEY', default='')
    PUBLIC_KEY = config('MPESA_PUBLIC_KEY', default='')
    SERVICE_PROVIDER_CODE = config('MPESA_SP_CODE', default='')

    def initiate_payment(self, order) -> dict:
        payload = {
            'input_ServiceProviderCode': self.SERVICE_PROVIDER_CODE,
            'input_TransactionReference': order.order_number,
            'input_Amount': str(order.total),
            'input_ThirdPartyReference': str(order.id),
            'input_CustomerMSISDN': order.buyer.phone,
        }
        try:
            response = requests.post(
                f'{self.BASE_URL}/ipg/v1/c2bPayment/singleStage/',
                json=payload,
                headers={'Authorization': f'Bearer {self.API_KEY}'},
                timeout=30,
            )
            return {
                'redirect_url': None,
                'status': 'pending',
                'provider_ref': response.json().get('output_ResponseCode', ''),
            }
        except Exception as e:
            return {'redirect_url': None, 'status': 'failed', 'error': str(e)}

    def process_callback(self, data: dict) -> bool:
        return data.get('output_ResponseCode') == 'INS-0'

    def verify_payment(self, transaction_id: str) -> bool:
        return True
