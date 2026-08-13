# Plano — Carteira Interna da Plataforma

> **eShoppingCentre — Marketplace em Moçambique**
> Documento de planeamento (integração e funcionamento)
> Data: 13 de Agosto de 2026 — **v2: modelo de pagamento manual**
> Base: `PROPOSTA_AFILIADOS_CARTEIRA.md` (Parte 2) + estado actual do código

---

## 1. Objectivo

Transformar a `apps/wallet` na **Carteira Interna** da plataforma — um **ledger contabilístico**
(não um processador de pagamentos), segundo o modelo de marketplaces que **centralizam a cobrança
na conta do operador e pagam manualmente** (Jumia, Mercado Livre/Mercado Pago, Etsy, Shopify com
payout manual).

**Modelo de negócio (realidade do projecto):**
- **Todos os pagamentos de produtos são recebidos na conta do ADMIN** (M-Pesa/e-Mola/banco/cartão).
  Não há transferência automática para vendedores/afiliados (limitações técnicas e geográficas).
- A carteira é um **registo interno** do que cada parte tem **a receber** (saldo virtual).
- **Saques são manuais**: vendedor/afiliado solicita → o admin aprova → o admin faz o **pagamento
  manual** para a conta indicada pelo beneficiário → marca como pago.

Objectivos:
- **Gerir o dinheiro interno de forma auditável** (vendas, comissões, taxas, reembolsos, saques).
- **Proteger comprador e vendedor** com **escrow virtual** (saldo retido até entrega + 7 dias).
- **Suportar saques manuais** com fluxo de aprovação e confirmação de pagamento pelo admin.
- **Reconciliar** (quanto entrou vs. quanto saiu vs. comissões) em qualquer momento.

---

## 2. Estado actual (o que já existe)

| Componente | Estado |
|---|---|
| `Wallet` (user, balance, total_earned, total_withdrawn, is_active) | ✅ Existe |
| `WalletTransaction` (sale/commission/affiliate_commission/withdrawal/fee/refund/bonus; pending/completed/failed) | ✅ Existe |
| `MyWalletView` (`GET /wallet/me/`), `MyTransactionsView` (`GET /wallet/me/transactions/`) | ✅ Existem |
| `WalletPayoutView` (`POST /wallet/me/payouts/`) | ⚠️ **Stub** (não faz nada) |
| Movimento de dinheiro em **devolução** (deduz vendedor + credita comprador) | ✅ Existe (`ProcessReturnRefundView`) |
| `walletAPI` no frontend (myWallet, myTransactions, requestPayout) | ✅ Existe |
| `PaymentTransaction` (provider, status) — registo dos pagamentos recebidos na conta do admin | ✅ Existe |
| `ConfirmDeliveryView` — **credita o vendedor na entrega** | ❌ **Inexistente** |
| `CancelOrderView` — **reembolsa** no cancelamento | ❌ **Inexistente** (só restaura stock e reverte comissão) |
| Double-entry ledger (`WalletEntry`) | ❌ Inexistente |
| Escrow (retenção) | ❌ Inexistente |
| Saque real (payout com aprovação/threshold) | ❌ Inexistente (para vendedor; afiliado tem `AffiliatePayout`) |
| Reconciliação | ❌ Inexistente |

**Nota sobre afiliados:** o sistema de afiliados tem o seu próprio `AffiliatePayout` + `AffiliateCommission`
(com KYC e ciclo de vida já implementados). A carteira deve **unificar** isto: a comissão aprovada do
afiliado é **creditada na carteira**, e os saques debitam a carteira (ver §5 — decisão).

---

## 3. Modelo de dados (novos/alterados)

### 3.1 Alterar `Wallet`
- `balance` → **saldo comprável** (buyer) — recargas futuras, reembolsos.
- `payout_balance` (novo) → **saldo disponível para saque** (vendas do vendedor + comissões do afiliado).
- `total_earned`, `total_withdrawn` mantidos.

