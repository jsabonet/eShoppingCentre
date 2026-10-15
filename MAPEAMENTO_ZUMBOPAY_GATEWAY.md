# Mapeamento — Gateway ZumboPay vs. Arquitectura de Pagamentos Actual

> **Documento de análise — implementado.** Este documento foi escrito antes da integração;
> o código foi depois alterado conforme aqui proposto.
>
> **Estado:** ✅ **Implementado** — o ZumboPay substituiu o PaySuite no backend (settings,
> cliente `zumbopay.py`, modelo, vistas, webhook, migração `0004`) e no frontend (checkout +
> retoma de pagamento).
>
> **Reconciliação (rede de segurança):** ✅ **Implementada** — o webhook deixou de ser o único
> caminho para fechar um pagamento. `services/reconciliation.py` interroga o gateway pelos
> checkouts pendentes, há três formas de a accionar (Celery beat a cada 300 s, endpoint
> `POST /api/v1/payments/reconcile/` para o admin, e `manage.py reconcile_payments`) e a
> liquidação reutiliza `complete_payment`, pelo que continua idempotente. Ver §18.
>
> ⏳ **Por implementar (fase 2):** STK push `/charges`, *split*, recorrentes e payouts
> programáticos — ver §5, §9 e §17.
>
> **Hardening concluído:** o webhook passou a falhar de forma fechada sem
> `ZUMBOPAY_WEBHOOK_SECRET` (ver §18.4) — um pedido não assinado já não pode marcar uma
> encomenda como paga em produção.
>
> **Carrinho:** ✅ deixou de ser esvaziado ao iniciar o pagamento. Só é limpo — e apenas dos
> artigos que o pagamento cobriu — quando o pagamento for confirmado, pelo que uma desistência
> ou falha no gateway já não faz perder a compra. Ver §20.
>
> **Credenciais:** ✅ configuradas em `backend/.env` (conta de produção, chave `zk_live_`).
> ⚠️ **Bloqueante antes de aceitar dinheiro real:** o webhook está registado sem o caminho
> `/api/v1/payments/webhook/zumbopay/` e o backend em produção ainda é o código anterior —
> ver §19.1. Só o **M-Pesa** tem carteira; ver §19.0.
>
> Este documento responde a uma única pergunta: *se o eShoppingCentre passasse a usar o
> ZumboPay, o que encaixa no que já existe e o que teria de ser construído de raiz?*
>
> **Fonte:** <https://zumbopay.com/documentacao> (documentação pública oficial, consultada em 2026)
> **Gateway em produção:** ZumboPay (substituiu o PaySuite)
> **Âmbito coberto:** cobrança, carteiras, webhooks, payouts. **Exclui** decisão comercial e preços finais.

---

## 1. Resumo executivo

O ZumboPay **não é um gateway exótico** — na sua superfície de cobrança é quase um espelho
do PaySuite. O cliente HTTP actual (`PaysuiteClient`) faz `POST /v1/payments` e recebe uma
`checkout_url`; o ZumboPay faz `POST /payments` e devolve exactamente a mesma coisa. O
`verify_signature` actual já é HMAC-SHA256 sobre o corpo bruto, e o ZumboPay usa o mesmo
algoritmo (muda só o nome do cabeçalho). **Todo o circuito de dinheiro interno — carteira,
ledger, escrow, notificações, liquidação idempotente — é agnóstico ao gateway e não precisa
de ser tocado.**

O que é genuinamente novo:

| Capacidade | Existe hoje? | Valor para o projecto |
|---|---|---|
| **STK push** (`POST /charges`) — PIN no telemóvel, **sem redirect** | ❌ | 🔴 Alto — é a UX correcta para um mercado *mobile-first* |
| **Payout instantâneo** (`auto_dispatch`) — M-Pesa B2C em tempo real | ❌ (saque 100% manual) | 🟠 Médio-alto — elimina o trabalho manual do admin |
| **Split payments** — distribuição automática por carteiras | ❌ (liquidação interna) | 🟡 Baixo — **conflita com o escrow actual** |
| **Recorrentes** — subscrições cobradas automaticamente | ❌ | 🟡 Médio — encaixa em cursos/planos |
| **`GET /merchant/validate`** — diagnóstico de prontidão | ❌ | 🟢 Baixo esforço, alto retorno operacional |

O maior risco **não é técnico, é económico**: o ZumboPay cobra **8% por cima** do
`platform_fee` + `affiliate_commission` que o projecto já aplica. São duas margens em série.

---

## 2. O que é o ZumboPay

Gateway de pagamentos moçambicano (Zumbo Cloud / Nethost, Maputo). API REST sobre HTTPS.

- **URL base:** `https://zumbopay.com/api/public/v1`
- **Formato:** JSON nos dois sentidos; toda a resposta — sucesso ou erro — é JSON
- **Datas:** ISO 8601 em UTC
- **Valores:** na unidade principal (`1500.50` = 1.500,50 MZN)
- **Métodos:** M-Pesa, e-Mola, mKesh, Visa/Mastercard (3-D Secure 2)
- **Chamadas:** sempre a partir do **servidor**. A documentação é explícita — nunca do browser

---

## 3. Os dois fluxos de cobrança

Esta é a distinção mais importante de toda a API, e a documentação avisa para não os confundir.

| | `POST /charges` | `POST /payments` |
|---|---|---|
| **Tipo** | STK push directo | Checkout hospedado |
| **UX do cliente** | Popup do PIN no telemóvel, **sem sair do site** | Redireccionado para `checkout_url` |
| **Canais** | Só M-Pesa (84/85) e e-Mola (86/87) | `mpesa`, `emola`, `mkesh`, `card` |
| **Cartão** | ❌ não suporta | ✅ MPGS + 3DS em iframe |
| **Resposta** | `200` síncrono · `202` a aguardar PIN · `402` recusado | `201` com `checkout_url` |
| **`wallet_id`** | **Obrigatório** (`400` sem ele) | **Obrigatório** (UUID ou `wallet_code`) |

