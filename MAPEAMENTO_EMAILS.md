# Mapeamento de Funcionalidades que Necessitam de Email — e-Shopping Centre

> Documento de análise. Mapeia, por sistema/fluxo, todas as actividades que usam ou
> deveriam usar o serviço de email (transacional e de ciclo de vida).
> Data: 2026-08-19 · Não contém código.

## Legenda de estado

- ✅ **Já envia email** — implementado no backend.
- ⚠️ **Só tem notificação in-app** — existe `Notification` mas não email (lacuna).
- ❌ **Sem email nem notificação** — lacuna total.

---

## 1. Resumo executivo

O email já está **funcional** (Resend via `django-anymail` em produção, console em dev) e é
usado em fluxos críticos de conta (verificação, recuperação de password, boas-vindas) e em
algumas acções administrativas de lojas. Porém, **a maior parte do ciclo de vida comercial**
(encomendas, devoluções, pagamentos, carteira, afiliados, chat, avaliações) **só tem
notificações in-app ou não tem nada** — são as principais oportunidades de email.

### Infraestrutura atual

| Componente | Estado |
|---|---|
| Backend de envio | Resend via `django-anymail` (produção) · `console.EmailBackend` (dev) |
| Config | `EMAIL_BACKEND`, `ANYMAIL`, `DEFAULT_FROM_EMAIL`, `SITE_URL`, `FRONTEND_URL`, `EMAIL_LOGO_URL` |
| Dispatcher | `apps/users/tasks.py::dispatch()` — Celery em prod, síncrono em dev, com fallback se o Redis falhar |
| Templates HTML | `apps/users/templates/emails/` → `base_email.html`, `welcome.html`, `verification.html`, `password_reset.html`, `google_linked.html` |
| Remetente | `e-Shopping Centre <suporte@e-shoppingcentre.com>` |

---

## 2. Autenticação & Contas (`apps/users`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Registo de nova conta — envio de OTP de verificação | ✅ | `send_verification_email` (Registo e "reenviar código") |
| 2 | Reenvio de código de verificação | ✅ | `ResendVerificationView` |
| 3 | Validação do email (marcar conta verificada) | ⚠️ | Após verificar, envia `welcome` (ver item 4) — não há email de "conta verificada" explícito para contas criadas por email/password |
| 4 | Boas-vindas a utilizador novo (via Google/Firebase) | ✅ | `send_welcome_email` |
| 5 | Conta ligada ao Google (alerta de segurança) | ✅ | `send_google_linked_email` |
| 6 | Recuperação de password (pedido) | ✅ | `send_password_reset_email` (OTP) |
| 7 | Confirmação de alteração de password | ❌ | Falta email de "a tua password foi alterada" (segurança) |
| 8 | Lembrete de verificação de conta (diário) | ✅ | `send_verification_reminders` (Celery beat) |
| 9 | Eliminação de conta não verificada (limpeza) | ⚠️ | `delete_stale_unverified_users` — apaga sem aviso; poderia enviar aviso prévio |
| 10 | Mudança de email do perfil | ❌ | Falta confirmação no email novo |
| 11 | Bloqueio/desativação de conta pelo admin | ❌ | Só in-app/nenhum |

---

## 3. Lojas (`apps/stores`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Submissão de nova loja (registo do vendedor) | ❌ | Falta email de confirmação ao vendedor ("recebemos a tua loja, em análise") |
| 2 | Notificação ao admin de nova loja a rever | ❌ | Falta email de alerta à equipa/admin |
| 3 | Loja **aprovada** | ✅ | `send_mail` em `users/views_admin.py` |
| 4 | Loja **rejeitada** (com motivo) | ✅ | `send_mail` |
| 5 | Loja **suspensa** | ✅ | `send_mail` |
| 6 | Loja **reactivada** | ✅ | `send_mail` |
| 7 | **Documentos adicionais** solicitados | ✅ | `send_mail` |
| 8 | Loja **removida** permanentemente | ✅ | `send_mail` |
| 9 | Loja fechada (`closed`) | ⚠️ | Há notificação no log de moderação; sem email dedicado |

---

## 4. Produtos & Inventário (`apps/products`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | **Stock baixo** (≤ limiar da loja) | ⚠️ | `check_low_stock` cria `Notification` apenas — falta email ao vendedor |
| 2 | Produto esgotado (`stock = 0`) | ❌ | Falta email |
| 3 | Produto publicado/ativado | ⚠️ | `stores/signals.py` notifica seguidores in-app — falta email aos seguidores |
| 4 | Produto desativado/suspenso pelo admin | ❌ | Falta email ao vendedor |
| 5 | Produto em destaque aprovado | ❌ | Oportunidade de email informativo |

---

## 5. Encomendas (`apps/orders`)

> Fluxo principal do marketplace. **Nenhuma etapa envia email** — apenas `Notification` in-app.

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | **Encomenda criada** (confirmação ao comprador) | ⚠️ | `order_update` in-app — **email de confirmação é prioritário** |
| 2 | **Nova venda** (aviso ao vendedor) | ⚠️ | in-app — falta email |
| 3 | Pagamento confirmado | ⚠️ | in-app — falta email |
| 4 | Encomenda **confirmada** pelo vendedor | ⚠️ | in-app |
| 5 | Encomenda **expedida** (com tracking) | ⚠️ | in-app — falta email com código de tracking |
| 6 | Encomenda **entregue** | ⚠️ | in-app (`auto_confirm_delivery` cria notificação) |
| 7 | Encomenda **cancelada** | ⚠️ | in-app |
| 8 | **Carrinho abandonado** | ✅ | `recover_abandoned_carts` (email + in-app) |
| 9 | Libertação de escrow ao vendedor | ⚠️ | `release_escrow_after_return_window` — sem email |

