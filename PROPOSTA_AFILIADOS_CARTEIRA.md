# Proposta: Sistema de Afiliados & Carteira Digital da Plataforma

> **eShoppingCentre — Marketplace em Moçambique**
> Documento de especificação técnica e funcional
> Data: 13 de Agosto de 2026

---

## Contexto e Objectivo

O eShoppingCentre já possui as bases de um marketplace multi-loja (lojas físicas, digitais e cursos), com encomendas, devoluções, stock, tickets de suporte, cupões e um esboço de sistema de afiliados e de carteira. Faltam os **métodos de pagamento reais** (M-Pesa, e-Mola, transferência bancária, cartão), que serão integrados no fim do projecto.

Este documento propõe, com base no **padrão internacional** e adaptado ao **contexto moçambicano**:

1. **Sistema de Afiliados** — implementado **primeiro** (Parte 1).
2. **Carteira Digital da Plataforma** — para gerir o fluxo de dinheiro interno e as questões transaccionais (Parte 2).

> **Ordem de implementação:** primeiro o sistema de afiliados, depois a carteira digital.

---

# PARTE 1 — Sistema de Afiliados

## 1.1 Estado actual

**Backend (`apps/affiliates/`)**
| Componente | Estado |
|------------|--------|
| `AffiliateProfile` (user, referral_code, total_clicks/sales/commission, is_active) | ✅ Existe |
| `AffiliateLink` (afiliado, produto, code, clicks, conversions) | ✅ Existe |
| `AffiliateCommission` (pending/approved/paid/rejected) | ✅ Existe |
| Registo, perfil, stats, criar link, listar links/comissões | ✅ Existe |
| Endpoint de clique/redirect com cookie | ❌ Inexistente |
| Criação automática de comissão na venda | ❌ Inexistente |
| Payout (saque) | ⚠️ Stub — devolve "Solicitação recebida" sem fazer nada |
| Gestão do admin (aprovar/suspender, taxas, configurações) | ❌ Inexistente |
| Frontend (register, dashboard, links, products, earnings) | ✅ Existe (básico) |

**Gaps críticos (vs. padrão internacional):**
1. Sem rastreio de cliques (`clicks` nunca incrementa).
2. Sem cookie de atribuição (o `?ref=` não é capturado/persistido).
3. Sem criação de `AffiliateCommission` no checkout (a comissão só fica em `Order.affiliate_commission`).
4. Sem actualização de `conversions`, `total_sales`, `total_clicks`.
5. Sem ciclo de vida (aprovação/reversão automática).
6. Sem anti-fraude (auto-referência, threshold, reversão em reembolso).
7. Sem intervenção do admin.

## 1.2 Padrão internacional (baseline)

O modelo de referência é o de marketplaces globais (Amazon Associates, Shopify Collabs, CJ, Rakuten, Impact):

1. **Atribuição por cookie** — ao clicar num link, define-se um cookie com o código do afiliado e uma **janela de atribuição** (padrão 30 dias). A venda é atribuída ao último afiliado (last-click).
2. **Deep links por produto** — cada afiliado tem um link único por produto/loja (`?ref=CODE` ou caminho `/r/CODE`).
3. **Registo de cliques e conversões** — cada clique e cada venda convertida são contabilizados.
4. **Ciclo de vida da comissão** — `pending` → `approved` (após entrega + janela de devolução) → `paid`. Reversão em cancelamento/reembolso.
5. **Tiers por desempenho** — percentagem crescente conforme volume de vendas.
6. **Threshold de saque** — valor mínimo para levantar (evita custos de micro-transacções).
7. **Anti-fraude** — bloqueio de auto-referência, limitação de comissão por encomenda, revisão de comissões anómalas.
8. **Dashboard do afiliado** — links, cliques, conversões, comissões, saques.
9. **Gestão do admin** — aprovação de afiliados, configuração de taxas/janelas/threshold, revisão de disputas, aprovação de payouts.

## 1.3 Adaptação ao contexto moçambicano