**O canal é inferido pelo prefixo do MSISDN** — `84`/`85` → M-Pesa, `86`/`87` → e-Mola.
Não há parâmetro de canal em `/charges`.

### 3.1 `POST /charges` — cobrança directa (STK)

```
{ "wallet_id": "<uuid>",          // OBRIGATÓRIO
  "amount": 250,
  "msisdn": "258841234567",
  "customer_name": "Maria",
  "source_id": "fatura-2026-0042" // idempotência
}
```

Três desfechos possíveis, e o **`202` é o mais delicado**:

| Código | Significado | Consequência para a UI |
|---|---|---|
| `200` | Sucesso síncrono (`code: "INS-0"`) | Pagamento confirmado |
| `202` | `status: "pending"` — a aguardar que o cliente introduza o PIN | **Estado intermédio novo**: "aguarde e confirme no telefone" |
| `402` | `psp_declined` | Recusa do operador |

O `202` significa que a confirmação **só chega por webhook**. Qualquer implementação deste
fluxo precisa de um ecrã de espera com *polling* ao `GET /payments/:ref`.

### 3.2 `POST /payments` — checkout hospedado

```
{ "title": "Curso de Excel",
  "amount": 1500,
  "currency": "MZN",
  "channels": ["mpesa", "emola", "card"],
  "wallet_id": "<uuid>",           // OBRIGATÓRIO
  "description": "Inscrição turma de Julho",
  "max_uses": 1,
  "expires_at": "2026-12-31T23:59:59Z"
}
→ 201 { "data": { "reference": "ZP_AB12CD34",
                  "slug": "curso-excel",
                  "status": "active",
                  "checkout_url": "https://zumbopay.com/pay/curso-excel" } }
```

**Este é o pedido que substitui directamente o `PaysuiteClient.create_payment` actual.**
Formato do `checkout_url`: `https://zumbopay.com/pay/<reference-ou-slug>`.

Consulta: `GET /payments?limit=50&status=active` ou `GET /payments/<reference-ou-slug>`.

---

## 4. Autenticação e credenciais

Dois cabeçalhos em cada pedido:

```
Authorization: Bearer zk_live_…
X-Merchant-Id: MCH_XXXXXXXXXX
```

| Identificador | Formato | Onde se obtém | Uso |
|---|---|---|---|
| **Merchant ID** | `MCH_XXXXXXXXXX` | Painel → Programadores | Identifica a conta |
| **API Key** | `zk_live_…` / `zk_test_…` | Painel → Programadores | Autentica pedidos |
| **`wallet_id`** | UUID | `GET /wallets` | Identifica a carteira por método |
| **`wallet_code`** | 6 dígitos | `GET /wallets` | Alternativa ao UUID em `/payments` |
| **Webhook Secret** | `whsec_…` | Painel → Programadores | Valida assinaturas |

**Pontos de atenção:**

- `X-Merchant-Id` é *recomendado* em todos os pedidos. Se enviado e não corresponder à conta
  da API key → `403 merchant_id_mismatch`.
- As chaves têm **scopes**: `wallets:read`, `payments:write`, `payouts:write`.
- A documentação afirma nunca expor UUIDs internos — identificar sempre pelo Merchant ID.

### 4.1 `GET /merchant/validate` — diagnóstico de prontidão

Devolve `ready`, um array `missing[]` (com exactamente o que falta: `merchant_id`,
`wallet_mpesa`, `wallet_emola`, `wallet_card`, `webhook`, `contact_phone`), o objecto
`merchant`, as `wallets` por método (com `wallet_id`, `wallet_code`, `name`, `currency`,
`balance`) e o `webhook` configurado.

É um *health-check* de gateway — não existe nada equivalente hoje no projecto.

---

## 5. Limites de taxa e idempotência

| Endpoint | Limite |
|---|---|
| `POST /charges` | 60/min |
| `POST /payments` | 60/min |
| `GET /payments` | 120/min |
| `GET /payments/:ref` | 240/min |
| `POST /payouts` | 30/min |
| `GET /wallets` | 120/min |

Cabeçalhos `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Ao exceder:
`429` + `Retry-After`.

**Idempotência** — `source_id` (em `/charges`) ou o cabeçalho `Idempotency-Key`. Repetir o
mesmo identificador devolve a transacção original com `"duplicate": true`.

> ⚠️ Nota para o cliente HTTP actual: o `Retry` configurado no `PaysuiteClient` só abrange
> `GET`/`HEAD`/`OPTIONS` (`allowed_methods`). Isso é **correcto e deve manter-se** — retentar
> um `POST` cegamente arrisca cobrança dupla. O mecanismo certo é a idempotência explícita.

---

## 6. Webhooks

- **Cabeçalho:** `x-zumbopay-signature`
- **Cálculo:** HMAC-SHA256 (**hex**) do **corpo bruto** assinado com o *webhook secret*
- **Comparação:** *timing-safe* (`crypto.timingSafeEqual` nos exemplos)

**Isto é exactamente o mesmo algoritmo** que o `verify_signature` actual já implementa.
A assinatura passa a ser lida de `HTTP_X_ZUMBOPAY_SIGNATURE` em vez de `HTTP_X_SIGNATURE`.

**Callbacks de operadora:** o `POST https://zumbopay.com/api/public/mpesa-callback` é
configurado nas chaves Vodacom **do lado do ZumboPay** — o comerciante não o regista.
Só o webhook de plataforma é que é nosso.