---

## 6. Devoluções & Reembolsos (`apps/orders` — returns)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Pedido de devolução criado (comprador) | ⚠️ | `return_update` in-app — falta email |
| 2 | Devolução aprovada / recusada (admin) | ⚠️ | in-app — falta email |
| 3 | Devolução recebida no armazém | ⚠️ | in-app |
| 4 | Reembolso processado | ⚠️ | in-app (`auto_refund_unprocessed_returns`) |
| 5 | Devolução concluída | ⚠️ | in-app |

---

## 7. Pagamentos & Carteira (`apps/wallet` / `apps/payments`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Pedido de saque (vendedor/afiliado) | ❌ | Sem email de "pedido recebido" |
| 2 | Saque **aprovado** pelo admin | ❌ | Sem email |
| 3 | Saque **pago** (referência de pagamento) | ❌ | Sem email — **crítico**: o utilizador precisa da referência |
| 4 | Saque **rejeitado** (com motivo) | ❌ | Sem email |
| 5 | Saldo creditado (venda liberada do escrow) | ❌ | Sem email |
| 6 | Falha/estorno de pagamento | ❌ | Sem email |

---

## 8. Afiliados (`apps/affiliates`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Comissão gerada (venda via link) | ⚠️ | `affiliate` in-app — falta email |
| 2 | Comissão **aprovada** (após janela de devolução) | ⚠️ | `auto_approve_affiliate_commissions` in-app — falta email |
| 3 | Comissão **rejeitada/clawback** | ⚠️ | in-app |
| 4 | Aprovação/rejeição do KYC de afiliado | ❌ | Sem email |
| 5 | Mudança de tier (nível do programa) | ❌ | Sem email |

---

## 9. Cursos (`apps/courses`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Inscrição/compra de curso (confirmação + acesso) | ❌ | Sem email de boas-vindas ao curso |
| 2 | Conclusão de curso / certificado | ❌ | Sem email com certificado |
| 3 | Publicação de novo curso (vendedor) | ❌ | Sem email |
| 4 | Aprovação de curso pelo admin | ❌ | Sem email |

---

## 10. Chat & Mensagens (`apps/chat`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Nova mensagem não lida (comprador ↔ vendedor) | ❌ | Só WebSocket + `unread-count` — falta email de "tens nova mensagem" (com delay/resumo) |
| 2 | Nova conversa iniciada | ❌ | Sem email |

---

## 11. Avaliações (`apps/reviews`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Nova avaliação recebida (produto) | ❌ | Sem email ao vendedor |
| 2 | Nova avaliação da loja | ❌ | Sem email ao vendedor |
| 3 | Resposta do vendedor a uma avaliação | ❌ | Sem email ao comprador |
| 4 | Avaliação removida/ocultada (moderação) | ❌ | Sem email |

---

## 12. Administração & Suporte

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Novo ticket de suporte criado | ⚠️ | `support` in-app — falta email de confirmação ao cliente |
| 2 | Ticket respondido pelo admin | ⚠️ | in-app — falta email |
| 3 | Ticket resolvido/fechado | ⚠️ | in-app |
| 4 | Aviso ao admin: nova loja / novo saque / novo ticket | ❌ | Falta email de alerta operacional |
| 5 | Aviso de pico de erros 5xx / falhas de tarefas | ❌ | Oportunidade (ops) — `mail_admins` |

---

## 13. Tarefas agendadas (Celery Beat) que tocam email

| Tarefa | Frequência | Envia email? |
|---|---|---|
| `auto-refund-unprocessed-returns` | hora | ❌ (só in-app) |
| `auto-confirm-delivery` | hora | ❌ (só in-app) |
| `recover-abandoned-carts` | hora | ✅ |
| `auto-approve-affiliate-commissions` | hora | ❌ (só in-app) |
| `release-escrow-after-return-window` | hora | ❌ |
| `delete-stale-unverified-users` | diário | ❌ (podia avisar antes) |
| `send-verification-reminders` | diário | ✅ |
| `refresh-home-sections` | hora | — (não é email) |

---

## 14. Priorização recomendada

**Prioridade 1 — Receita e confiança (impacto direto):**
1. Confirmação de encomenda (comprador).
2. Nova venda (vendedor).
3. Encomenda expedida com código de tracking.
4. Saque **pago** com referência.
5. Comissão de afiliado aprovada.
6. Loja submetida → confirmação ao vendedor + alerta ao admin.

**Prioridade 2 — Retenção e suporte:**
7. Stock baixo.
8. Novo produto para seguidores.
9. Devoluções (pedido/aprovado/recusado/reembolso).
10. Ticket de suporte (criado/respondido/resolvido).
11. Mensagens de chat não lidas (resumo diário).

**Prioridade 3 — Segurança e completude:**
12. Password alterada com sucesso.
13. Mudança de email de perfil.
14. KYC de afiliado aprovado/rejeitado.
15. Avaliações (nova avaliação e resposta).
16. Curso inscrito / certificado.
17. Conta bloqueada pelo admin.

---

## 15. Recomendações transversais

- **Centralizar** o envio (o `dispatch()` de `apps/users/tasks.py` já é um bom padrão — reutilizá-lo noutros módulos em vez de `send_mail` espalhado em `views_admin.py`).
- **Templates HTML** para os emails de encomendas/pagamentos (hoje os emails de loja são texto puro; só os de auth têm HTML).
- **Respeitar preferências de notificação** — ligar envio de email às flags já existentes (ex.: `StoreFollower.notify_new_products`).
- **Idempotência/deduplicação** de emails transacionais (evitar duplicados em retries do Celery).
- **Links públicos** (não hardcoded): hoje alguns emails de loja usam `eshoppingcentre.co.mz` hardcoded; o `SITE_URL` já existe para unificar.