- **Moeda:** MZN (Metical) — todas as comissões e thresholds em MZN.
- **Promoção via WhatsApp** — os links de afiliado serão partilhados sobretudo por WhatsApp (padrão forte em Moçambique), por isso o link deve ser curto e fácil de copiar.
- **Sem APIs externas** (nesta fase) — rastreio 100% interno (cookie + código), sem serviços de terceiros.
- **Confiança e pagamento na entrega** — a comissão só deve ser **aprovada** após a entrega confirmada e passada a janela de devolução (7 dias), evitando comissões sobre vendas devolvidas.
- **Baixa literacia digital** — dashboard simples, em português, com números grandes e linguagem clara.
- **Payouts por M-Pesa/e-Mola/transferência bancária** — os métodos locais (serão integrados no fim do projecto).

## 1.4 Arquitectura proposta (modelos)

### Novos/alterados no modelo

**`AffiliateProfile`** (alterar)
- `user` (OneToOne)
- `referral_code` (único)
- `status` → `pending | active | suspended` (aprovado pelo admin)
- `commission_tier` → `basic | silver | gold` (ou percentagem personalizada)
- `custom_rate` (Decimal, opcional — override da taxa por afiliado)
- `total_clicks`, `total_sales`, `total_commission`
- `wallet` → ligação à carteira (Parte 2)

**`AffiliateLink`** (manter, acrescentar)
- `clicks`, `conversions`
- `last_click_at`

**`AffiliateCommission`** (manter, acrescentar)
- `click_id` / `attribution` (código do clique para auditoria)
- `approved_at`, `paid_at`
- `rejection_reason`

### Novo modelo

**`AffiliateClick`**
- `link` (FK)
- `ip_address` (hash)
- `user_agent`
- `session_id`
- `created_at`

> Serve para auditoria e anti-fraude (detectar cliques repetidos do mesmo IP).

**`AffiliateSettings`** (singleton, configurável pelo admin)
- `cookie_window_days` (padrão 30)
- `default_commission_rate` (padrão 10%)
- `min_payout_amount` (padrão 500 MZN)
- `approve_after_days` (padrão 7, pós-entrega)

## 1.5 Fluxos principais

### Fluxo A — Clique e atribuição
```
Afiliado partilha /r/{CODE}
        ↓
Visitante clica → GET /r/{CODE}
        ↓
Regista AffiliateClick (+1 em link.clicks, +1 em profile.total_clicks)
        ↓
Define cookie "ref=CODE" (30 dias) e redireciona ao produto
        ↓
Visitante compra (mesmo depois de dias) → cookie lido no checkout
        ↓
Venda atribuída ao afiliado (last-click)
```

### Fluxo B — Conversão e comissão
```
Encomenda criada (com affiliate_code do cookie ou manual)
        ↓
CreateOrderSerializer cria AffiliateCommission (status=pending, amount = subtotal × taxa)
        ↓
+1 em link.conversions e profile.total_sales
        ↓
Encomenda entregue + 7 dias (janela de devolução) sem devolução
        ↓
Task Celery aprova a comissão → status=approved, total_commission += amount
        ↓
Comissão aprovada fica disponível para saque (Parte 2: creditada na carteira)
```

### Fluxo C — Reversão
```
Encomenda cancelada ou reembolsada
        ↓
Comissão pendente/aprovada correspondente → status=rejected (motivo)
        ↓
total_commission é recalculado (decremento)
```

## 1.6 Níveis de utilizadores e permissões

| Nível | Capacidades |
|-------|-------------|
| **Visitante** | Clica em links de afiliado (recebe cookie) |
| **Comprador** | Qualquer conta pode **tornar-se afiliado** (registo em 1 clique) |
| **Afiliado** | Dashboard: links, cliques, conversões, comissões, solicitar saque |
| **Vendedor (loja)** | Vê afiliados que promovem a loja, define `default_affiliate_commission` por loja e taxa por produto, vê comissões a pagar |
| **Admin** | Aprova/suspende afiliados, configura `AffiliateSettings`, revê comissões em disputa, aprova payouts, aplica reversões manuais |

## 1.7 Anti-fraude (regras)