---

## 7. Payouts

Os fundos **entram sempre na conta master do ZumboPay**; a redistribuição depende do método
e do modo. Isto é estruturalmente diferente de um ledger interno.

| Modo | Mínimo | Taxa | Comportamento |
|---|---|---|---|
| **Manual** (qualquer método) | 500 MT | 20 MT por cada 500 MT (≈4%) | `status: "pending"` até aprovação do admin |
| **Instantâneo M-Pesa B2C** (`auto_dispatch: true`) | 1 MT | 6% sobre o líquido | Disparado em tempo real; resposta já vem `success` com `provider_reference` |

A resposta manual já traz `fee_amount` e `net_amount` calculados.

### Configuração e-Mola (herda das settings da carteira)

| Modo | Repartição |
|---|---|
| **Auto B2C ON** | 100% entra no master · 86% enviado por B2C automático · **14% retidos** (8% plataforma + 6% B2C) · **a carteira não acumula saldo** |
| **Auto B2C OFF** | 92% creditado na carteira (8% plataforma retida) |

**Regras e restrições:**

- `auto_dispatch` **só funciona com `method=mpesa`** → caso contrário `auto_dispatch_unsupported`
- Mudar o número de payout exige **OTP por SMS no número antigo** (anti-fraude)
- Pré-requisitos: **KYC aprovado** + saldo suficiente
- Erros típicos: `insufficient_funds`, `wallet_not_found`, `manual_min_amount` (< 500 MT),
  `auto_dispatch_unsupported`, `b2c_failed`

---

## 8. Split payments (multi-beneficiário)

Distribui automaticamente cada pagamento por várias carteiras.

```
{ "type": "split",
  "wallet_id": "<wallet_id_principal>",
  "splits": [
    { "recipient_wallet_id": "<uuid_A>", "share_type": "percent", "share_value": 70 },
    { "recipient_wallet_id": "<uuid_B>", "share_type": "percent", "share_value": 30 }
  ] }
```

- **Máx. 20 beneficiários** por link
- Percentagens **devem somar 100**; partes fixas usam valor absoluto em MZN
- **A comissão de 8% é aplicada ANTES do split**

---

## 9. Pagamentos recorrentes

```
{ "type": "recurring",
  "recurring": { "channel": "card|mpesa|emola",
                 "interval": "daily|weekly|monthly|quarterly|semiannual|yearly",
                 "max_charges": …,
                 "start_at": …, "end_at": …,
                 "customer_name": …, "customer_email": …, "customer_msisdn": … },
  "consent_accepted": true }
```

- Cobrado por um **runner diário às 03:05 UTC**
- Cartão → usa o token guardado após a primeira autorização 3DS
- M-Pesa/e-Mola → dispara STK no número fornecido
- `consent_accepted` omitido/falso → subscrição fica `pending` até o cliente aceitar o mandato
- **Após 3 falhas seguidas → `paused`**
- Cancelamento: `DELETE /api/public/v1/subscriptions/<id>` → emite `subscription.cancelled`

---

## 10. Comissões e economia

| Item | Valor |
|---|---|
| Comissão de plataforma ZumboPay (cobrança) | **8%** |
| Split | 8% aplicada **antes** da distribuição |
| Payout manual | 20 MT / 500 MT (≈4%), mín. 500 MT |
| Payout instantâneo M-Pesa B2C | 6%, mín. 1 MT |

A carteira é creditada com o **valor líquido** (8% deduzida). Comissão e estado são
publicados por webhook em tempo real.

---

## 11. Códigos de erro

Envelope uniforme:

```json
{ "error": { "code": "invalid_input", "message": "wallet_id é obrigatório" } }
```

| HTTP | Códigos | Tratamento |
|---|---|---|
| `400` | `invalid_json`, `invalid_input`, `insufficient_funds` | Erro de contrato — não retentar |
| `401` | `invalid_api_key`, `revoked_api_key`, `expired_api_key` | Alerta operacional |
| `403` | `insufficient_scope`, `merchant_id_mismatch` | Configuração errada |
| `404` | `not_found`, `wallet_not_found` | Configuração errada |
| `429` | limite de taxa | Respeitar `Retry-After` |
| `5xx` | interno | Retentar com backoff exponencial |

**Diferença importante face ao PaySuite:** o PaySuite devolve
`{ "status": "success", "data": { … } }` e o `PaysuiteClient` valida `status == 'success'`.
O ZumboPay devolve `{ "data": { … } }` em sucesso e `{ "error": { … } }` em falha.
**A camada de interpretação da resposta tem de mudar por provider.**

---

## 12. Arquitectura actual do eShoppingCentre (baseline)

### 12.1 Circuito de cobrança

```
CheckoutContent.tsx
  └─ paymentsAPI.initiate({ order_ids, method })
       └─ POST /api/v1/payments/initiate/   [PaymentsInitiateView]
            ├─ valida posse das encomendas (buyer=request.user)
            ├─ separa pending / already_paid
            ├─ total = Σ o.total
            ├─ reference = order_number  (1 encomenda)
            │             CHECKOUT-<10>  (>1 encomenda)
            ├─ PaysuiteClient.create_payment(amount, reference, return_url, webhook_url, method)
            ├─ PaymentTransaction.get_or_create(idempotency_key=f'paysuite:{reference}')
            └─ Order.payment_id = reference      ← é isto que o webhook usa para mapear
       └─ devolve { checkout_url, payment_id, reference, order_ids }
  └─ redirect → checkout_url
       └─ (gateway) → POST /api/v1/payments/webhook/paysuite/  [PaysuiteWebhookView]
            ├─ verify_signature(raw body, HTTP_X_SIGNATURE)
            ├─ payment.success → _mark_txn_completed + complete_payment() por encomenda
            └─ payment.failed  → marca a txn como failed
  └─ return_url → /checkout/success?reference=<reference>
       └─ paymentsAPI.status(reference)   [polling de fallback]
```

