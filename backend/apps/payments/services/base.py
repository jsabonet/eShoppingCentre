from abc import ABC, abstractmethod


class BasePaymentService(ABC):
    @abstractmethod
    def initiate_payment(self, order) -> dict:
        pass

    @abstractmethod
    def process_callback(self, data: dict) -> bool:
        pass

    @abstractmethod
    def verify_payment(self, transaction_id: str) -> bool:
        pass
