# Mapeamento do Circuito de Saques e Dinheiro — eShoppingCentre

> Documento de levantamento técnico do circuito monetário da plataforma (carteira, comissões, escrow e saques), cobrindo **clientes (compradores)**, **vendedores**, **afiliados** e o **admin** da plataforma.
> Âmbito: **backend** (Django + DRF + Celery) e **frontend** (Next.js App Router).
> Data do levantamento: 2026-10-11.

---

## 1. Sumário Executivo

A plataforma usa um modelo monetário **manual** (estilo Jumia/Etsy/Shopify manual payout):

1. **Todo o dinheiro real** é cobrado na conta do **admin** (M-Pesa, e-Mola, transferência bancária, cartão) ou em dinheiro na entrega (cash on delivery).
2. A **carteira** (`Wallet`) é um **livro-razão interno e auditável** do que é devido a cada parte — não é uma conta bancária nem processa pagamentos reais.
3. Os **saques** são **manuais**: o vendedor/afiliado pede o saque, o admin paga fora do sistema (M-Pesa/e-Mola/bank) e depois marca o saque como **pago** no painel, registando a referência.

**Estado geral**: o esqueleto do circuito (modelos, serviços, endpoints, UI) está largamente implementado e coeso, mas **falta o elo crítico** que liga o pagamento real à carteira: **nenhum caminho de código em produção marca `Order.payment_status = "completed"`** (só o método `test` o faz). Consequentemente, `settle_payment`, a criação de escrow e o crédito do vendedor **nunca disparam para pagamentos reais**.

Existe ainda **duplicação**: dois subsistemas de saque paralelos (a carteira `PayoutRequest` vs. o `AffiliatePayout` dos afiliados) e endpoints de admin falsos ("stubs") que coexistem com os endpoints reais.

---

## 2. Arquitetura e Modelo de Dados

### 2.1 Aplicações relevantes (backend)

| App | Papel no circuito |
|-----|-------------------|
| `wallet` | Núcleo: `Wallet`, `WalletTransaction`, `WalletEntry`, `EscrowHolding`, `PayoutRequest` e toda a camada de serviços de mutação monetária. |
| `orders` | Criação de encomendas, `settle_payment`, escrow, confirmação de entrega, cancelamento, devolução/reembolso, override admin e tarefas Celery. |
| `affiliates` | Circuito paralelo de comissões e saques de afiliados (`AffiliateProfile`, `AffiliateCommission`, `AffiliatePayout`, `AffiliateKYC`, `AffiliateSettings`). |
| `payments` | `PaymentTransaction` + webhooks (M-Pesa e Stripe) — **não ligados** à conclusão do pagamento da encomenda. |
| `stores` | `views_earnings.py` expõe estatísticas/ganhos do vendedor a partir da carteira. |
| `users` | `signals.py` cria a carteira em cada utilizador; `views_admin.py` contém **stubs** de payout do admin. |
| `notifications` | `email_service.py` com emails de payout/comissão/KYC. |

### 2.2 Modelos centrais (`backend/apps/wallet/models.py`)

| Modelo | Campos-chave | Observações |
|--------|-------------|-------------|
| `Wallet` | `balance` (comprador), `payout_balance` (saque virtual), `reserved_balance` (bloqueado em pedidos de saque), `total_earned`, `total_withdrawn`, `is_active` | Criado para **todos** os utilizadores via `users/signals.py` (post_save). |
| `WalletTransaction` | `type` (sale/commission/affiliate_commission/withdrawal/fee/refund/bonus), `status` (pending/completed/failed), `balance_before/after`, `reference_type/reference_id` | Sem chave de idempotência (prevista no plano, não implementada). |
| `WalletEntry` | direção `debit`/`credit`, `kind` (`buyer`/`payout`/`platform`), `balance_before/after` | **Não é double-entry verdadeiro**: uma entrada por transação, sem conta contraparte ⇒ Σdébitos ≠ Σcréditos por construção. |
| `EscrowHolding` | `order` FK, `amount`, `status` (held/released/reversed), `released_at` | Apenas bens físicos. |
| `PayoutRequest` | `user`, `role` (seller/affiliate), `amount`, `method` (mpesa/emola/bank), `account_details` (JSON), `status` (pending/approved/paid/rejected), `approved_by`, `paid_by`, `admin_reference`, `approved_at`, `paid_at`, `rejection_reason`, `notes` | Saque do circuito da carteira. |

