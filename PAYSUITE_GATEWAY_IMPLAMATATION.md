# Mapeamento Completo — Gateway de Pagamento PaySuite (MutitPay)

> Documento de referência para replicar/adaptar a integração com o **PaySuite** em outro
> pagamento **sem erros nem atrasos**. Todo o fluxo foi extraído do código real do projeto.
>
> **Escopo**: backend Django (DRF) + frontend React (Vite) + PaySuite (M-Pesa / e-Mola / Cartão / Transferência).
> **Moeda**: MZN (Metical Moçambicano).
> **Idioma do projeto**: Português (mensagens de UI em PT).

---

## 1. Visão geral do fluxo (arquitetura)

```
┌─────────────┐  1. POST /api/cart/payments/initiate/   ┌──────────────────────┐  2. POST /v1/payments  ┌────────────┐
│  Frontend   │ ──────────────────────────────────────▶ │   Django (views.py)  │ ─────────────────────▶ │  PaySuite  │
│  (React)    │                                          │   PaysuiteClient     │                        │   Gateway  │
└─────────────┘                                          └──────────────────────┘                        └────────────┘
      ▲                                                            │                                            │
      │ 5. poll GET /api/cart/payments/status/{id}/                │ 3. webhook POST /api/cart/payments/webhook/ │
      │    (a cada 3s)                                            ▼                                            │
      │                                                 ┌──────────────────────┐ ◀──────────────────────────────┘
      └───────────────────────────────────────────────── │ paysuite_webhook()   │ 4. callback assíncrono
                                                        │ payment_status()      │
                                                        └──────────────────────┘
```

**Regra de ouro do design**: **o `Order` (pedido) SÓ é criado depois que o pagamento é confirmado como `paid`**.
No momento de iniciar o pagamento é criado apenas um registro `Payment` vinculado ao `Cart`.
Isso evita pedidos "fantasma" (cliente que abre o checkout e não paga).

Sequência real:

1. O usuário preenche o checkout e escolhe o método (`mpesa`, `emola`, `card` ou `transfer`).
2. O frontend chama `POST /api/cart/payments/initiate/` **sem** enviar `amount`/`shipping_amount`
   (o servidor recalcula os totais — nunca confia nos totais do cliente).
3. O backend resolve/merge o carrinho, recalcula preços, cria um `Payment` com
   `status='initiated'` e `order=None`, monta o payload e chama o PaySuite.
4. O backend guarda `paysuite_reference` (o `id` devolvido pelo PaySuite), marca o
   `Payment` como `pending` e devolve `{ payment_id, payment: {...} }`.
5. O frontend navega para a página de confirmação e faz **polling** a cada 3 s até 2 min.
   - Em paralelo, o backend também faz **polling ativo** ao PaySuite (fallback de webhook).
6. O PaySuite envia o webhook (ou o polling detecta o resultado). Quando `paid`:
   - cria o `Order` + `OrderItem`s (snapshot),
   - reduz o stock (`OrderManager.update_order_status`),
   - limpa o carrinho,
   - envia emails de confirmação (cliente + admin).
7. Se falhar/expirar: marca `failed`, envia email de falha e **preserva o carrinho**.

---

## 2. Inventário de arquivos envolvidos

### Backend (Django)

| Caminho | Papel |
|---|---|
| `backend/chiva_backend/settings.py` | Carrega config PaySuite via `python-decouple` (env vars) |
| `backend/cart/views.py` | Views principais: `initiate_payment`, `paysuite_webhook`, `payment_status` |
| `backend/cart/urls.py` | Rotas de pagamento |
| `backend/cart/models.py` | Modelos `Payment`, `Order`, `OrderItem` |
| `backend/cart/serializers.py` | `PaymentSerializer`, `OrderSerializer`, `OrderItemSerializer` |
| `backend/cart/payments/paysuite.py` | **Cliente principal** `PaysuiteClient` (create/verify/status) |
| `backend/cart/payments/safe_paysuite.py` | `SafePaysuiteClient` (mock/sandbox, usado em testes) |
| `backend/cart/payments/paysuite_config.py` | `PaySuiteConfig` (payloads experimentais de teste) |
| `backend/cart/utils/phone_validation.py` | Validação/formação de telefone moçambicano + carrier→método |
| `backend/cart/utils/paysuite_diagnostics.py` | Diagnóstico de conta/config PaySuite |
| `backend/cart/migrations/0002_order_payment.py` | Migração que cria `Order` e `Payment` |
| `backend/cart/management/commands/poll_pending_payments.py` | Fallback manual de polling (atualmente stub) |
| `backend/cart/management/commands/paysuite_diagnostics.py` | Comando `manage.py paysuite_diagnostics` |
| `backend/cart/management/commands/test_paysuite.py` | Comando de teste de integração |
| `backend/cart/management/commands/test_paysuite_safe.py` | Comando de teste do client "safe" |
| `backend/cart/management/commands/test_ecommerce_completo.py` | Teste E2E do e-commerce |
| `backend/cart/stock_management.py` | `OrderManager.update_order_status` (reduz stock em `paid`) |
| `backend/cart/email_service.py` | Envio de emails transacionais (confirmação/falha/admin) |
| `.env.example` | Variáveis de ambiente esperadas |