1. **Auto-referência** — um afiliado não ganha comissão por compras feitas com o próprio link.
2. **Comissão única por encomenda** — 1 comissão por afiliado por encomenda (last-click).
3. **Cliques duplicados** — detecção de cliques repetidos do mesmo IP/sessão em janela curta (não conta múltiplas vezes).
4. **Reversão automática** em cancelamento/reembolso.
5. **Suspensão** — admin pode suspender afiliados com comportamento anómalo (comissões ficam retidas).
6. **Threshold mínimo** — impede micro-saques e reduz custos.

## 1.8 Endpoints propostos

```
GET  /r/{code}/                        → clique + cookie + redirect  (público)
POST /api/v1/affiliates/register/      → tornar-se afiliado (já existe)
GET  /api/v1/affiliates/me/            → perfil (já existe)
GET  /api/v1/affiliates/me/stats/      → estatísticas (já existe)
POST /api/v1/affiliates/links/         → criar link (já existe)
GET  /api/v1/affiliates/me/links/      → meus links (já existe)
GET  /api/v1/affiliates/me/commissions/ → comissões (já existe)
POST /api/v1/affiliates/me/payouts/    → solicitar saque (implementar de verdade)
GET  /api/v1/affiliates/store/         → afiliados da loja (já existe)
── Admin ──
GET  /api/v1/admin/affiliates/         → listar afiliados
PATCH /api/v1/admin/affiliates/{id}/   → aprovar/suspender
GET  /api/v1/admin/affiliates/settings/ → ler/configurar AffiliateSettings
PATCH /api/v1/admin/affiliates/settings/
GET  /api/v1/admin/affiliates/commissions/ → rever comissões
PATCH /api/v1/admin/affiliates/commissions/{id}/ → aprovar/rejeitar manualmente
POST /api/v1/admin/affiliates/payouts/{id}/approve/ → aprovar saque
```

## 1.9 Frontend proposto

- **Página de produto**: botão "Promover" (para quem é afiliado) → gera/copia link.
- **Dashboard do afiliado** (`/affiliate/dashboard`): cards de cliques/conversões/comissão, lista de links com botão copiar, tabela de comissões com estado, botão "Solicitar saque".
- **Admin**: nova aba **"Afiliados"** — stats globais, tabela de afiliados (aprovar/suspender), configurações (janela, taxa, threshold), revisão de comissões, aprovação de saques.

## 1.10 Roadmap de implementação (afiliados)

| Fase | Entregas | Prioridade |
|------|----------|-----------|
| **F1 — Rastreio & atribuição** | Endpoint `/r/{code}` + cookie; atribuição no checkout; criação de `AffiliateCommission`; incremento de cliques/conversões | 🔴 Crítica |
| **F2 — Ciclo de vida** | Aprovação automática pós-entrega (Celery); reversão em cancelamento/reembolso; tiers de comissão; threshold | 🟠 Alta |
| **F3 — Payouts** | Integração com a carteira (Parte 2); solicitar saque; aprovação admin | 🟠 Alta |
| **F4 — Admin & UX** | Aba "Afiliados" no admin; dashboard do afiliado melhorado; anti-fraude | 🟡 Média |

---

# PARTE 2 — Carteira Digital da Plataforma

## 2.1 Estado actual

**Backend (`apps/wallet/`)**
| Componente | Estado |
|------------|--------|
| `Wallet` (balance, total_earned, total_withdrawn, is_active) | ✅ Existe |
| `WalletTransaction` (sale/commission/affiliate_commission/withdrawal/fee/refund/bonus; pending/completed/failed) | ✅ Existe |
| `MyWalletView`, `MyTransactionsView` | ✅ Existem |
| `WalletPayoutView` (saque) | ⚠️ Stub |
| Fluxo de crédito do vendedor na entrega | ❌ Inexistente |
| Reembolso no cancelamento | ❌ Inexistente |
| Escrow (retenção de fundos) | ❌ Inexistente |

**Gaps críticos:**
1. **O vendedor nunca recebe dinheiro** — não há crédito na carteira quando a encomenda é entregue/paga. A carteira só é usada em reembolsos (deduz vendedor/credita comprador).
2. **Cancelamento não reembolsa** — restaura stock mas não devolve o dinheiro.
3. **Reembolso do admin não move dinheiro** — `AdminOverrideView` com `refund` só muda status.
4. **Payout é stub** — não há saque real.
5. **Sem double-entry ledger** — as transacções não têm contrapartida (débito/crédito) para reconciliação.