### 3.2 Alterar `WalletTransaction`
- Adicionar `idempotency_key` (UniqueConstraint por `reference_type + reference_id + type`) — evita duplicação.
- Adicionar `role` opcional (`buyer | seller | affiliate | platform`) para identificar a "conta lógica".

### 3.3 Novo `WalletEntry` (double-entry ledger)
```python
class WalletEntry(BaseModel):
    wallet = FK(Wallet)
    transaction = FK(WalletTransaction, related_name='entries')
    direction = choices: debit | credit
    amount = Decimal
    balance_before = Decimal
    balance_after = Decimal
    kind = choices: buyer | payout   # qual dos dois saldos foi afectado
```
> Cada `WalletTransaction` gera **duas** `WalletEntry` (débito numa conta, crédito noutra) —
> o sistema fica sempre equilibrado (Σ débitos = Σ créditos).

### 3.4 Novo `PayoutRequest` (saque unificado — pagamento manual)
```python
class PayoutRequest(BaseModel):
    user = FK(User)
    role = choices: seller | affiliate
    amount = Decimal
    method = choices: mpesa | emola | bank
    account_details = JSON            # nº M-Pesa/e-Mola, IBAN, titular, banco...
    status = choices: pending | approved | paid | rejected
    approved_by = FK(User, null)      # admin que aprovou
    paid_by = FK(User, null)          # admin que executou o pagamento manual
    admin_reference = CharField(blank) # referência/confirmação do pagamento manual
    approved_at = DateTime(null)
    paid_at = DateTime(null)
    rejection_reason = Text(blank)
    notes = Text(blank)
```
> O pagamento em si é **manual** (fora da plataforma). O `PayoutRequest` apenas regista o pedido,
> a aprovação e a confirmação do admin de que o dinheiro foi enviado.

### 3.5 Novo `EscrowHolding` (retenção)
```python
class EscrowHolding(BaseModel):
    order = FK(Order, related_name='escrow')
    amount = Decimal
    status = choices: held | released | reversed
    released_at = DateTime(null)
```
> Alternativa mais simples: usar campos `escrow_status`/`escrow_released_at` no próprio `Order`.
> **Recomendação:** usar `EscrowHolding` separado (auditoria independente do ciclo da encomenda).

---

## 4. Fluxos de dinheiro

### 4.1 Compra (pagamento confirmado)
```
Comprador paga directamente à conta do ADMIN (M-Pesa/e-Mola/banco/cartão)
        ↓
PaymentTransaction.completed (registo de que o admin recebeu)
        ↓
EscrowHolding VIRTUAL criado (held) com o total da encomenda
        ↓
[Entrega confirmada + 7 dias de devolução]
        ↓
Escrow LIBERTADO → WalletEntry (double-entry, apenas registos internos):
  - vendedor:  total − platform_fee(8%) − affiliate_commission  → payout_balance
  - plataforma: platform_fee                                      → conta interna
  - afiliado:   affiliate_commission (se houver)                  → payout_balance
```
> O dinheiro está sempre na conta do admin; a "libertação do escrow" apenas **torna o saldo
> disponível para saque** no ledger. Nenhuma transferência automática é feita.

### 4.2 Confirmação de entrega (hoje `ConfirmDeliveryView`)
- Ao confirmar entrega, **libertar o escrow** (ou, sem escrow ainda, **creditar o vendedor** directamente).
- Comissão do afiliado passa a `approved` (já existe em `auto_approve_affiliate_commissions` — alinhar).

### 4.3 Cancelamento (hoje `CancelOrderView`)
- Restaurar stock (já faz).
- Reverter comissão (já faz).
- **NOVO:** reembolsar o comprador (devolver `balance` comprável ou reverter o escrow se `held`).

### 4.4 Devolução (hoje `ProcessReturnRefundView`)
- Já deduz vendedor + credita comprador. **Migrar para `WalletEntry`** (double-entry) para manter o ledger equilibrado.

