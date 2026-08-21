# Emails Pendentes — e-Shopping Centre

> Revisão das lacunas que **ainda falta implementar** no sistema de notificações por email.
> Complementa o `MAPEAMENTO_EMAILS.md` (que já reflete o estado implementado nas Fases 0–4).
> Data: 2026-08-21.

## Legenda de prioridade

- 🔴 **Alto impacto** — confiança, receita e suporte direto.
- 🟡 **Médio impacto** — retenção e operação.
- 🟢 **Baixo impacto / completude** — funcionalidades periféricas.

---

## 🔴 Alto impacto

| # | Item (ref. no mapeamento) | Onde ligar | Estado atual |
|---|---|---|---|
| 1 | Pagamento confirmado (5.3) | `apps/payments` — quando `payment_status` → `completed`/`paid` | ⚠️ sem email |
| 2 | Encomenda entregue (5.6) | `auto_confirm_delivery` + `ConfirmDeliveryView` | ⚠️ só in-app |
| 3 | Encomenda cancelada (5.7) | `CancelOrderView` | ⚠️ só in-app |
| 4 | Pedido de devolução criado (6.1) | `CreateReturnView.perform_create` | ⚠️ **nem notificação in-app tem** — faltam email ao comprador e aviso ao vendedor |
| 5 | Saque aprovado (7.2) | `wallet/services.py::approve_payout` | ❌ |
| 6 | Confirmação de pedido de saque ao utilizador (7.1) | `wallet/services.py::request_payout` (hoje só alerta admin) | ⚠️ |
| 7 | Comissão rejeitada / clawback (8.3) | `reject_commissions_for_order` / ação admin | ⚠️ só in-app |
| 8 | Ticket respondido (12.2) | *não existe endpoint de resposta* — só `ResolveTicketView` | ⚠️ |

---

## 🟡 Médio impacto

| # | Item (ref. no mapeamento) | Onde ligar | Estado atual |
|---|---|---|---|
| 9 | Saldo creditado (escrow libertado) ao vendedor (7.5) | `release_escrow_after_return_window` | ❌ |
| 10 | Falha / estorno de pagamento (7.6) | `apps/payments` | ❌ |
| 11 | Comissão gerada (8.1) | criação de `AffiliateCommission` (hoje só in-app) | ⚠️ |
| 12 | Encomenda confirmada pelo vendedor (5.4) | `UpdateOrderStatusView` | ⚠️ |
| 13 | Produto esgotado — `stock = 0` (4.2) | `apps/products/signals.py` | ❌ |

---

## 🟢 Baixo impacto / completude

| # | Item (ref. no mapeamento) | Onde ligar | Estado atual |
|---|---|---|---|
| 14 | Mudança de email (2.10) | campo `email` é read-only — exige fluxo novo com verificação | ❌ |
| 15 | Eliminação de conta não verificada (2.9) | `delete_stale_unverified_users` (aviso prévio) | ⚠️ |
| 16 | Loja fechada — `closed` (3.9) | `AdminStoreManageView` | ⚠️ |
| 17 | Produto desativado/suspenso pelo admin (4.4) | admin de produtos | ❌ |
| 18 | Produto em destaque aprovado (4.5) | admin de produtos | ❌ |
| 19 | Mudança de tier de afiliado (8.5) | `update_tier` | ❌ |
| 20 | Publicação de novo curso (9.3) | criação de curso | ❌ |
| 21 | Aprovação de curso pelo admin (9.4) | admin de cursos | ❌ |
| 22 | Nova conversa de chat (10.2) | `Conversation` criada (só existe digest diário) | ❌ |
| 23 | Avaliação removida/ocultada (11.4) | moderação de reviews | ❌ |

---

## Ordem de implementação recomendada

1. **Bloco 1 (confiança do comprador):** pagamento confirmado, encomenda entregue, encomenda cancelada.
2. **Bloco 2 (vendedor/afiliado):** saque aprovado, confirmação de pedido de saque, comissão rejeitada, saldo creditado (escrow).
3. **Bloco 3 (suporte):** pedido de devolução criado, ticket respondido.
4. **Bloco 4 (operação):** falha de pagamento, comissão gerada, encomenda confirmada, produto esgotado.
5. **Bloco 5 (completude):** restantes itens de baixo impacto.

> Nota: o item **Ticket respondido (8)** exige primeiro criar um endpoint de resposta a tickets
> (hoje só existe a resolução via `ResolveTicketView`). O item **Mudança de email (14)** exige um
> fluxo novo de confirmação por OTP.
