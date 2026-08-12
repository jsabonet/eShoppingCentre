# Tracking de Encomendas & Proteção contra Burlas

> Contexto: Moçambique — sem APIs externas de rastreio, entregas informais, WhatsApp como canal universal

## Estado Atual (12/08/2026)

| Funcionalidade | Estado |
|---|---|
| Timeline visual no detalhe da encomenda | ✅ |
| Vendedor atualiza status | ✅ |
| Devoluções com disputa admin | ✅ |
| Confirmação bilateral de entrega | ❌ |
| WhatsApp integrado | ❌ |
| Evidências de envio (fotos) | ❌ |
| Reputação de vendedores | ❌ |
| Dashboard admin de anomalias | ❌ |
| Página pública de tracking | ❌ |
| Escrow (retenção de pagamento) | ❌ |

---

## Plano de Implementação (contexto MZ)

### 1 — Confirmação bilateral de entrega

- Vendedor **não pode** marcar "delivered" sozinho
- Vendedor marca "shipped" + texto "como/quem entregou"
- Comprador clica "Confirmar Receção" → status muda para "delivered"
- Se comprador não confirma em +7 dias → escala para admin

### 2 — WhatsApp como canal de contacto

- Expor nº telefone do vendedor e comprador após pagamento
- Link `wa.me/258XXXXXXXX` para abrir conversa directa

### 3 — Evidências de envio (fotos)

- Vendedor faz upload de foto ao marcar "shipped"
- Texto descritivo do método de envio
- Comprador pode opcionalmente confirmar com foto

### 4 — Sistema de reputação

- Rating 1-5 estrelas pós-encomenda
- Tags: "Entregou rápido", "Produto conforme", "Boa comunicação"
- Métricas públicas no perfil da loja

### 5 — Dashboard admin de anomalias

- Vendedores +30% disputas → 🚩
- Compradores +5 devoluções/mês → 🚩
- Encomendas "shipped" +7 dias sem confirmação → ⚠️

### 6 — Página pública de verificação

- `/rastrear` — input: nº encomenda + telefone
- Mostra apenas status atual

### 7 — Escrow (retenção de pagamento)

- Pagamento retido até confirmação do comprador
- Libertação automática após X dias
- Disputa formal se comprador reporta "não recebi"

---

## Progresso

| # | Funcionalidade | Estado |
|---|---|---|
| 1 | Confirmação bilateral | ✅ Implementado |
| 2 | WhatsApp + contacto visível | ✅ Implementado |
| 3 | Evidências de envio (fotos) | ✅ Parcial (foto no envio) |
| 4 | Reputação | ⬜ Pendente |
| 5 | Dashboard anomalias | ⬜ Pendente |
| 6 | Página pública tracking | ⬜ Pendente |
| 7 | Escrow | ⬜ Pendente |

> **Nota:** O chat interno é o canal primário de rastreio e comunicação. O WhatsApp é complementar — visível como link rápido no detalhe da encomenda.
> Ambos comprador e vendedor têm acesso aos números de telefone um do outro após o pagamento.