### Frontend (React)

| Caminho | Papel |
|---|---|
| `frontend/src/hooks/usePayments.ts` | Hook: `initiatePayment()` e `fetchPaymentStatus()` |
| `frontend/src/pages/Checkout.tsx` | Página de checkout |
| `frontend/src/pages/CheckoutDetails.tsx` | Detalhes do checkout + envio do pagamento |
| `frontend/src/pages/OrderConfirmation.tsx` | Página de confirmação + **polling** de status |

---

## 3. Configuração / Variáveis de ambiente

Todas carregadas em `settings.py` via `python-decouple` (`config(...)`).

| Variável | Default | Uso |
|---|---|---|
| `PAYSUITE_BASE_URL` | `https://api.paysuite.co.mz` | URL base da API PaySuite (produção) |
| `PAYSUITE_API_KEY` | `''` (vazio) | Token de autenticação (enviado como Bearer) |
| `PAYSUITE_API_SECRET` | `''` (vazio) | Segredo legado (mantido por compatibilidade) |
| `PAYSUITE_WEBHOOK_SECRET` | `''` (vazio) | Segredo HMAC-SHA256 para validar assinatura do webhook (preferido) |
| `WEBHOOK_BASE_URL` | `http://127.0.0.1:8000` | URL pública base para montar `callback_url`/`return_url` (necessário em produção, ex.: ngrok/domínio) |
| `PAYSUITE_TEST_MODE` | `production` (em views) | `production` \| `mock` \| `sandbox` \| `development` \| flags de teste (`clean`, `direct_v1`, etc.) |
| `PAYSUITE_SANDBOX_URL` | `https://sandbox.paysuite.co.mz/api` | URL do ambiente sandbox (usado pelo `SafePaysuiteClient`) |
| `PAYSUITE_SANDBOX_API_KEY` | — | Chave do sandbox |
| `PAYSUITE_TIMEOUT` | `15` | Timeout (segundos) das chamadas HTTP |
| `PAYSUITE_RETRY_TOTAL` | `2` | Nº de retries (somente GET/HEAD/OPTIONS) |
| `PAYSUITE_RETRY_BACKOFF` | `0.5` | Backoff dos retries |
| `EMOLA_MAX_AMOUNT` | `100000` | Limite máximo (MZN) para método `emola` |
| `MAX_TEST_AMOUNT` / `MIN_TEST_AMOUNT` | `50.00` / `1.00` | Limites de valor no `SafePaysuiteClient` |
| `CART_CLEAR_ON_INITIATE` | `0` | Se `1/true/yes`, limpa o carrinho logo após iniciar pagamento |

> ⚠️ **GOTCHA — URLs divergentes no código**: existem **três** defaults diferentes de `base_url`:
> - `paysuite.py` (cliente): `https://paysuite.tech/api`
> - `settings.py`: `https://api.paysuite.co.mz`
> - `safe_paysuite.py` (sandbox): `https://sandbox.paysuite.co.mz/api`
>
> Nas views (`initiate_payment` e `payment_status`) o cliente é instanciado com
> `base_url=settings.PAYSUITE_BASE_URL`, então **o `settings.py` manda** em produção.
> Já a view `paysuite_webhook` cria `PaysuiteClient()` **sem** argumentos, portanto usa
> `os.getenv('PAYSUITE_BASE_URL')`/`os.getenv('PAYSUITE_API_KEY')` diretamente.
> **Ao replicar, mantenha `settings.PAYSUITE_*` e as env vars sincronizadas** para que
> webhook e polling usem as mesmas credenciais.

---