### 4.5 Saque (payout — 100% manual)
```
1. Vendedor/afiliado solicita saque (≥ threshold) indicando método + conta → PayoutRequest(pending)
2. O saldo correspondente fica RESERVADO (bloqueado) para evitar gasto duplo
3. Admin vê o pedido pendente e a conta de destino
4. Admin aprova → status=approved
5. Admin faz o PAGAMENTO MANUAL (M-Pesa/e-Mola/transferência bancária)
6. Admin regista a referência do pagamento → status=paid → debita payout_balance + total_withdrawn
7. Se recusar → status=rejected (liberta o saldo reservado)
```
> **Não há débito automático na conta bancária da plataforma.** O débito no ledger só é feito
> **depois** de o admin confirmar que o pagamento manual foi realizado.

---

## 5. Integração com afiliados (decisão)

Hoje há **dois** mecanismos de saque: `AffiliatePayout` (afiliado) e o stub da carteira (vendedor).

**Recomendação (unificar):**
1. `AffiliateCommission` aprovada → **creditar** `Wallet.payout_balance` do afiliado (WalletEntry).
2. Saques usam **um único** `PayoutRequest` (role = `affiliate` ou `seller`), mantendo o KYC do afiliado como gate.
3. `AffiliatePayout` passa a ser **depreciado** (ou mantido como histórico), com a carteira como fonte de verdade.

> Alternativa mínima (se preferires não mexer nos afiliados já estáveis): manter `AffiliatePayout`
> separado e só construir a carteira para **vendedores**. Custo: duas fontes de saldo/dois extractos.

---

## 6. Endpoints propostos

```
GET   /api/v1/wallet/me/                    → saldo comprável + payout_balance (alterar serializer)
GET   /api/v1/wallet/me/transactions/       → extracto (já existe)
POST  /api/v1/wallet/me/payouts/            → solicitar saque (implementar de verdade)
── Admin ──
GET   /api/v1/admin/wallet/payouts/         → listar saques pendentes
POST  /api/v1/admin/wallet/payouts/{id}/approve/  → aprovar (estado approved; saldo continua reservado)
POST  /api/v1/admin/wallet/payouts/{id}/pay/      → confirmar pagamento manual (admin_reference) → paid
POST  /api/v1/admin/wallet/payouts/{id}/reject/   → rejeitar (liberta saldo reservado)
GET   /api/v1/admin/wallet/reconciliation/  → relatório (entrou vs. saiu vs. comissões vs. saldos a pagar)
```

---

## 7. Páginas frontend afectadas

| Página | Alteração |
|---|---|
| `frontend/app/account/` (Conta) | Nova secção **"Carteira"** (saldo + extracto + botão saque) |
| `frontend/src/components/AccountLayout.tsx` | Novo item de menu "Carteira" |
| `frontend/app/seller/earnings/` (Ganhos) | Mostrar `payout_balance` + histórico de `WalletTransaction` |
| `frontend/app/seller/settings` ou afiliados | Solicitar saque (threshold + método) |
| `frontend/app/affiliate/earnings` | Unificar com a carteira (se decisão = unificar) |
| `frontend/src/components/admin/AdminDashboard.tsx` | Nova tab "Carteira" (saques + reconciliação) |
| `frontend/src/components/admin/AdminWallet.tsx` (novo) | Gestão de saques + relatório |
| `frontend/src/lib/api.ts` | `walletAPI` expandido (payouts, reconciliation) |

---

## 8. Roadmap de implementação