Modelos do circuito dos afiliados (`backend/apps/affiliates/models.py`):

| Modelo | Observações |
|--------|-------------|
| `AffiliateProfile` | `available_commission` = `total_commission − total_withdrawn` (property). |
| `AffiliateCommission` | pending → approved (Celery após `approve_after_days`=7, ou admin). **Nunca credita a carteira.** |
| `AffiliatePayout` | Saque separado; sem reserva de saldo. |
| `AffiliateKYC` | Gate de verificação para afiliados. |
| `AffiliateSettings` | `min_payout_amount` (500 MZN), `approve_after_days` (7), `payout_fee_percent` (default 0) — **`payout_fee_percent` definido mas nunca aplicado**. |

`payments.PaymentTransaction`: regista movimentos do M-Pesa/Stripe, mas não é usado para concluir encomendas.

---

## 3. Circuito Completo do Dinheiro (passo a passo)

### 3.1 Check-out e pagamento

- **Frontend** (`frontend/src/components/CheckoutContent.tsx`): métodos `mpesa`, `emola`, `bank`, `card`, `cash`; estado default `useState('test')` (linha ~140). **Não há opção de pagar com saldo da carteira.**
- **Backend** (`orders/serializers.py`): criação da encomenda.
  - `is_test = payment_method == 'test'` (~linha 372).
  - `platform_fee = (store_total * 8) / 100` (~linha 383) — **8% hardcoded**.
  - `payment_status = "completed"` **apenas se `test`** (~linha 372).
  - `_process_delivery(order)` e `settle_payment(order)` só são chamados quando `payment_status == "completed"` (~linha 490).

> **Falha crítica**: em produção, `payment_status` nunca se torna `"completed"`. O webhook M-Pesa cria apenas um `PaymentTransaction` e **não consegue mapear o payload para uma encomenda**; o webhook Stripe é no-op. Logo, **nada de escrow/crédito acontece para pagamentos reais**.

### 3.2 Liquidação do pagamento (`wallet/services.py`)

`settle_payment(order)` (linhas 90–113):
- `net = total − platform_fee − affiliate_commission`.
- **Bens físicos** → cria `EscrowHolding(status="held")`.
- **Digitais/cursos** → crédito imediato `credit(kind="payout")` ao vendedor.

### 3.3 Escrow e libertação

- `release_escrow(escrow)` (117–131): liberta quando a janela de devolução termina.
- Celery `release_escrow_after_return_window`: liberta quando `order.status == "delivered"` e `delivered_at <= now − 7 dias` (`ESCROW_RELEASE_DAYS=7`).
- Celery `auto_confirm_delivery`: entrega automática após `AUTO_DELIVERY_DAYS=7`.

### 3.4 Cancelamento, devolução e reembolso

- **CancelOrderView** (`orders/views.py:212`): status pending/confirmed; repõe stock + StockLog; `reverse_escrow`; credita o comprador com `order.total` (`kind="buyer"`, transação `refund`) se o pagamento estava concluído; `reject_commissions_for_order`.
- **RefundReturnView** (~484): exige `status == "received"` (não `disputed`); chama `process_refund(...)` em transação atómica; marca devolução como reembolsada; rejeita comissões de afiliados; revoga downloads/cursos; notificação + email.
- `process_refund(...)` (145–154): reverte escrow se held, senão debita o vendedor, depois credita o comprador.
- Celery `auto_refund_unprocessed_returns`: devoluções não processadas em 3 dias; saldo insuficiente → status `disputed`.
- **AdminOverrideView** (613) ação `refund`: marca status refunded + `refund_amount`, rejeita comissões, revoga downloads/cursos — **NÃO move dinheiro** (não chama `process_refund`, não credita carteira). ⚠️ Inconsistente.

### 3.5 Comissões de afiliados

- `AffiliateCommission` criado após `settle_payment` (prorrateado por loja).
- pending → approved via Celery `auto_approve_affiliate_commissions` (após `approve_after_days`=7) ou admin (`PATCH /affiliates/admin/affiliates/commissions/<pk>/`).
- Aprovação → `total_commission += valor`. Clawback (`clawback_days`=30) → `total_commission −= valor`.
- **Nunca credita `Wallet`** — o circuito do afiliado é totalmente paralelo.