## 4. Modelos de dados relevantes

### 4.1 `Payment` (`backend/cart/models.py`)

```python
class Payment(models.Model):
    METHOD_CHOICES = [('mpesa', 'M-Pesa'), ('emola', 'e-mola')]  # (card/transfer tratados na view)
    STATUS_CHOICES = [
        ('initiated', 'Iniciado'),
        ('pending', 'Pendente'),
        ('paid', 'Pago'),
        ('failed', 'Falhou'),
    ]

    order              = FK(Order, null=True, blank=True)   # criado SÓ após "paid"
    cart               = FK(Cart, null=True, blank=True)    # carrinho usado no pagamento
    method             = CharField(max_length=30)
    amount             = DecimalField(max_digits=10, decimal_places=2)
    currency           = CharField(default='MZN')
    paysuite_reference = CharField(max_length=255, null=True, blank=True)  # id/reference do gateway
    status             = CharField(default='initiated')
    raw_response       = JSONField(default=dict)            # resposta bruta do gateway (para debug)
    request_data       = JSONField(default=dict)            # payload original p/ recriar Order no webhook
    poll_count         = IntegerField(default=0)            # contagem de polls (timeout lógico)
    last_polled_at     = DateTimeField(null=True, blank=True)
    created_at / updated_at
```

**Campos críticos para replicar**:
- `paysuite_reference`: é o elo de ligação webhook ↔ registro. Recebe `data.id` (ou `data.reference`) retornado pelo PaySuite.
- `request_data`: armazena `shipping_address`, `billing_address`, `shipping_method`, `customer_notes`, `shipping_cost`, `items` (snapshot dos itens) e `meta`. É **essencial** porque o `Order` só é criado no webhook/polling, usando exatamente este snapshot.
- `poll_count` + `last_polled_at`: usados na lógica de timeout.

### 4.2 `Order` (`backend/cart/models.py`)

Campos relevantes: `cart`, `user`, `order_number` (autogerado `CHV{YYYYMMDD}{seq:04d}`),
`total_amount`, `shipping_cost`, `status`, `shipping_method`, `shipping_address` (JSON),
`billing_address` (JSON), `customer_notes`, `tracking_number`, etc.

`STATUS_CHOICES` inclui `pending`, `confirmed`, `processing`, `shipped`, `delivered`,
`cancelled`, `refunded`, **`paid`** e **`failed`** (os dois últimos por compatibilidade com o fluxo de pagamento).

### 4.3 `OrderItem` (`backend/cart/models.py`)

Snapshot do item no momento do pagamento: `product`, `product_name`, `sku`, `product_image`,
`color/color_name/color_hex`, `size/size_name/size_abbreviation`, `quantity`, `unit_price`,
`subtotal` (auto-calculado em `save()`), `weight`, `dimensions`.

---

## 5. Cliente PaySuite — `PaysuiteClient`

Arquivo: `backend/cart/payments/paysuite.py`.

### 5.1 Inicialização

```python
client = PaysuiteClient(
    base_url=settings.PAYSUITE_BASE_URL,      # ex.: https://api.paysuite.co.mz
    api_key=settings.PAYSUITE_API_KEY,
    webhook_secret=settings.PAYSUITE_WEBHOOK_SECRET
)
```

- Cria `requests.Session()`.
- **Header de autenticação**: `Authorization: Bearer <PAYSUITE_API_KEY>`.
- **Header padrão**: `Content-Type: application/json`.
- Retries configurados (`Retry` de `urllib3`): somente `GET/HEAD/OPTIONS`,
  `status_forcelist=[502,503,504]` (POST não é retentado por não ser idempotente).

> ⚠️ O header é montado como `f'Bearer {self.api_key}'`. Se `api_key` estiver vazio,
> o header **não** é enviado (condição `if self.api_key:`).

### 5.2 `create_payment(...)` — criar pagamento

**Endpoint**: `POST {base_url}/v1/payments`

**Assinatura** (keyword-only):

```python
create_payment(*, amount, method=None, reference, description=None,
               return_url=None, callback_url=None, msisdn=None,
               direct_payment=False, **kwargs) -> dict
```

**Payload JSON enviado**:

```json
{
  "amount": 123.45,          // float, em MZN (obrigatório)
  "reference": "PAY000123",  // string (obrigatório, ≤ 50 chars)
  "method": "mpesa",         // opcional: credit_card | mpesa | emola
  "description": "...",      // opcional
  "return_url": "...",       // opcional (removido p/ pagamento móvel direto)
  "callback_url": "...",     // opcional (URL do webhook)
  "msisdn": "258840000000",  // opcional (apenas mpesa/emola)
  // ... quaisquer kwargs não-nulos (metadata, cardNumber, expiryDate, cvv,
  //     cardholderName, accountNumber, bankName, etc.)
}
```

**Regras de construção do payload**:
- `amount` é forçado a `float`.
- `msisdn` só entra se fornecida.
- Se `direct_payment=True`, adiciona flags conforme `PAYSUITE_TEST_MODE` e **remove `return_url`**
  (para pagamento móvel direto, sem redirecionamento). Em modo `clean` (default nas views)
  **não** adiciona flags extras — apenas envia `msisdn`.
- Qualquer chave extra de `kwargs` com valor não-nulo é adicionada ao payload (card/bank/metadata).

**Timeout**: `PAYSUITE_TIMEOUT` (default 15 s).

**Resposta esperada** (contrato):

```json
{ "status": "success"|"error", "data": { "id": "...", "reference": "...", "checkout_url": "..." }, "message": "..." }
```

- Se `resp.text` vazio → retorna `{'status':'error','message':'Empty response from PaySuite','http_status': ...}`.
- Exceções (`ConnectTimeout`, `ReadTimeout`, `ConnectionError`, `HTTPError`, `RequestException`) são logadas e **re-lançadas** (a view trata).

### 5.3 `get_payment_status(payment_id)` — consultar status (fallback)

**Endpoint**: `GET {base_url}/v1/payments/{payment_id}`

- Usa **cache em memória** (30 s TTL) para evitar rate-limit.
- Trata HTTP ≥ 400: extrai `message`/`error`; em `429` devolve cache (mesmo que "stale") para o próximo poll.
- Retorna:
  ```json
  { "status": "success", "data": { "id": "...", "status": "...", "transaction": {...}|null, "error": "...", "message": "..." } }
  ```
  ou, em erro: `{ "status": "error", "message": "...", "code": 429|... }`.

> 📌 **Interpretação de `data.transaction`** (feita na view `payment_status`):
> - `transaction != null` → pagamento **concluído** (`paid`);
> - `error`/`message` presente → **falhou**;
> - `transaction == null` e sem erro → **ainda pendente** (aciona lógica de timeout).

### 5.4 `verify_signature(payload_body, signature_header)` — validar webhook

- Segredo usado: `webhook_secret` (preferido) ou `api_secret` (legado).
- Algoritmo: **HMAC-SHA256** do corpo bruto (`payload_body`) com o segredo, **hex-encoded**,
  comparado com `hmac.compare_digest`.
- Aceita header no formato Stripe-style `t=...,v1=<hex>` (extrai `v1`).
- Retorna `False` se não houver segredo ou header.

---

## 6. Endpoints Django (backend)

Rotas em `backend/cart/urls.py`:

```python
path('payments/initiate/', views.initiate_payment, name='payments-initiate'),
path('payments/webhook/',  views.paysuite_webhook,  name='payments-webhook'),
path('payments/status/<int:order_id>/', views.payment_status, name='payments-status'),
```

> Prefixo global: `/api/cart/...` (ver `chiva_backend/urls.py`). Logo as URLs públicas são:
> - `POST /api/cart/payments/initiate/`
> - `POST /api/cart/payments/webhook/`
> - `GET  /api/cart/payments/status/{id}/`

### 6.1 `initiate_payment` (`views.py`, linha ~744)

`@api_view(['POST'])` + `@permission_classes([IsAuthenticated])`.

**Passos (ordem exata, importante para não quebrar)**:

1. **Resolver o carrinho**:
   - Garante `session_key`.
   - Se existem `user_cart` e `session_cart` com itens → **merge** do session no user (transação atômica), marca session como `converted`.
   - Senão escolhe o carrinho que tem itens; se só existe o session e o usuário está autenticado, anexa (`session_cart.user = request.user`, `session_key=None`).
   - Se não há carrinho, cria um novo.