### 12.2 Ficheiros envolvidos

| Ficheiro | Responsabilidade |
|---|---|
| `backend/apps/payments/models.py` | `PaymentTransaction` |
| `backend/apps/payments/services/paysuite.py` | `PaysuiteClient` (HTTP + assinatura) |
| `backend/apps/payments/services/completion.py` | `complete_payment()` — idempotente |
| `backend/apps/payments/views.py` | `PaymentsInitiateView`, `PaymentsStatusView`, `PaysuiteWebhookView` |
| `backend/apps/payments/urls.py` | `initiate/`, `status/`, `webhook/paysuite/` |
| `backend/apps/wallet/models.py` | `Wallet`, `WalletTransaction`, `WalletEntry`, `EscrowHolding`, `PayoutRequest` |
| `backend/apps/wallet/services.py` | `settle_payment`, `release_escrow`, `reverse_escrow`, `process_refund`, `request_payout`, `approve_payout`, `pay_payout`, `reject_payout` |
| `backend/apps/wallet/urls.py` | rotas de carteira + `admin/payouts/…/approve\|pay\|reject/` |
| `backend/apps/orders/models.py` | `Order.platform_fee`, `Order.affiliate_commission` |
| `backend/config/settings/base.py` | bloco `PAYSUITE_*` (~linha 313) |
| `frontend/src/lib/api.ts` | `paymentsAPI`, `walletAPI` |
| `frontend/src/components/CheckoutContent.tsx` | `PAYSUITE_METHODS`, `PAYMENT_METHODS`, redirect |
| `frontend/app/checkout/success/page.tsx` | Ecrã de retorno |

### 12.3 Modelo de dinheiro interno

```
Pagamento confirmado
  └─ settle_payment(order)
       net = order.total − platform_fee − affiliate_commission
       ├─ tem itens físicos → EscrowHolding(status='held')      ← retido
       └─ digital/curso     → credit(vendedor.payout_balance)   ← imediato
                                 idempotency_key = order:{id}:settle

Escrow retido
  ├─ release_escrow()  → credit vendedor   (idem: escrow:{id}:release)
  └─ reverse_escrow()  → status='reversed'  (cancelamento/reembolso)

Payout (hoje: 100% manual)
  request_payout()  → PayoutRequest(pending) + reserved_balance += amount + email ao admin
  approve_payout()  → status='approved'
  pay_payout()      → debita reserved + payout_balance, admin_reference, status='paid'
  reject_payout()   → liberta o reservado, status='rejected'
```

---

## 13. Mapeamento peça a peça

| Peça actual | Equivalente ZumboPay | Veredicto |
|---|---|---|
| `PaysuiteClient.create_payment` → `POST /v1/payments` | `POST /payments` → `checkout_url` | 🟢 **Mapeamento 1:1** |
| `PaysuiteClient.get_payment` → `GET /v1/payments/{id}` | `GET /payments/<reference-ou-slug>` | 🟢 **Mapeamento 1:1** |
| `verify_signature` (HMAC-SHA256 hex do corpo bruto) | `x-zumbopay-signature`, mesmo algoritmo | 🟢 **Reutilizável** — muda só o header |
| `PaymentsInitiateView` (fluxo + mapeamento de referência) | Mesmo padrão | 🟢 **Reutilizável** — precisa de resolver `wallet_id` |
| `PaymentsStatusView` (polling por `reference`) | Mesmo padrão | 🟢 **Reutilizável** |
| `PaysuiteWebhookView` (`payment.success` / `payment.failed`) | `payment.succeeded` / `payment.failed` | 🟡 **Reutilizável** — nomes de evento divergem (`success` vs `succeeded`) |
| `complete_payment()` | — | 🟢 **Sem alterações** (agnóstico) |
| `settle_payment` / escrow / `process_refund` | — | 🟢 **Sem alterações** (ledger interno) |
| `PaymentTransaction` | — | 🟡 `PROVIDER_CHOICES` += `zumbopay`; prefixo da `idempotency_key` |
| `PayoutRequest` + approve/pay/reject | `POST /payouts` | 🟠 O passo `pay_payout` pode ser automatizado |
| `PAYSUITE_METHODS = ['mpesa','emola','card']` | `mpesa`, `emola`, `mkesh`, `card` | 🟡 Alinhado; falta `mkesh` |
| `PAYMENT_METHODS` — `wallet` | — | ⚪ **Sem equivalente** — saldo interno, não passa pelo gateway |
| `PAYMENT_METHODS` — `cash` | — | ⚪ **Sem equivalente** — offline, correcto |

**Conclusão do mapeamento:** cerca de **80% do código existente é reutilizável**. O trabalho
real concentra-se em quatro pontos, todos listados na secção seguinte.

---

## 14. Lacunas — o que seria trabalho novo

### 14.1 Cabeçalho `X-Merchant-Id` e credenciais

Adicionar `ZUMBOPAY_MERCHANT_ID` às settings e enviá-lo em todos os pedidos. Sem ele o
gateway aceita o pedido, mas perde-se a protecção contra uso da chave em conta errada.

### 14.2 Resolução do `wallet_id` — **o conceito mais novo**

O PaySuite não tem nada disto. O `wallet_id` é obrigatório em **ambos** os fluxos de
cobrança e identifica a carteira do método escolhido. Implica:

