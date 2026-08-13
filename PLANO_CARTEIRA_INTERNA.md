# Plano — Carteira Interna da Plataforma

> **eShoppingCentre — Marketplace em Moçambique**
> Documento de planeamento (integração e funcionamento)
> Data: 13 de Agosto de 2026
> Base: `PROPOSTA_AFILIADOS_CARTEIRA.md` (Parte 2) + estado actual do código

---

## 1. Objectivo

Transformar a `apps/wallet` (hoje apenas um registo simples) na **Carteira Interna** central da
plataforma, segundo o padrão internacional (Shopify Payments, Stripe Connect, Mercado Pago):

- **Gerir todo o dinheiro interno** (vendas, comissões, taxas, reembolsos, saques) de forma **auditável**.
- **Proteger comprador e vendedor** com **escrow** (fundos retidos até entrega + janela de devolução).
- Servir de **ledger central** para os gateways de pagamento futuros (M-Pesa, e-Mola, banco, cartão).
- **Permitir saques reais** para vendedores e afiliados.
- **Reconciliar** (débitos = créditos) em qualquer momento.

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
| `PaymentTransaction` (provider, status) — base para gateways | ✅ Existe |
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

### 3.4 Novo `PayoutRequest` (saque unificado)
```python
class PayoutRequest(BaseModel):
    user = FK(User)
    role = choices: seller | affiliate
    amount = Decimal
    method = choices: mpesa | emola | bank
    account_details = JSON
    status = choices: pending | approved | paid | rejected
    approved_by = FK(User, null)
    paid_at = DateTime(null)
    notes = Text
```

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
Comprador paga (gateway, no futuro) → PaymentTransaction.completed
        ↓
EscrowHolding criado (held) com o total da encomenda
        ↓
[Entrega confirmada + 7 dias de devolução]
        ↓
Escrow LIBERTADO → WalletEntry (double-entry):
  - vendedor:  total − platform_fee(8%) − affiliate_commission  → payout_balance
  - plataforma: platform_fee                                      → conta interna
  - afiliado:   affiliate_commission (se houver)                  → payout_balance
```

### 4.2 Confirmação de entrega (hoje `ConfirmDeliveryView`)
- Ao confirmar entrega, **libertar o escrow** (ou, sem escrow ainda, **creditar o vendedor** directamente).
- Comissão do afiliado passa a `approved` (já existe em `auto_approve_affiliate_commissions` — alinhar).

### 4.3 Cancelamento (hoje `CancelOrderView`)
- Restaurar stock (já faz).
- Reverter comissão (já faz).
- **NOVO:** reembolsar o comprador (devolver `balance` comprável ou reverter o escrow se `held`).

### 4.4 Devolução (hoje `ProcessReturnRefundView`)
- Já deduz vendedor + credita comprador. **Migrar para `WalletEntry`** (double-entry) para manter o ledger equilibrado.

### 4.5 Saque (payout)
```
Vendedor/afiliado solicita saque (≥ threshold 500 MZN) → PayoutRequest(pending)
        ↓
Admin aprova → status=paid
        ↓
Debita payout_balance → WalletEntry(debit) + total_withdrawn += amount
        ↓
(execução real via M-Pesa/e-Mola/banco — gateways no fim)
```

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
POST  /api/v1/admin/wallet/payouts/{id}/approve/  → aprovar (debitar + paid)
POST  /api/v1/admin/wallet/payouts/{id}/reject/   → rejeitar
GET   /api/v1/admin/wallet/reconciliation/  → relatório (Σ débitos = Σ créditos, escrows retidos)
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
| **W2 — Escrow** | `EscrowHolding`; retenção na compra; libertação automática (Celery, após entrega + 7 dias) | 🔴 Crítica |
| **W3 — Payouts** | `PayoutRequest`; solicitar saque; aprovação/rejeição admin; threshold; KYC (afiliado) | 🟠 Alta |
| **W4 — Gateways** | M-Pesa/e-Mola/banco/cartão como funding sources (fim do projecto) | 🟡 Média |
| **W5 — Reconciliação** | Relatório de reconciliação + auditoria completa | 🟡 Média |

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

---

## 10. Recomendação de arranque

Começar por **W1 (Fundações)**, que resolve os maiores gaps sem depender de gateways:
1. `WalletEntry` (double-entry) + serviço `wallet_service.py` com `credit()`/`debit()` atómicos.
2. `Wallet.payout_balance`.
3. `ConfirmDeliveryView` → creditar vendedor.
4. `CancelOrderView` → reembolsar comprador.
5. Migrar `ProcessReturnRefundView` para o ledger.

Depois **W2 (Escrow)** e **W3 (Payouts)**, e só no fim os gateways (W4) e reconciliação (W5).

> **Decisão a tomar agora:** unificar o saque de afiliados com a carteira (recomendado) ou manter separado?