2. **Valida carrinho vazio**: se não tem itens e não veio `amount` do cliente → `400 {'error':'Cart is empty'}`.
3. **Refresca preços** dos itens a partir de `product.price` (atualiza `item.price` + `CartHistory`).
4. **Recalcula totais** (`cart.calculate_totals()`).
5. **Shipping**: prioriza o preço do `ShippingMethod` do banco (`server-side`) e aplica frete grátis se `min_order` for atingido.
6. **Cupom** (opcional): aplica desconto se `coupon_code` válido.
7. **Calcula `charge_total = cart_subtotal − discount + shipping`** (nunca negativo).
8. **Valida `amount` do cliente**: como o frontend não envia `amount`, o mismatch raramente ocorre;
   se vier e divergir:
   - se não há `shipping_method` → usa o valor do cliente (sanity `0 < sent < 1000000`);
   - se há `shipping_method` → rejeita `400 amount_mismatch` (evita tampering).
9. **Cria o `Payment`** (sem `Order`):
   - `status='initiated'`, `order=None`, `amount=charge_total`, `currency`, `method`.
   - `request_data` = `{ shipping_address, billing_address, shipping_method, customer_notes, shipping_cost, items: [...], meta: {...} }`.
   - `items` = snapshot de `product_id/name/sku/product_image/color/size/quantity/price`.
10. **Persiste contatos** no `CustomerProfile` e `first_name/last_name/email` do user (não bloqueante).
11. **Escolhe o cliente**:
    - `PAYSUITE_TEST_MODE == 'mock'` → `SafePaysuiteClient`.
    - caso contrário → `PaysuiteClient(base_url=settings..., api_key=..., webhook_secret=...)`.
12. **Monta `callback_url` e `return_url`**:
    - Se `WEBHOOK_BASE_URL` configurado: `{base}/api/cart/payments/webhook/` e `{base}/orders/status`.
    - Senão: `request.build_absolute_uri(...)`.
13. **Gera `reference`** único: `f"PAY{payment.id:06d}"` (≤ 50 chars).
14. **Monta `payment_creation_data`** (dicionário → kwargs de `create_payment`):
    ```python
    {
      'amount': float(payment.amount),
      'method': method,
      'reference': reference,
      'description': f"Payment {payment.id} for cart {cart.id}",
      'return_url': return_url,
      'callback_url': callback_url,
      'metadata': {'payment_id':..., 'cart_id':..., 'user':..., 'ui_total_sent':..., 'ui_shipping_sent':..., 'ui_currency':...}
    }
    ```
15. **Limite E-Mola**: se `method == 'emola'` e total > `EMOLA_MAX_AMOUNT` (default 100000 MZN) →
    `400 amount_exceeds_method_limit` com `suggestions`.
16. **Dados específicos do método**:
    - `mpesa`/`emola`: valida telefone com `validate_mozambique_phone`; usa `phone_validation['recommended']`
      (formato internacional **sem** `+`); define `msisdn`. Detecta mismatch método×carrier (apenas log).
      - Se `PAYSUITE_TEST_MODE == 'clean'` (default) → **não** adiciona flags diretas;
      - senão → `direct_payment=True` e remove `return_url`.
    - `card`: anexa `cardNumber`, `expiryDate`, `cvv`, `cardholderName`.
    - `transfer`: anexa `accountNumber`, `bankName`.
17. **Chama `client.create_payment(**payment_creation_data)`**.
18. **Trata resposta**:
    - `status != 'success'` → marca `Payment.status='failed'`, salva `raw_response`, responde
      `400` se `error_code == 'AMOUNT_INVALID'`, senão `502 Bad Gateway`.
    - `status == 'success'` → `paysuite_reference = data.id or data.reference`,
      `raw_response = api_resp`, `status='pending'`.
19. **Resposta ao frontend**:
    ```json
    {
      "payment_id": 123,
      "payment": {
        "id": "<external_id>",
        "reference": "<external_ref>",
        "is_direct": true|false,          // true p/ mpesa/emola com phone
        "method": "mpesa",
        "phone": "258840000000",
        "checkout_url": "..."              // SÓ para card/transfer (não para móvel)
      }
    }
    ```
    - Para `mpesa`/`emola` com phone, **força processamento direto** e **não** inclui `checkout_url`.
20. **Opcional**: limpar carrinho se `CART_CLEAR_ON_INITIATE=1`.

> 🚨 **CRÍTICO (comentado no código)**: **NÃO** criar `Order` aqui. O `Order` é criado
> apenas no webhook/polling quando `status='paid'`.

### 6.2 `paysuite_webhook` (`views.py`, linha ~1320)

`@api_view(['POST'])` + `@permission_classes([AllowAny])` + `@csrf_exempt`.