## 2.2 Objectivos da carteira

1. **Gerir o fluxo de dinheiro interno** da plataforma (vendas, comissões, taxas, reembolsos, saques) de forma **auditável**.
2. **Proteger compradores e vendedores** com **escrow** (retenção até entrega + janela de devolução).
3. **Servir de base para os métodos de pagamento** que serão integrados no fim do projecto (M-Pesa, e-Mola, banco, cartão) — a carteira é o "ledger" central.
4. **Permitir saques** (payouts) para vendedores e afiliados via métodos locais.
5. **Garantir reconciliação** e rastreio completo (quem, quando, porquê, quanto).

## 2.3 Padrão internacional (baseline)

Modelo de referência: carteiras de marketplaces (Shopify Payments, Stripe Connect, PayPal for Marketplaces, Mercado Pago).

1. **Double-entry ledger** — cada movimento tem débito e crédito; o saldo de cada conta é a soma das entradas. Garante consistência e auditoria.
2. **Escrow (retenção)** — fundos do comprador ficam retidos até a entrega + janela de devolução; só depois são libertados ao vendedor.
3. **Contas segregadas por papel** — cada utilizador tem saldo de comprador e saldo de vendedor/afiliado (separação de fundos).
4. **Taxas da plataforma** — a plataforma cobra uma percentagem por transacção (no eShoppingCentre já existe `platform_fee` = 8%).
5. **Payouts** — saques com threshold mínimo, aprovação, e registo da transacção.
6. **Reconciliação** — capacidade de reconciliar cada saldo com o histórico de transacções.
7. **Idempotência** — evitar duplicação de movimentos (chave única por transacção).

## 2.4 Adaptação ao contexto moçambicano

- **Moeda:** MZN (Metical), com 2 casas decimais.
- **Métodos locais de pagamento** (a integrar no fim): **M-Pesa** (Vodacom), **e-Mola** (Movitel), **transferência bancária** (BIM, BCI, Standard Bank, Moza Banco, Absa), **cartão** (Visa/Mastercard), e **pagamento na entrega** (cash on delivery — muito comum).
- **Confiança e escrow** — o escrow é especialmente importante porque o pagamento na entrega e a informalidade exigem protecção do comprador; a libertação só ocorre após entrega confirmada + janela de devolução (7 dias).
- **Sem APIs externas nesta fase** — a carteira regista tudo internamente; os gateways entram no fim como "funding sources".
- **Saques via M-Pesa/e-Mola/transferência** — o vendedor/afiliado escolhe o método; a execução real do saque liga-se aos gateways no fim.
- **Baixa literacia digital** — saldo visível em grande, extracto simples em português.

## 2.5 Modelo de contas (ledgers)

### Contas por utilizador

Cada utilizador tem **dois saldos lógicos** (podem estar na mesma `Wallet` ou em sub-contas):

| Saldo | Destino |
|-------|---------|
| **Comprável** (buyer balance) | Dinheiro que o comprador tem para gastar (recargas, reembolsos) |
| **Disponível para saque** (payout balance) | Vendas do vendedor + comissões do afiliado, disponíveis para saque |

### Tipos de transacção (manter + acrescentar)

`WalletTransaction.type`: `sale`, `commission`, `affiliate_commission`, `withdrawal`, `fee`, `refund`, `bonus` + novos:
- `hold` / `release` (escrow)
- `topup` (recarga via gateway, no futuro)

### Novos modelos propostos

**`WalletEntry` (double-entry ledger)**
- `transaction` (FK a WalletTransaction)
- `wallet` (FK)
- `direction` → `debit | credit`
- `amount`
- `balance_before`, `balance_after`

> Cada `WalletTransaction` gera **duas** `WalletEntry` (débito numa conta, crédito noutra), garantindo que o sistema está sempre equilibrado.

**`PayoutRequest`**
- `user`, `amount`, `method` (mpesa/emola/bank), `status` (pending/approved/paid/rejected), `approved_by`, `paid_at`

**`EscrowHolding` (ou campo na Order)**
- `order`, `amount`, `status` (held/released/reversed), `released_at`