### 3.6 Pedido de saque

- **Vendedor** → `wallet.services.request_payout(role="seller")` (161–195): valida `0 < amount ≤ available` (= `payout_balance − reserved_balance`), cria `PayoutRequest`, incrementa `reserved_balance`, envia email ao admin (on_commit).
- **Afiliado** → `POST /affiliates/me/payouts/`: `IsVerified` + KYC aprovado + `amount ≥ min_payout_amount` (500 MZN) + `amount ≤ available_commission`; cria `AffiliatePayout` **sem reserva**.

### 3.7 Aprovação e pagamento (admin)

- `wallet.approve_payout` (198–206): pending → approved; apenas carimba admin + timestamp (**não é load-bearing** para o dinheiro).
- `wallet.pay_payout` (209–245): aceita status pending **ou** approved; liberta `reserved_balance`; valida `payout_balance ≥ amount`; debita `payout_balance`; incrementa `total_withdrawn`; escreve transação `withdrawal` + `WalletEntry` débito; marca paid/paid_by/paid_at/admin_reference; email `send_payout_paid_email` (on_commit).
- `wallet.reject_payout` (248–257): pending/approved → rejected + motivo; liberta `reserved_balance`; email `send_payout_rejected_email`.
- **Afiliado (admin)** → `PATCH /affiliates/admin/affiliates/payouts/<pk>/` ação `approve` → status **`paid`** diretamente + `total_withdrawn += amount` (passo único, sem ledger, sem reserva); ação `reject` → rejected + notes.

### 3.8 Reconciliação (admin)

`AdminReconciliationView` retorna: `collected_total`, `platform_fees`, `affiliate_commissions`, `payouts_paid`, `payouts_pending`, `escrow_held`, `wallets_payout_balance`, `wallets_reserved_balance`, `wallets_buyer_balance`, `liabilities` (payout + reserved + escrow + pending).

---

## 4. Fluxos por Papel

### 4.1 Comprador (Cliente)

| Camada | Implementado | Estado |
|--------|-------------|--------|
| Backend | Carteira criada em post_save; saldo de reembolsos via `wallet.balance`; crédito em cancelamento/devolução. | ✅ |
| Frontend | `frontend/app/account/page.tsx` mostra "Saldo de reembolsos" (`wallet.balance`, linha ~70) e `total_spent` (linha ~114). | ✅ |
| Frontend | **Página dedicada de carteira do comprador** (histórico de transações). | ❌ Inexistente |
| Checkout | Pagar **com** saldo da carteira. | ❌ Não suportado |

### 4.2 Vendedor

| Camada | Implementado | Estado |
|--------|-------------|--------|
| Backend | `settle_payment` → escrow (físico) ou crédito imediato (digital/curso); `Wallet.payout_balance`; `request_payout(role="seller")`; `pay_payout`. | ✅ |
| Backend | `stores/views_earnings.py` (StoreStatsView, StoreEarningsView) lê `wallet.transactions.filter(type="sale")`. | ✅ |
| Frontend | `frontend/app/seller/earnings/page.tsx`: saldo disponível, modal "Solicitar Saque" (mpesa/emola/bank com telefone/dados), histórico de transações. | ✅ |
| Frontend | **Histórico de saques do vendedor** (só afiliado tem "Meus Saques"). | ❌ Em falta |

### 4.3 Afiliado

| Camada | Implementado | Estado |
|--------|-------------|--------|
| Backend | Comissões (pending → approved → `total_commission`); KYC; `AffiliatePayout` com `min_payout_amount`; ação admin approve→paid. | ✅ |
| Backend | **Unificação com a carteira** (`wallet.services.credit` para afiliados). | ❌ Não ligado |
| Backend | `payout_fee_percent` aplicado. | ❌ Definido mas inutilizado |
| Frontend | `frontend/app/affiliate/earnings/page.tsx`: gate KYC, `available_commission`, pedido de saque, lista "Meus Saques". | ✅ |

### 4.4 Admin