**Passos**:

1. Cria `PaysuiteClient()` (sem args → usa env vars).
2. Loga metadados da request (IP, User-Agent, Content-Length).
3. Lê assinatura dos headers (em ordem de preferência):
   `X-Webhook-Signature` → `X-Paysuite-Signature` → `X-Signature`.
4. **Verifica assinatura (best-effort)**:
   - Se há header **e** segredo → valida com `verify_signature`; se inválida → `400 Invalid signature`.
   - Se não há header ou segredo → **não bloqueia**, apenas loga warning.
5. Lê corpo: `data = request.data` (DRF). Estrutura esperada:
   ```json
   { "event": "payment.success", "data": { "id": "...", "reference": "...", "amount": ..., "metadata": {...} } }
   ```
6. **Localiza o `Payment`**:
   - `reference = data_block.get('id') or data_block.get('reference')`
   - `Payment.objects.filter(paysuite_reference=reference).first()`
   - Fallback: `metadata.order_id` → `Payment.objects.filter(order__id=order_id).first()`
   - Se não achar → `404 Payment not found`.
7. **Mapeia evento → status**:
   - `payment.success`, `payment.paid`, `payment.completed` → `paid`
   - `payment.failed`, `payment.cancelled`, `payment.rejected` → `failed`
   - outro → `pending`
8. Salva `raw_response = data` e novo `status`.
9. **Sincroniza** `order.status` imediatamente se `payment.order` existir.
10. **Se `paid`**:
    - Se `Order` ainda não existe → cria a partir de `payment.request_data` (endereços, shipping, `total_amount=payment.amount`, `status='pending'`), vincula `payment.order`, cria `OrderItem`s (do `request_data['items']` ou, fallback, do snapshot do `Cart`).
    - `OrderManager.update_order_status(order, 'paid', notes=...)` → **reduz stock**.
    - Limpa o carrinho (deleta itens, `status='converted'`, `CartHistory`).
    - **Envia emails**: confirmação de pedido + status pago para o cliente, e notificação de nova venda para o admin.
11. **Se `failed`**:
    - Atualiza `Order` para `failed` (se existir) via `OrderManager` (fallback: salva direto).
    - Envia email de falha ao cliente.
12. Responde `{'ok': True}` (sempre 200 se processou; erros inesperados → 500).

### 6.3 `payment_status` (`views.py`, linha ~1718)

`@api_view(['GET'])` + `@permission_classes([IsAuthenticated])`.

**Aceita `order_id` OU `payment_id`** (retrocompatível). É chamado pelo frontend a cada 3 s.

**Passos**:

1. Tenta `Order.objects.filter(id=order_id, user=request.user).first()`.
   - Se existe → `payments = Payment.objects.filter(order=order).order_by('-created_at')`.
   - Se não existe → trata `order_id` como `payment_id`; verifica dono via `payment.cart.user`;
     `order = payment.order` (pode ser `None`).
2. **Polling ativo**: se o último `Payment` está `pending` e tem `paysuite_reference`, chama
   `PaysuiteClient(...).get_payment_status(ref)`.
3. **Interpreta resposta** (`response_status`):
   - `success`:
     - `data.transaction != null` → `paid`;
     - `data.error`/`data.message` → `failed`;
     - `data.transaction == null` → aplica **timeout híbrido**:
       - Hard: > 15 min → `failed`;
       - Soft: > 3 min **e** > 60 polls → `failed`;
       - senão → continua `pending` (incrementa `poll_count`, atualiza `last_polled_at`).
   - `error` → `failed` (extrai `message`).
4. Se o status mudou:
   - Atualiza `Payment.status` e `raw_response` (inclui `polled_at`/`polled_response`).
   - Sincroniza `order.status`.
   - Se `failed` → email de falha.
   - Se `paid`:
     - Cria `Order`/`OrderItem`s se ainda não existirem (mesmo fluxo do webhook, com fallback ao `Cart`),
     - `OrderManager.update_order_status(... 'paid')` → reduz stock,
     - limpa carrinho,
     - envia emails (confirmação + status pago + admin).
5. **Resposta**:
   ```json
   {
     "order": <OrderSerializer> | null,
     "payment_id": <int> | null,
     "payments": [<PaymentSerializer>, ...]
   }
   ```

---

## 7. Validações e regras de negócio (não pular!)

### 7.1 Telefone (`backend/cart/utils/phone_validation.py`)

