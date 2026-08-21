# Plano de Implementação de Push Notifications — e-Shopping Centre

> Documento de planeamento para implementação futura. Não contém código.
> Data: 2026-08-21.

## 1. Estado atual

| Componente | Estado |
|---|---|
| `Notification` in-app (`apps/notifications`) | ✅ já existe |
| WebSocket + Django Channels (chat em tempo real) | ✅ já existe |
| Celery + Redis | ✅ já existe |
| Firebase (auth Google) | ✅ já existe (projeto configurado) |
| PWA manifest (`frontend/public/manifest.json`) | ✅ completo |
| Service worker (`frontend/public/sw.js`) | ⚠️ existe, mas só faz cache — sem eventos `push`/`notificationclick` |
| Registo do service worker / manifest (`frontend/app/layout.tsx`) | ❌ comentado ("PWA desabilitada temporariamente") |

**Conclusão:** a base está quase pronta — falta **ativar o PWA** e **implementar o canal de push**.

---

## 2. Níveis de implementação (arquitetura)

### 2.1 Backend (Django)
- Modelo `PushSubscription` — por utilizador/dispositivo:
  - `user` (FK), `endpoint`, chaves `p256dh` e `auth`, `user_agent`, `created_at`.
- Serviço de envio de push:
  - **Opção A (recomendada): FCM** — já existe projeto Firebase; suporta web **e** apps Android/iOS no futuro.
  - **Opção B: Web Push (VAPID)** self-hosted via `pywebpush` — sem dependência de terceiros.
- Tarefas Celery para envio assíncrono em lote (não bloquear o pedido HTTP), reutilizando os mesmos gatilhos dos emails/notificações.
- Endpoints:
  - `POST /api/v1/notifications/subscribe/`
  - `DELETE /api/v1/notifications/unsubscribe/`

### 2.2 Frontend (Next.js)
- Ativar o PWA: descomentar o manifest no `layout.tsx` e registar o `sw.js`.
- Pedir permissão + subscrever (só após ação do utilizador, ex.: botão "Ativar notificações").
- Enviar a subscrição para o backend e associá-la ao utilizador autenticado.
- Service worker: tratar `push` (mostrar notificação) e `notificationclick` (abrir deep link).
- Página/preferências "Notificações" com toggles por tipo.

### 2.3 Provider
- **FCM (Firebase Cloud Messaging)** — recomendado por já existir e por escalar para mobile.
- Alternativa simples: **Web Push VAPID**.

---

## 3. Funcionalidades e prioridades

### 🔴 Prioridade 1 — tempo real e dinheiro
- Chat: nova mensagem (instantânea — o WebSocket já cobre o app aberto; o push cobre o app fechado).
- Encomenda (comprador): enviada, entregue, cancelada, paga.
- Nova venda (vendedor).
- Saque pago / rejeitado (com referência).
- Comissão de afiliado aprovada.

### 🟡 Prioridade 2 — operação e suporte
- Devoluções: aprovada, recebida, reembolsada.
- Ticket de suporte: criado, respondido, resolvido.
- Stock baixo.
- Novo produto (seguidores da loja).

### 🟢 Prioridade 3 — engagement
- Avaliações e respostas.
- KYC de afiliado aprovado/rejeitado.
- Curso inscrito / concluído.
- Promoções/marketing (segmentado, opcional).

---

## 4. Plano de implementação em fases

| Fase | Âmbito | Esforço |
|---|---|---|
| 0 | Reativar PWA (manifest + registo do SW); gerar chaves VAPID/FCM | Baixo |
| 1 | Modelo `PushSubscription` + endpoints subscribe/unsubscribe | Baixo |
| 2 | Frontend: permissão, subscrição e SW `push`/`notificationclick` | Médio |
| 3 | Envio de push nos eventos de Prioridade 1 (chat + encomendas + saques) | Médio |
| 4 | Preferências por tipo + deep links + prioridades 2 e 3 | Médio |
| 5 | (Opcional) Apps nativas Android/iOS via FCM | Alto |

---

## 5. Considerações importantes

- **Permissão**: browsers bloqueiam pedido automático — pedir sempre após interação do utilizador.
- **iOS Safari**: push web só funciona como app instalado na tela inicial (Home Screen) e a partir do iOS 16.4+.
- **Deep links**: o `notificationclick` deve abrir a página certa (`/account/orders/{id}`, `/chat`, `/seller/orders/{id}`, etc.).
- **Deduplicação**: evitar push + email redundantes para o mesmo evento; respeitar preferências.
- **Ambiente dev**: Web Push exige HTTPS (localhost é exceção); FCM funciona localmente.
- **Falhas/expiração**: remover subscrições inválidas (`410 Gone` / `404`) automaticamente no envio em lote.

---

## 6. Decisões em aberto

- [ ] Provider: **FCM** (recomendado) ou **Web Push VAPID**?
- [ ] Escopo inicial: só Prioridade 1, ou também 2/3?
- [ ] Notificações de marketing/promoções: sim ou não (e com que frequência)?
- [ ] Preferências: por tipo de evento ou on/off global?

---

## 7. Integração com o sistema atual

Os gatilhos de push podem ser reutilizados dos pontos onde já existem **email** e **Notification in-app**
(ver `MAPEAMENTO_EMAILS.md`):

| Evento | Onde ligar |
|---|---|
| Nova mensagem de chat | WebSocket consumer / `Message` save |
| Encomenda criada/enviada/entregue/cancelada | `apps/orders/views.py` + `apps/orders/tasks.py` |
| Nova venda | `CreateOrderView` |
| Saque pago/rejeitado | `apps/wallet/services.py` |
| Comissão aprovada | `apps/affiliates/tasks.py` |
| Devolução (estados) | `apps/orders/views.py` (returns) |
| Ticket criado/atualizado | `apps/orders/views.py` (tickets) |
| Stock baixo / novo produto | `apps/products/signals.py` + `apps/stores/signals.py` |
| Avaliação / resposta | `apps/reviews/views.py` |
| KYC aprovado/rejeitado | `apps/affiliates/views.py` |
| Curso inscrito/concluído | `apps/courses/views.py` |

> Sugestão: criar um serviço central `apps/notifications/push_service.py` (espelho do
> `email_service.py`) com `send_push(user, title, body, link)` e reutilizá-lo em todos
> os gatilhos acima.