| Camada | Implementado | Estado |
|--------|-------------|--------|
| Backend | `wallet` admin: `GET admin/payouts/`, `POST admin/payouts/<pk>/approve|pay|reject/`, `GET admin/reconciliation/`. | ✅ |
| Backend | `affiliates` admin: aprovar comissão, payout approve→paid, KYC action. | ✅ |
| Frontend | `frontend/src/components/admin/AdminWallet.tsx` — UI completa (lista, aprovar, marcar pago com referência, rejeitar com motivo, reconciliação). | ✅ |
| Frontend | `frontend/src/components/admin/AdminAffiliates.tsx` — 5 abas (affiliates/commissions/payouts/kyc/settings). | ✅ |
| Backend | **Stubs**: `users/views_admin.py` `PendingPayoutsView` (retorna `[]`) e `ApprovePayoutView` (fake `{'status':'approved'}`). | ⚠️ Dead code |
| Frontend | `api.ts` `adminAPI.pendingPayouts()` (l.782) e `approvePayout()` (l.783) apontam para os stubs; **nenhum componente as chama**. | ⚠️ Dead code |

---

## 5. Inventário de Endpoints

### 5.1 Carteira (`/api/v1/wallet/`)

| Método | Rota | Acesso | Estado |
|--------|------|--------|--------|
| GET | `me/` | autenticado | ✅ |
| GET | `me/transactions/` | autenticado | ✅ |
| GET/POST | `me/payouts/` | autenticado + `IsVerified` (afiliado requer KYC) | ✅ |
| GET | `admin/payouts/` | `IsAdminUser` | ✅ |
| POST | `admin/payouts/<pk>/approve/` | `IsAdminUser` | ✅ |
| POST | `admin/payouts/<pk>/pay/` | `IsAdminUser` | ✅ |
| POST | `admin/payouts/<pk>/reject/` | `IsAdminUser` | ✅ |
| GET | `admin/reconciliation/` | `IsAdminUser` | ✅ |

### 5.2 Afiliados (`/api/v1/affiliates/`)

| Método | Rota | Estado |
|--------|------|--------|
| POST | `me/payouts/` | ✅ |
| GET | `me/payouts/` | ✅ |
| GET | `admin/affiliates/payouts/` | ✅ |
| PATCH | `admin/affiliates/payouts/<pk>/` (approve→paid / reject) | ✅ |
| PATCH | `admin/affiliates/commissions/<pk>/` | ✅ |
| POST | `admin/affiliates/kyc/<pk>/` | ✅ |

### 5.3 Stubs duplicados (⚠️)

| Método | Rota | Estado |
|--------|------|--------|
| GET | `/api/v1/admin/payouts/pending/` | ⚠️ stub (`[]`) |
| POST | `/api/v1/admin/payouts/<pk>/approve/` | ⚠️ stub (fake approved) |
| GET | `/api/v1/users/admin/payouts/pending/` | ⚠️ stub |
| POST | `/api/v1/users/admin/payouts/<pk>/approve/` | ⚠️ stub |

> **Três famílias** de rotas de payout do admin coexistem: a real (wallet) + duas famílias de stubs (`users/urls.py` e `users/urls_admin.py`).

### 5.4 Pagamentos (`/api/v1/payments/`)

| Método | Rota | Estado |
|--------|------|--------|
| POST | M-Pesa webhook | ⚠️ cria `PaymentTransaction` apenas; **não conclui a encomenda** |
| POST | Stripe webhook | ⚠️ no-op (`{'status':'ok'}`) |

---

## 6. Tarefas Celery Relevantes (todas horárias — `config/settings/base.py` l.225–262)

| Tarefa | Função |
|--------|--------|
| `auto_refund_unprocessed_returns` | Reembolso automático de devoluções (3 dias; saldo insuficiente → `disputed`). |
| `auto_confirm_delivery` | Entrega automática após `AUTO_DELIVERY_DAYS=7`. |
| `recover_abandoned_carts` | Recupera carrinhos abandonados (24h). |
| `auto_approve_affiliate_commissions` | Aprova comissões após `approve_after_days=7`. |
| `release_escrow_after_return_window` | Liberta escrow após `ESCROW_RELEASE_DAYS=7`. |

---

## 7. Legenda de Estado

| Símbolo | Significado |
|---------|-------------|
| ✅ | Implementado e funcional |
| ⚠️ | Parcial / stub / dead code / inconsistente |
| ❌ | Em falta / não integrado |