| Fase | Entregas | Prioridade |
|------|----------|-----------|
| **W1 — Fundações** | `WalletEntry` (double-entry); `payout_balance`; crédito do vendedor na entrega; reembolso no cancelamento; migrar devolução para double-entry | 🔴 Crítica |
| **W2 — Escrow virtual** | `EscrowHolding`; retenção virtual na compra; libertação automática (Celery, após entrega + 7 dias) | 🔴 Crítica |
| **W3 — Payouts manuais** | `PayoutRequest`; solicitar saque; aprovação/rejeição admin; reserva de saldo; KYC (afiliado) | 🔴 Crítica |
| **W4 — Pagamento manual** | Ferramentas do admin para executar/registar o pagamento manual (referência) e marcar como pago | 🟠 Alta |
| **W5 — Reconciliação** | Relatório: entrou na conta admin vs. saiu vs. comissões vs. saldos a pagar | 🟡 Média |

---

## 9. Regras de negócio

| Regra | Valor |
|-------|-------|
| Taxa da plataforma (`platform_fee`) | 8% sobre subtotal (já implementado) |
| Janela de escrow | Entrega + 7 dias (janela de devolução) |
| Comissão do afiliado | Taxa do produto/loja (padrão 10%) — já validada no intervalo global |
| Threshold de saque | 500 MZN (configurável) |
| Reversão em reembolso/cancelamento | Automática (comissões + escrow) |
| Idempotência | Chave única por `reference_type + reference_id + type` |
| Pagamento ao vendedor/afiliado | **Manual** (fora da plataforma), após aprovação do admin |
| Métodos de saque | M-Pesa, e-Mola, transferência bancária |
| KYC | Obrigatório para afiliados antes do 1º saque |
| SLA de aprovação/pagamento | Manual (recomendado ≤ 48h úteis) |
| Reserva de saldo | Ao solicitar saque, o valor fica reservado até pagar/rejeitar |

---

## 10. Recomendação de arranque

Começar por **W1 (Fundações)**, que resolve os maiores gaps sem depender de pagamentos externos:
1. `WalletEntry` (double-entry) + serviço `wallet_service.py` com `credit()`/`debit()` atómicos.
2. `Wallet.payout_balance` (saldo virtual disponível para saque).
3. `ConfirmDeliveryView` → creditar vendedor (saldo virtual).
4. `CancelOrderView` → reembolsar comprador (saldo virtual).
5. Migrar `ProcessReturnRefundView` para o ledger.

Depois **W2 (Escrow virtual)**, **W3 (Payouts manuais)** e **W4 (pagamento manual + registo)**.

> **Decisão tomada:** unificar o saque de afiliados com a carteira — um único `PayoutRequest`
> (role `seller`/`affiliate`), ambos pagos manualmente pelo admin. `AffiliatePayout` passa a histórico.

---

## 11. Referências — negócios no mesmo modelo (payout manual)

| Plataforma | Como funciona | O que adoptamos |
|---|---|---|
| **Jumia (África)** | Cobra ao comprador, retém, e paga ao vendedor por **ciclos manuais** (transferência/banco local) | Cobrança centralizada no admin + payout manual com registo |
| **Mercado Livre / Mercado Pago** | Vendedor acumula saldo; saca quando quer (após validação de identidade) | Saldo virtual + KYC antes do saque + threshold |
| **Etsy** | Vendedor define conta; a plataforma paga por **depósito programado/manual** | Conta de saque definida pelo beneficiário (M-Pesa/e-Mola/banco) |
| **Shopify (payout manual)** | Lojas sem gateway automático: o operador paga manualmente e marca no admin | Aprovação + referência manual + marcação "paid" |
| **Marketplaces locais MZ (Duka/WhatsApp commerce)** | Cobrança na conta do dono; repasse manual aos fornecedores | Fluxo simples e confiável, sem APIs externas |

**Princípios herdados destes modelos:**
1. **Dinheiro real fica com o operador** — a carteira só reflecte direitos a receber.
2. **Payout é um processo operacional do admin**, não uma transacção automática.
3. **Auditoria** (quem aprovou, quem pagou, referência) é essencial para confiança.
4. **KYC + threshold** evitam fraudes e micro-transacções.
5. **Reserva de saldo** no pedido impede que o mesmo saldo seja sacado duas vezes.