1. Obter e guardar os UUIDs por método (`GET /wallets`)
2. Um mapa `método do checkout → wallet_id`
3. Falha explícita e legível quando o `wallet_id` do método não está configurado
   (`400 invalid_input: wallet_id é obrigatório`)

Em `/payments` aceita-se também o `wallet_code` de 6 dígitos, mas nos **canais adicionais**
a carteira é resolvida automaticamente pelo método correspondente.

### 14.3 `POST /charges` — fluxo STK

Capacidade **inteiramente nova**. Exige:

- Um método novo no cliente HTTP
- Uma decisão de routing: quando usar STK vs. redirect
- Um estado de UI para o `202 pending` ("aguarde e confirme no telefone")
- A confirmação a chegar **só por webhook** — o *polling* continua a ser o fallback

### 14.4 Abstracção de provider

Hoje o gateway está **hardcoded** em vários pontos:

- `PROVIDER_CHOICES` só tem `'paysuite'` (`models.py:14`) e o campo tem `default='paysuite'`
- `PaymentsInitiateView` instancia `PaysuiteClient()` directamente
- `_webhook_url()` deriva para `/api/v1/payments/webhook/paysuite/`
- **9 ocorrências literais** de `'paysuite'` em `views.py` — 6 atribuições de `provider=` e
  3 prefixos de `idempotency_key=f'paysuite:{reference}'`
- `apps/payments/tests.py` tem **8 asserções** que fixam `provider='paysuite'` e o prefixo da
  chave de idempotência — os testes teriam de ser actualizados em conjunto

Para suportar dois gateways em paralelo é preciso uma abstracção (registo/factory por
provider) em vez de substituir strings. **Se a intenção for substituir o PaySuite em vez de
coexistir**, este ponto deixa de ser necessário — e o esforço cai bastante.

### 14.5 Suporte a `mKesh`

O frontend só expõe `mpesa`, `emola`, `card`. O ZumboPay suporta `mkesh` — adicioná-lo
implica trabalho de UI, não de integração.

---

## 15. Riscos e decisões de arquitectura

### 🔴 15.1 Comissão dupla — o risco económico

| Camada | Valor actual no projecto |
|---|---|
| Comissão ZumboPay (cobrança) | **8%** |
| `Order.platform_fee` | definido por encomenda |
| `Order.affiliate_commission` | **10% por defeito** (`Store.default_affiliate_commission` = 10,00 · `Product.affiliate_commission` = 10,00) |

Fica-se com **três deduções em série** sobre a mesma venda. Numa venda com afiliado, 8% + 10%
consomem 18% antes de qualquer `platform_fee`. **Recomendação: modelar a rentabilidade por
cenário antes de assumir o gateway.**

### 🔴 15.2 Split ⇄ escrow são incompatíveis

O projecto retém dinheiro de produtos **físicos** em `EscrowHolding` até entrega + janela de
devolução. O split do ZumboPay distribui **imediatamente**, sem mecanismo de reversão
equivalente ao `reverse_escrow`.

**Decisão: o split não deve ser usado para produtos físicos.** Destruiria a protecção do
comprador — que é precisamente o mecanismo que dá confiança ao marketplace. Para
digital/curso, onde o crédito já é imediato em `settle_payment`, o split seria coerente —
mas aí também substitui lógica que já funciona.

**Conclusão: manter a liquidação interna. O split é a capacidade menos útil das cinco.**

### 🟠 15.3 Payouts: conta master vs. ledger interno

O `PayoutRequest` assume que a plataforma **controla o dinheiro** e apenas o move entre
saldos internos. No ZumboPay os fundos entram sempre na **conta master** e é de lá que saem
por B2C. Isso implica que a plataforma tem de **financiar a conta master** para suportar
saques — é um requisito de tesouraria, não só de código.

### 🟠 15.4 Conflito de mínimos

`request_payout` hoje só rejeita `amount <= 0`. O payout manual do ZumboPay exige
**mínimo 500 MT**. Uma carteira com 50 MT de saldo disponível deixaria de o poder levantar.
Isto é uma regra de negócio visível ao utilizador e precisa de decisão explícita.

### 🟠 15.5 Impacto na reconciliação

Com **e-Mola Auto B2C ON**, a carteira **não acumula saldo** e 14% ficam retidos. O
`AdminReconciliationView` actual parte do princípio de que o dinheiro está em saldos
internos. Este modo mudaria a semântica da conciliação.

> ✅ **Resolvido do lado do gateway (ver §18).** A reconciliação de pagamentos passou a
> interrogar o ZumboPay pelos checkouts pendentes, pelo que um webhook perdido já não
> deixa uma encomenda presa. A questão de tesouraria do modo e-Mola Auto B2C acima
> continua a ser uma decisão de negócio, não de código.

### 🟡 15.6 Nomes de eventos divergem

O PaySuite usa `payment.success`; o ZumboPay usa `payment.succeeded`. Como o handler actual
compara strings literais, uma troca descuidada resultaria em webhooks **silenciosamente
ignorados** — e pagamentos confirmados que nunca liquidam. Merece atenção explícita.

### 🟡 15.7 Referências sanitizadas

Desde 2026-06-22 as referências usam prefixo `ZP…`, sanitizadas para evitar a rejeição
`INS-19` do M-Pesa. As referências actuais do projecto (`order_number`,
`CHECKOUT-<10>`) precisam de ser validadas contra esse formato.

### ⚪ 15.8 Rate limits sem throttling actual

60/min em `POST /payments` é folgado para o volume actual, mas não existe neste momento
qualquer tratamento de `429`/`Retry-After` no cliente.

---

## 16. Variáveis de ambiente propostas

Ainda **não adicionadas** a `.env` / `.env.example`. Listing para referência:

```bash
# ─── Gateway de Pagamento (ZumboPay) ───
ZUMBOPAY_BASE_URL=https://zumbopay.com/api/public/v1
ZUMBOPAY_MERCHANT_ID=MCH_XXXXXXXXXX
ZUMBOPAY_API_KEY=zk_live_...
ZUMBOPAY_WEBHOOK_SECRET=whsec_...
ZUMBOPAY_WALLET_MPESA=
ZUMBOPAY_WALLET_EMOLA=
ZUMBOPAY_WALLET_CARD=
ZUMBOPAY_TIMEOUT=20
ZUMBOPAY_RETRY_TOTAL=3
ZUMBOPAY_RETRY_BACKOFF=0.5
# URL pública absoluta do webhook (opcional; deriva de BACKEND_URL se vazia)
ZUMBOPAY_WEBHOOK_URL=
```

> ✅ **Actualização:** estas variáveis já estão em `backend/.env.example` e em
> `config/settings/base.py`. Foram acrescentadas três para a reconciliação (§18):
> `ZUMBOPAY_RECONCILE_MIN_AGE_MINUTES`, `ZUMBOPAY_RECONCILE_MAX_AGE_HOURS` e
> `ZUMBOPAY_RECONCILE_BATCH`.

---

## 17. Endpoints propostos (não implementados)

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/v1/payments/webhook/zumbopay/` | POST | Webhook — equivalente ao `webhook/paysuite/` |
| `/api/v1/payments/charge/` | POST | *(opcional)* Fluxo STK — devolve `pending` em vez de `checkout_url` |
| `/api/v1/payments/validate-gateway/` | GET | *(admin)* Envolve `GET /merchant/validate` |
| `/api/v1/wallet/admin/payouts/<pk>/dispatch/` | POST | *(opcional)* Substitui o `pay_payout` manual por `POST /payouts` |

*(O endpoint de reconciliação proposto na §15.5 foi implementado — ver §18.)*

---

## 18. Reconciliação — a rede de segurança do webhook

> ✅ **Implementado.** Esta secção substitui a lacuna descrita em §15.5.

### 18.1 O problema

Todo o circuito de cobrança dependia de um único evento: o webhook `payment.succeeded`.
Se esse POST se perder (rede do lado do gateway, deploy no momento exacto, URL mal
registado, secret trocado), o comprador via o dinheiro sair da conta e a encomenda
ficava para sempre em `pending` — sem liquidação ao vendedor e sem crédito ao
comprador. Ninguém era avisado: não havia erro nenhum, apenas silêncio.

### 18.2 A solução

O sistema passou a poder **perguntar** ao gateway, em vez de esperar que ele avise.

| Peça | Papel |
|---|---|
| `services/references.py` | Uma única fonte de verdade para o mapeamento gateway ⇄ encomenda. O webhook e a reconciliação usam exactamente as mesmas funções, pelo que não podem divergir. |
| `services/reconciliation.py` | Interroga o gateway pelo estado real de cada checkout pendente e decide o que fazer. |
| `services/completion.py` | A liquidação (`complete_payment`) continua a ser a única porta de entrada — a reconciliação não tem caminho paralelo. |
| `tasks.py` | Tarefa Celery `reconcile_pending_payments`. |
| `views.py` → `PaymentsReconcileView` | `POST /api/v1/payments/reconcile/` *(só admin)* — para quando o comprador reclama e não se pode esperar. |
| `management/commands/reconcile_payments.py` | `manage.py reconcile_payments` — para ambientes sem Celery/Redis. |

### 18.3 Como se comporta

1. Reúne os checkouts pendentes com **duas fontes**: as transacções `zumbopay:` pendentes
   e, em fallback, as encomendas com método de gateway e referência gravada. O fallback
   cobre o caso de a linha de auditoria se ter perdido.
2. Aplica uma **janela de idade bilateral**: ignora o que é mais recente que
   `ZUMBOPAY_RECONCILE_MIN_AGE_MINUTES` (não vale a pena competir com um webhook que está
   a chegar) e desiste do que é mais antigo que `ZUMBOPAY_RECONCILE_MAX_AGE_HOURS`
   (uma ligação abandonada não deve ser sondada para sempre) — esses são contados à parte
   e ficam para decisão humana.
3. Pergunta o estado ao gateway e mapeia-o. **Um estado desconhecido é tratado como
   pendente, nunca como pago** — o sistema só confirma dinheiro quando o gateway o afirma.
4. Se estiver pago, fecha a encomenda pelo mesmo caminho do webhook: liquida o vendedor e
   notifica comprador e vendedor. Se estiver recusado, marca a falha.
5. É **idempotente**: correr a reconciliação depois de o webhook ter chegado não credita
   nada duas vezes.

Cada execução devolve um resumo (`candidatos, verificados, pagos, falhados, pendentes,
erros, fora do prazo`) que é registado nos logs, para a operação conseguir perceber se a
rede de segurança está a apanhar alguma coisa.

### 18.4 Assinatura do webhook — falha fechada

O webhook deixou de aceitar pedidos não assinados. Quando
`ZUMBOPAY_WEBHOOK_SECRET` está definido (o caso normal), a assinatura HMAC-SHA256 é
verificada e uma assinatura inválida devolve `400`. Quando **não** está definido:

| Ambiente | Comportamento |
|---|---|
| `DEBUG = True` | Assinatura ignorada e registado um aviso — o desenvolvimento local funciona sem configurar o gateway. |
| `DEBUG = False` | Pedido recusado com `503` e registado um erro crítico. |

Esta inversão só foi possível **por causa da §18**: antes, recusar um webhook por falta de
configuração significava dinheiro perdido em silêncio, e aceitar tudo era o mal menor.
Agora um webhook recusado é apanhado pela reconciliação, pelo que a opção segura deixou
de ter custo.

### 18.5 O que continua em aberto

- O formato real do payload do webhook continua por confirmar contra o gateway (a
  documentação pública não o descreve), pelo que o mapeamento para as encomendas é
  tolerante por desenho.
- Sem credenciais reais o circuito foi validado apenas com o gateway simulado.

---

## 19. Checklist de prontidão

### 19.0 Estado verificado contra a conta real (2026-10)

`GET /merchant/validate` com as credenciais de produção devolveu:

| Verificação | Resultado |
|---|---|
| `X-Merchant-Id` aceite | ✅ `MCH_BF00…57` (mascarado — o repo é público) |
| API Key | ✅ `zk_live_…` (ambiente **live** — cobra dinheiro real) |
| Escopos | ✅ `payments:read/write`, `wallets:read`, `payouts:write`, `webhooks:write` |
| `ready` | ❌ `false` — `missing: ["wallet_emola", "wallet_card"]` |
| Carteiras | M-Pesa ✅ (`wallet_code 996183`) · e-Mola ❌ · Cartão ❌ |
| Webhook registado | ⚠️ `https://e-shoppingcentre.com` — **falta o caminho**, ver §19.1 |
| Eventos subscritos | ✅ inclui `payment.succeeded`, `payment.failed`, `payment.refunded` |