## 2.6 Fluxos de dinheiro (escrow)

### Fluxo A — Compra (pagamento confirmado)
```
Comprador paga (gateway, no futuro) → fundos entram em ESCROW
        ↓
Encomenda entregue + 7 dias (janela de devolução)
        ↓
Escrow LIBERTADO:
  - Crédito ao vendedor: total − platform_fee (8%) − affiliate_commission
  - Crédito à plataforma: platform_fee
  - Crédito ao afiliado: affiliate_commission (comissão aprovada)
```

### Fluxo B — Devolução/reembolso
```
Devolução aprovada e recebida → reembolso ao comprador
        ↓
Deduz do vendedor (ou do escrow se ainda retido)
        ↓
Comissão do afiliado é revertida (rejected)
```

### Fluxo C — Cancelamento (antes do envio)
```
Encomenda cancelada (pending/confirmed) → reembolso total ao comprador
        ↓
Stock restaurado + comissão revertida
```

### Fluxo D — Saque (payout)
```
Vendedor/afiliado solicita saque (≥ threshold)
        ↓
Admin aprova → status=paid
        ↓
Fundos debitados do "disponível para saque" → método escolhido (M-Pesa/e-Mola/banco)
```

## 2.7 Regras de negócio

| Regra | Valor proposto |
|-------|----------------|
| Taxa da plataforma (`platform_fee`) | 8% sobre subtotal (já implementado) |
| Janela de escrow | Entrega + 7 dias (janela de devolução) |
| Comissão do afiliado | Taxa do produto/loja (padrão 10%) |
| Threshold de saque | 500 MZN (configurável) |
| Saldo mínimo da plataforma | — |
| Reversão em reembolso | Automática (comissões + escrow) |

## 2.8 Reconciliação e auditoria

1. **Double-entry ledger** — cada movimento tem contrapartida; o somatório de débitos = créditos (saldo zero no sistema global).
2. **`balance_before`/`balance_after`** em cada transacção — permite reconstruir o saldo em qualquer ponto no tempo.
3. **Idempotência** — chave única por transacção (evita duplicação em retries).
4. **Relatório de reconciliação do admin** — saldo da plataforma vs. soma de taxas vs. escrows retidos vs. saques.

## 2.9 Endpoints propostos

```
GET  /api/v1/wallet/me/                 → saldo (já existe)
GET  /api/v1/wallet/me/transactions/    → extracto (já existe)
POST /api/v1/wallet/me/payouts/         → solicitar saque (implementar de verdade)
── Admin ──
GET  /api/v1/admin/wallet/payouts/      → listar saques pendentes
POST /api/v1/admin/wallet/payouts/{id}/approve/ → aprovar
POST /api/v1/admin/wallet/payouts/{id}/reject/  → rejeitar
GET  /api/v1/admin/wallet/reconciliation/ → relatório de reconciliação
```

## 2.10 Roadmap de implementação (carteira)

| Fase | Entregas | Prioridade |
|------|----------|-----------|
| **W1 — Fundações** | Double-entry ledger (`WalletEntry`); crédito do vendedor na entrega; reembolso no cancelamento; reembolso real do admin | 🔴 Crítica |
| **W2 — Escrow** | Retenção de fundos até entrega + janela; libertação automática (Celery) | 🔴 Crítica |
| **W3 — Payouts** | `PayoutRequest`; solicitar saque; aprovação admin; threshold | 🟠 Alta |
| **W4 — Integração gateways** | M-Pesa/e-Mola/banco/cartão como funding sources (fim do projecto) | 🟡 Média |
| **W5 — Reconciliação** | Relatório de reconciliação + auditoria completa | 🟡 Média |

---

# Resumo e ordem de implementação

```
1. SISTEMA DE AFILIADOS (primeiro)
   F1 Rastreio & atribuição → F2 Ciclo de vida → F3 Payouts → F4 Admin & UX

2. CARTEIRA DIGITAL (a seguir)
   W1 Fundações → W2 Escrow → W3 Payouts → W4 Gateways → W5 Reconciliação
```

> As duas partes estão **interligadas**: a comissão do afiliado (F3) é creditada na carteira (W3), e a carteira é a base para os gateways de pagamento do fim do projecto.
