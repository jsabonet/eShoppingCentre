import stripe
from decouple import config
from .base import BasePaymentService


class StripeService(BasePaymentService):
    def __init__(self):
        stripe.api_key = config('STRIPE_SECRET_KEY', default='')

    def initiate_payment(self, order) -> dict:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'mzn',
                    'product_data': {'name': f'Pedido {order.order_number}'},
                    'unit_amount': int(order.total * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{config("FRONTEND_URL", default="http://localhost:3000")}/checkout/success?order={order.id}',
            cancel_url=f'{config("FRONTEND_URL", default="http://localhost:3000")}/checkout/cancel?order={order.id}',
            metadata={'order_id': str(order.id)},
        )
        return {'redirect_url': session.url, 'status': 'pending'}

    def process_callback(self, data: dict) -> bool:
        event = stripe.Webhook.construct_event(
            data.get('payload', ''),
            data.get('signature', ''),
            config('STRIPE_WEBHOOK_SECRET', default=''),
        )
        return event.type == 'checkout.session.completed'

    def verify_payment(self, transaction_id: str) -> bool:
        session = stripe.checkout.Session.retrieve(transaction_id)
        return session.payment_status == 'paid'