**Consequência imediata:** só o **M-Pesa** pode ser cobrado. O checkout passou a oferecer
apenas esse método — e-Mola e cartão ficaram desactivados em
`frontend/src/components/CheckoutContent.tsx` (blocos comentados, prontos a reactivar
quando as carteiras existirem no painel).

> **Desambiguação do `wallet_id`.** O painel rotula `996183` como «Wallet ID», mas
> `GET /wallets` mostra que esse valor é o `wallet_code`; o `wallet_id` é o UUID
> (`98c3c1f2-…`), tal como `GET /merchant/validate` o devolve. É o **UUID** que vai no
> pedido de pagamento — é o campo que a própria API chama `id`. A frase da documentação
> pública («wallet_id: códigos de 6 dígitos») refere-se ao que se copia do painel, não ao
> valor da API.

### 19.1 Lacuna bloqueante encontrada na produção

⚠️ **O backend em produção ainda é o código anterior ao ZumboPay.** Prova directa no
domínio:

| Rota | Resposta | Leitura |
|---|---|---|
| `GET /api/v1/payments/webhook/paysuite/` | `405` | a rota antiga **existe** |
| `GET /api/v1/payments/webhook/zumbopay/` | `404` | a rota nova **não existe** |
| `GET /api/v1/payments/reconcile/` | `404` | idem |

Ou seja: o gateway está registado para entregar em `https://e-shoppingcentre.com`
(sem caminho) e o backend que lá corre nem sequer serve o endpoint novo. Um pagamento
feito hoje seria cobrado e **nunca confirmado pelo caminho normal** — ficaria preso até
a reconciliação correr, e a reconciliação também ainda não está lá.

**Ordem de correcção (todas obrigatórias antes de aceitar dinheiro real):**

1. No Painel ZumboPay → Programadores, corrigir o webhook para
   `https://e-shoppingcentre.com/api/v1/payments/webhook/zumbopay/`.
2. Fazer deploy do backend actual (traz o webhook ZumboPay, a reconciliação e a
   assinatura com falha fechada).
3. Confirmar com `GET /api/v1/payments/gateway/`: `webhook_url_ok: true`.
4. Garantir que o Celery beat está a correr, para a reconciliação funcionar como rede
   de segurança.

### 19.2 Checklist

- [x] `Merchant ID`, API Key (`zk_live_`) e Webhook Secret obtidos no painel
- [x] Webhook Secret preenchido em `backend/.env` — obrigatório, sem ele responde 503
- [x] `wallet_id` do M-Pesa obtido (`GET /merchant/validate`)
- [ ] `GET /merchant/validate` devolve `ready: true` com `missing: []` — falta criar as carteiras de e-Mola e cartão
- [x] Checkout oferece apenas métodos com carteira (só M-Pesa, por agora)
- [ ] Webhook corrigido para `https://e-shoppingcentre.com/api/v1/payments/webhook/zumbopay/` (§19.1)
- [ ] Backend actual (com webhook ZumboPay + reconciliação) em deploy no servidor de produção (§19.1)
- [ ] Celery beat a correr em produção, para a reconciliação funcionar
- [x] Checkout deixa de oferecer e-Mola e cartão enquanto não tiverem carteira
- [ ] Decidido se o ZumboPay **substitui** ou **coexiste** com o PaySuite
- [ ] Rentabilidade modelada com a comissão de 8% sobreposta às margens actuais
- [ ] Decidido o mínimo de saque à luz do mínimo de 500 MT do payout manual
- [ ] Confirmado que o split **não** será usado em produtos físicos (escrow)
- [x] Nomes de eventos mapeados — o webhook registado já subscreve `payment.succeeded` / `payment.failed`
- [x] Rede de segurança activa: reconciliação em §18 (beat, endpoint admin e comando)
- [x] Webhook falha fechado sem `ZUMBOPAY_WEBHOOK_SECRET` (ver §18.4)
- [x] Carrinho preservado até ao pagamento ser confirmado (ver §20)

---

## 20. O carrinho durante o pagamento — porque é que não se esvazia

### 20.1 O defeito

Até esta revisão, o carrinho era esvaziado no instante em que o cliente era enviado
para o checkout hospedado do ZumboPay. O raciocínio por trás disso estava errado:
confundia **iniciar** um pagamento com **ter** pago.