---

## 8. Lacunas, Riscos e Bugs

1. **🔴 Webhook nunca conclui a encomenda**: nenhum caminho marca `Order.payment_status="completed"` em produção (só `payment_method="test"`). Logo `settle_payment`, escrow e crédito do vendedor **nunca disparam para pagamentos reais**. O M-Pesa webhook não consegue mapear o payload para uma encomenda.
2. **🟠 `AdminOverrideView` (refund) não move dinheiro** — inconsistente com `RefundReturnView` e `auto_refund_unprocessed_returns`.
3. **🟠 Dois sistemas paralelos de saque** (wallet `PayoutRequest` vs `AffiliatePayout`) **não unificados** — `wallet.services.credit` nunca é chamado para afiliados; afiliado não tem saldo em carteira.
4. **🟠 Endpoints de admin stub duplicados** (`/api/v1/admin/payouts/...` e `/api/v1/users/admin/payouts/...`) devolvem dados falsos; frontend ainda os declara em `api.ts` (dead code).
5. **🟡 `payout_fee_percent`** (AffiliateSettings) definido mas **nunca aplicado**.
6. **🟡 Sem idempotência** em `WalletTransaction` (prevista no plano, não implementada).
7. **🟡 `WalletEntry` não é double-entry verdadeiro** — sem conta contraparte, Σdébitos ≠ Σcréditos por construção.
8. **🟡 `approve_payout` não é load-bearing** — `pay_payout` aceita pending **ou** approved; um saque pode ser pago sem aprovação prévia.
9. **🟡 `reserved_balance` pode divergir** — ajustado com `max(..., 0)`.
10. **⚪ Frontend**: sem página de carteira do comprador; sem histórico de saques do vendedor; checkout sem opção de pagar com saldo.
11. **⚪ `payment_status`** é `CharField(default="pending")` sem choices nem máquina de estados.
12. **⚪ Sem testes** na app `wallet` (só `users/tests/test_models.py` e `backend/test_roadmap.py`).

---

## 9. Recomendações / Roadmap Sugerido

Alinhado com o `PLANO_CARTEIRA_INTERNA.md` (W1–W5):

1. **W0 — Fechar o elo de pagamento (crítico)**: implementar a conclusão do pagamento no webhook (M-Pesa/Stripe) mapeando o payload para a encomenda (via referência/id de transação) e marcando `payment_status="completed"` de forma idempotente. Isto desbloqueia `settle_payment`, escrow e crédito do vendedor.
2. **Unificar afiliados na carteira**: fazer `AffiliateCommission`/`AffiliatePayout` passarem por `wallet.services.credit/debit`, eliminando o circuito paralelo (ou documentar formalmente a separação como decisão de arquitetura).
3. **Remover stubs**: apagar `PendingPayoutsView`/`ApprovePayoutView` de `users/views_admin.py`, as rotas duplicadas e as funções mortas em `frontend/src/lib/api.ts`.
4. **Tornar `approve_payout` load-bearing** ou remover o passo: `pay_payout` deveria exigir aprovação prévia (ou documentar o fluxo de pagamento direto).
5. **Aplicar `payout_fee_percent`** e expor no cálculo de saque do afiliado.
6. **Corrigir `AdminOverrideView` (refund)** para chamar `process_refund` (mover dinheiro), consistente com os restantes fluxos.
7. **Adicionar idempotência** (chave única) e testes ao `WalletTransaction`.
8. **Rever `WalletEntry`** para double-entry real (com conta contraparte) ou renomear para deixar clara a semântica.
9. **Frontend**: página de carteira do comprador com histórico; histórico de saques do vendedor; opção de pagar com saldo no checkout.

---

## 10. Ficheiros Relevantes