`validate_mozambique_phone(phone) -> dict`:
- Remove não-dígitos.
- Aceita 12 dígitos iniciando com `258` (formato internacional) **ou** 9 dígitos (nacional).
- Prefixos válidos: `82`/`83` (mcel), `84`/`85` (vodacom), `86`/`87` (movitel).
- **`recommended`** = formato internacional **sem** `+`: ex. `258840000000` (é o que vai em `msisdn`).
- Retorna `{ valid, carrier, national, country_code, formats, recommended }`.

`get_payment_method_from_phone(phone) -> str`:
- `mcel` → `mpesa`; `vodacom` → `emola`; `movitel` → `mpesa`.

### 7.2 Limites de valor

- **E-Mola**: máximo `EMOLA_MAX_AMOUNT` (default `100000` MZN) → erro `amount_exceeds_method_limit`.
- **Sanity do amount do cliente**: só aceito se `0 < sent < 1000000`.
- **`charge_total` nunca negativo**.

### 7.3 Tabela de erros (contrato com o frontend)

| `error` | HTTP | Significado / ação do frontend |
|---|---|---|
| `amount_mismatch` | 400 | Total divergiu (shipping/carrinho mudou) → recarregar |
| `amount_exceeds_method_limit` | 400 | E-Mola acima do limite → sugerir outro método |
| `Invalid amount` | 400 | Valor inválido / carrinho vazio |
| `Cart is empty` | 400 | Carrinho vazio |
| `Invalid phone number: ...` | 400 | Telefone inválido |
| `Invalid signature` | 400 | Webhook com assinatura inválida |
| `Payment not found` | 404 | Webhook sem `Payment` correspondente |
| `Permission denied` | 403 | Polling de pagamento de outro usuário |
| `AMOUNT_INVALID` (em `error_code`) | 400 | Valor fora dos limites de teste (mock) |
| outro `status != success` | 502 | Erro genérico do gateway |

---

## 8. Fluxo no frontend

### 8.1 `usePayments.initiatePayment(method, paymentData)` (`frontend/src/hooks/usePayments.ts`)

1. (Opcional) sincroniza itens com `POST /api/cart/sync/`.
2. Busca o carrinho do servidor (`GET /api/cart/`) e valida que **não está vazio** e tem total > 0.
3. `POST /api/cart/payments/initiate/` com corpo:
   ```json
   { "method": "mpesa", "shipping_method": "...", "currency": "MZN",
     "shipping_address": {...}, "billing_address": {...},
     "customer_notes": "...", "items": [{id, quantity, color_id, size_id}], "phone": "..." }
   ```
   - **`amount` e `shipping_amount` são sempre removidos** (`delete requestBody.amount`).
4. Trata erros estruturados (`amount_exceeds_method_limit`, `amount_mismatch`, `Invalid amount`).
5. Lê `checkout_url` (se houver) e exige `payment_id`.
6. Retorna o payload `{ payment_id, payment }`.

### 8.2 Navegação (`Checkout.tsx` / `CheckoutDetails.tsx`)

- Se `payment.checkout_url` existir (card/transfer) → `window.location.href = redirectUrl`.
- Senão (móvel) → `navigate('/pedido/confirmacao/' + (payment_id || order_id))`.

### 8.3 `OrderConfirmation.tsx` — polling

- Chama `fetchPaymentStatus(orderId)` (que faz `GET /api/cart/payments/status/{orderId}/`).
- **A cada 3 s** até atingir estado final (`paid`/`failed`/`cancelled`) ou **2 min** de timeout.
- Prioriza `payment.status` sobre `order.status`.
- Mostra botão de `checkout_url` (de `lastPayment.raw_response.data.checkout_url`) quando presente.
- Em `paid`, limpa o carrinho local (`clearCart()`).

---

## 9. GOTCHAS críticos (causas mais comuns de erro/atraso)