Consequência prática — e é a queixa real do negócio: um cliente em M-Pesa que
desistisse na página do gateway, ou a quem o pagamento falhasse, voltava ao site com
o carrinho vazio. Tinha de reconstruir a compra de zero. Pior: como o carrinho
sincroniza com o backend para a recuperação de carrinhos abandonados
(`POST /orders/cart/sync/`, que **substitui** os artigos guardados), o carrinho vazio
apagava também o registo de abandono que alimenta as campanhas de recuperação. A
perda era dupla.

### 20.2 A regra actual

> Um pagamento iniciado não é um pagamento feito. O carrinho só é limpo quando o
> pagamento for **confirmado** — e, quando o é, apenas saem os artigos que esse
> pagamento cobriu.

| Momento | Carrinho |
|---|---|
| Encomenda criada, pagamento online iniciado (M-Pesa) | **Preservado** |
| Cliente desiste na página do gateway | Preservado |
| Pagamento falha (`payment.failed`) | Preservado |
| Gateway devolve erro ou não devolve link de pagamento | Preservado |
| Pagamento **confirmado** (webhook, ou polling do estado) | Saem **só** os artigos pagos |
| Encomenda concluída em método offline (`bank`, `cash`) | Esvaziado — o checkout terminou |
| Pagamento imediato (`test`, `wallet`) | Esvaziado — o pagamento já ocorreu |

Os artigos que o cliente tenha acrescentado ao carrinho **depois** de pagar ficam
intactos. A limpeza é cirúrgica (`removeProducts`), não total.

### 20.3 Como o sistema sabe

`POST /payments/initiate/` é a única altura em que o par
«referência do checkout ↔ artigos» é conhecido. Fica guardado localmente
(`eshoppingcentre-pending-checkout-v1`): a referência, os ids dos produtos e a data.
O ciclo fecha-se no primeiro sítio onde a confirmação se torna visível:

| Onde | Como |
|---|---|
| `/checkout/success` | O polling do estado devolve `completed` |
| `/account/orders/[id]` | A encomenda carregada já tem `payment_status = completed` — tipicamente confirmada pelo webhook sem o cliente ver |
| `/cart` | Resolve o caso ambíguo: consulta o estado e, se já estiver pago, limpa; se não, avisa que há um pagamento por concluir |

O terceiro caso é o mais importante na prática: o webhook confirma pagamentos sem o
cliente saber, pelo que era preciso um sítio onde essa confirmação fosse finalmente
notada. O carrinho é exactamente onde isso faz diferença — e é lá que o cliente
poderia ser levado a comprar outra vez o que já pagou.

O registo expira ao fim de **7 dias** e é substituído por cada novo checkout, para
que um marcador esquecido não venha a remover artigos de uma compra futura.

### 20.4 Limites conhecidos

- **Sem sessão não há verificação.** O carrinho de um cliente anónimo nunca é limpo
  automaticamente, porque não há como consultar o estado do pagamento sem conta (e
  forçá-lo redireccionaria para o login). Os artigos permanecem — a falha é sempre
  para o lado de guardar, nunca de apagar.
- **Se o cliente pagar e nunca voltar ao site**, o carrinho mantém-se até à primeira
  visita a uma das três páginas acima, ou até expirar.
- O risco residual é o inverso do original: com o carrinho preservado, um cliente
  desatento pode repetir o checkout e criar uma **segunda encomenda**. É por isso que
  o aviso de pagamento pendente aparece no carrinho, apontando para as encomendas.

---

## Anexo A — Eventos de webhook

| Evento | Âmbito |
|---|---|
| `payment.succeeded` | Cobrança — **o crítico** |
| `payment.failed` | Cobrança |
| `payment.refunded` | Reembolso |
| `payout.completed` | Payout |
| `payout.failed` | Payout |
| `kyc.status_changed` | Conta |
| `subscription.created` · `mandate_accepted` · `activated` | Recorrentes |
| `subscription.charged` · `paused` · `resumed` · `ended` · `failed` | Recorrentes |
| `subscription.cancelled` | Recorrentes |

Mapeamento directo para o handler actual: `payment.succeeded` → `_handle_success`;
`payment.failed` → `_handle_failed`. Os restantes (payout/refund/subscription) podem ser
registados para auditoria — tal como o `PaysuiteWebhookView` já faz hoje.

## Anexo B — Glossário de identificadores

| Termo | O que é |
|---|---|
| **Merchant ID** | `MCH_…` — a conta do comerciante |
| **API Key** | `zk_live_…` / `zk_test_…` — autentica pedidos |
| **`wallet_id`** | UUID da carteira **por método** — onde o valor é creditado |
| **`wallet_code`** | 6 dígitos — alternativa ao UUID em `/payments` |
| **Webhook Secret** | `whsec_…` — assina os webhooks |
| **`source_id`** | Chave de idempotência em `/charges` |
| **`reference`** | `ZP…` / `ZP_AB12CD34` — a referência do gateway |
| **`auto_dispatch`** | Payout B2C instantâneo (só M-Pesa) |

## Anexo C — Fontes

| Fonte | URL |
|---|---|
| Documentação API oficial | <https://zumbopay.com/documentacao> |
| Documentação completa (requer login) | <https://zumbopay.com/app/developers/docs> |
| Contrato do gateway actual (PaySuite) | <https://paysuite.tech/docs/> |
| Mapeamento do gateway actual | `PAYSUITE_GATEWAY_IMPLAMATATION.md` |
| Circuito de saques actual | `MAPEAMENTO_CIRCUITO_SAQUES_DINHEIRO.md` |

> ⚠️ A documentação pública indica que existe uma versão mais completa atrás de login. Esse
> material pode acrescentar detalhe a payouts, split e recorrentes — vale a pena consultar
> antes de qualquer implementação.