- [backend/apps/wallet/models.py](d:/Projectos/eShoppingCentre-main/backend/apps/wallet/models.py) — modelo de dados completo.
- [backend/apps/wallet/services.py](d:/Projectos/eShoppingCentre-main/backend/apps/wallet/services.py) — todas as mutações monetárias.
- [backend/apps/wallet/views.py](d:/Projectos/eShoppingCentre-main/backend/apps/wallet/views.py) — endpoints de carteira e admin.
- [backend/apps/wallet/serializers.py](d:/Projectos/eShoppingCentre-main/backend/apps/wallet/serializers.py) — `available_payout`, `total_spent`.
- [backend/apps/wallet/urls.py](d:/Projectos/eShoppingCentre-main/backend/apps/wallet/urls.py) — rotas.
- [backend/apps/users/views_admin.py](d:/Projectos/eShoppingCentre-main/backend/apps/users/views_admin.py) — **stubs** de payout.
- [backend/apps/users/urls.py](d:/Projectos/eShoppingCentre-main/backend/apps/users/urls.py) / [backend/apps/users/urls_admin.py](d:/Projectos/eShoppingCentre-main/backend/apps/users/urls_admin.py) — rotas stub duplicadas.
- [backend/apps/orders/serializers.py](d:/Projectos/eShoppingCentre-main/backend/apps/orders/serializers.py) — criação de encomenda, `platform_fee` 8%, `settle_payment`.
- [backend/apps/orders/views.py](d:/Projectos/eShoppingCentre-main/backend/apps/orders/views.py) — cancelamento, devolução, reembolso, override admin.
- [backend/apps/orders/tasks.py](d:/Projectos/eShoppingCentre-main/backend/apps/orders/tasks.py) — tarefas Celery do circuito.
- [backend/apps/affiliates/models.py](d:/Projectos/eShoppingCentre-main/backend/apps/affiliates/models.py) — comissões, payout, KYC, settings.
- [backend/apps/affiliates/views.py](d:/Projectos/eShoppingCentre-main/backend/apps/affiliates/views.py) — endpoints de afiliados/admin.
- [backend/apps/affiliates/services.py](d:/Projectos/eShoppingCentre-main/backend/apps/affiliates/services.py) / [tasks.py](d:/Projectos/eShoppingCentre-main/backend/apps/affiliates/tasks.py) — aprovar/clawback de comissões.
- [backend/apps/affiliates/urls.py](d:/Projectos/eShoppingCentre-main/backend/apps/affiliates/urls.py) — rotas de afiliados.
- [backend/apps/payments/views.py](d:/Projectos/eShoppingCentre-main/backend/apps/payments/views.py) — webhooks M-Pesa/Stripe.
- [backend/apps/stores/views_earnings.py](d:/Projectos/eShoppingCentre-main/backend/apps/stores/views_earnings.py) — ganhos do vendedor.
- [backend/config/settings/base.py](d:/Projectos/eShoppingCentre-main/backend/config/settings/base.py) — `CELERY_BEAT_SCHEDULE`.
- [frontend/src/lib/api.ts](d:/Projectos/eShoppingCentre-main/frontend/src/lib/api.ts) — `walletAPI`, `affiliatesAPI`, stubs mortos.
- [frontend/src/components/admin/AdminWallet.tsx](d:/Projectos/eShoppingCentre-main/frontend/src/components/admin/AdminWallet.tsx) — UI admin de saques/reconciliação.
- [frontend/src/components/admin/AdminAffiliates.tsx](d:/Projectos/eShoppingCentre-main/frontend/src/components/admin/AdminAffiliates.tsx) — UI admin de afiliados.
- [frontend/app/seller/earnings/page.tsx](d:/Projectos/eShoppingCentre-main/frontend/app/seller/earnings/page.tsx) — UI do vendedor.
- [frontend/app/affiliate/earnings/page.tsx](d:/Projectos/eShoppingCentre-main/frontend/app/affiliate/earnings/page.tsx) — UI do afiliado.
- [frontend/app/account/page.tsx](d:/Projectos/eShoppingCentre-main/frontend/app/account/page.tsx) — saldo do comprador.
- [frontend/src/components/CheckoutContent.tsx](d:/Projectos/eShoppingCentre-main/frontend/src/components/CheckoutContent.tsx) — checkout/pagamento.
- [PLANO_CARTEIRA_INTERNA.md](d:/Projectos/eShoppingCentre-main/PLANO_CARTEIRA_INTERNA.md) — plano/roadmap original (W1–W5).
- [ESTADO_IMPLEMENTACAO.md](d:/Projectos/eShoppingCentre-main/ESTADO_IMPLEMENTACAO.md) — notas de estado anteriores.