1. **`Order` só após `paid`** — nunca crie o pedido no initiate; use `request_data` salvo no webhook/polling.
2. **Header `Authorization: Bearer <api_key>`** — se `PAYSUITE_API_KEY` estiver vazio, o header não é enviado e o gateway rejeita. Nas views passe `api_key=settings.PAYSUITE_API_KEY` explicitamente.
3. **`base_url` inconsistente** — `settings.py`, `paysuite.py` e `safe_paysuite.py` têm defaults diferentes. Sempre injete `settings.PAYSUITE_BASE_URL`.
4. **Webhook usa env vars diretas** (`PaysuiteClient()` sem args) — mantenha env e settings sincronizados.
5. **`msisdn` sem `+`** — usar `phone_validation['recommended']` (`25884...`), não o número original com `+`/espaços.
6. **Móvel = sem `checkout_url`** — para `mpesa`/`emola`, `return_url` é removido e o processamento é direto; o frontend deve cair no polling, não em redirect.
7. **`reference` ≤ 50 chars** — usar `f"PAY{payment.id:06d}"`.
8. **Webhook sem assinatura não bloqueia** — em dev sem segredo, o código segue; em produção configure `PAYSUITE_WEBHOOK_SECRET` e valide.
9. **`paysuite_reference` guarda `data.id` (ou `data.reference`)** — o webhook procura por este campo; se o gateway devolver só `reference`, garanta que cai no fallback.
10. **`data.transaction == null` é ambíguo** (pendente ou falhou) — use a lógica de timeout híbrido (15 min hard / 3 min + 60 polls soft).
11. **Cache de status (30 s)** e **rate-limit 429** — evite re-consultas em excesso.
12. **Retries só para GET** — POST de criação de pagamento não é idempotente; não retentar automaticamente.
13. **`poll_pending_payments.py` é um stub** — não consulta o PaySuite; apenas marca para verificação manual (não confie nele como fallback real).
14. **Moeda** — montante em **MZN**, enviado como `float`.
15. **Cartões/transferência** — `Payment.METHOD_CHOICES` só lista `mpesa`/`emola`, mas a view trata `card`/`transfer` passando os campos (`cardNumber`, `expiryDate`, `cvv`, `cardholderName`, `accountNumber`, `bankName`) via kwargs.
16. **Email/limpeza de stock só no `paid`** — via `OrderManager.update_order_status` (reduz stock) e `email_service` (confirmação/status/admin).
17. **`SafePaysuiteClient` só em `PAYSUITE_TEST_MODE='mock'`** — em `sandbox`/`development` ele usa URLs/limites de teste e, em erro, devolve mock; não use em produção.

---

## 10. Checklist passo a passo para replicar em um novo pagamento

1. **Config** (`.env` / `settings.py`):
   - [ ] `PAYSUITE_BASE_URL`, `PAYSUITE_API_KEY`, `PAYSUITE_WEBHOOK_SECRET`, `WEBHOOK_BASE_URL`.
   - [ ] (opcional) `EMOLA_MAX_AMOUNT`, `PAYSUITE_TIMEOUT`, `PAYSUITE_TEST_MODE`.
2. **Modelo**: garanta `Payment` com `order`(nullable), `cart`, `method`, `amount`, `currency`,
   `paysuite_reference`, `status`, `raw_response`, `request_data`, `poll_count`, `last_polled_at`.
3. **Cliente**: use `PaysuiteClient(base_url=settings.PAYSUITE_BASE_URL, api_key=..., webhook_secret=...)`.
   - [ ] Endpoint `POST /v1/payments` com payload `{amount, reference, method?, description?, return_url?, callback_url?, msisdn?}`.
   - [ ] Endpoint `GET /v1/payments/{id}` para status.
   - [ ] `verify_signature` HMAC-SHA256 hex, header `X-Webhook-Signature`.
4. **Initiate**: crie `Payment` (`status='initiated'`, `order=None`), salve `request_data` (endereços + itens),
   chame `create_payment`, salve `paysuite_reference` e `status='pending'`, responda `{payment_id, payment}`.
   - [ ] **Não** crie `Order` aqui.
5. **Webhook**: valide assinatura, localize `Payment` por `paysuite_reference`, mapeie eventos para
   `paid`/`failed`, e **só então** crie `Order` + `OrderItem`s + reduza stock + limpe carrinho + envie emails.
6. **Polling**: endpoint de status que, quando `pending`, consulta o PaySuite e aplica timeout
   (15 min hard / 3 min + 60 polls soft); replica a criação do `Order` quando `paid`.
7. **Frontend**: remova `amount`/`shipping_amount` do request; navegue para confirmação e faça polling 3 s;
   trate `checkout_url` apenas quando houver (card/transfer).
8. **Teste**: `manage.py paysuite_diagnostics`, `manage.py test_paysuite` (e variantes), e valide
   webhook com um túnel (`ngrok`) apontando `WEBHOOK_BASE_URL` para o endpoint público.
