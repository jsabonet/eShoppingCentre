
# Mapeamento de Funcionalidades que Necessitam de Email — e-Shopping Centre

> Documento de análise. Mapeia, por sistema/fluxo, todas as actividades que usam ou
> deveriam usar o serviço de email (transacional e de ciclo de vida).
> Data: 2026-08-19 · Não contém código.
>
> **Estado: implementado** — Fases 0–4 concluídas. A secção "Estado de implementação"
> no final resume o que ficou ✅.

## Legenda de estado

- ✅ **Já envia email** — implementado no backend.
- ⚠️ **Só tem notificação in-app** — existe `Notification` mas não email (lacuna).
- ❌ **Sem email nem notificação** — lacuna total.

---

## 1. Resumo executivo

O email está **funcional** (Resend via `django-anymail` em produção, console em dev).
Após a implementação (Fases 0–4), o serviço cobre os fluxos críticos de conta,
encomendas, saques, devoluções, tickets, afiliados, avaliações, cursos, chat e alertas
administrativos, num serviço central (`apps/notifications/email_service.py`).

### Infraestrutura atual

| Componente | Estado |
|---|---|
| Backend de envio | Resend via `django-anymail` (produção) · `console.EmailBackend` (dev) |
| Config | `EMAIL_BACKEND`, `ANYMAIL`, `DEFAULT_FROM_EMAIL`, `SITE_URL`, `FRONTEND_URL`, `EMAIL_LOGO_URL` |
| Dispatcher | `apps/notifications/email_service.py::dispatch()` — Celery em prod, síncrono em dev, com fallback se o Redis falhar |
| Templates HTML | `apps/users/templates/emails/` (auth) e `apps/notifications/templates/emails/` (transacionais) — todos estendem `base_email.html` |
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
| 7 | Confirmação de alteração de password | ✅ | `send_password_changed_email` |
| 8 | Lembrete de verificação de conta (diário) | ✅ | `send_verification_reminders` (Celery beat) |
| 9 | Eliminação de conta não verificada (limpeza) | ⚠️ | `delete_stale_unverified_users` — apaga sem aviso; poderia enviar aviso prévio |
| 10 | Mudança de email do perfil | ❌ | Não implementado — campo `email` é read-only (sem fluxo de alteração) |
| 11 | Bloqueio/desativação de conta pelo admin | ✅ | `send_account_blocked_email` |

---

## 3. Lojas (`apps/stores`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Submissão de nova loja (registo do vendedor) | ✅ | `send_store_submitted_email` |
| 2 | Notificação ao admin de nova loja a rever | ✅ | `send_admin_alert_email` |
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
| 1 | **Stock baixo** (≤ limiar da loja) | ✅ | `send_low_stock_email` + `Notification` |
| 2 | Produto esgotado (`stock = 0`) | ❌ | Falta email |
| 3 | Produto publicado/ativado | ✅ | `send_new_product_email` + `Notification` (seguidores) |
| 4 | Produto desativado/suspenso pelo admin | ❌ | Falta email ao vendedor |
| 5 | Produto em destaque aprovado | ❌ | Oportunidade de email informativo |

---

## 5. Encomendas (`apps/orders`)

> Fluxo principal do marketplace. Confirmação, nova venda e envio já têm email; as
> restantes transições continuam só com `Notification` in-app.

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | **Encomenda criada** (confirmação ao comprador) | ✅ | `send_order_confirmation_email` |
| 2 | **Nova venda** (aviso ao vendedor) | ✅ | `send_new_sale_email` |
| 3 | Pagamento confirmado | ⚠️ | in-app — falta email |
| 4 | Encomenda **confirmada** pelo vendedor | ⚠️ | in-app |
| 5 | Encomenda **expedida** (com tracking) | ✅ | `send_order_shipped_email` |
| 6 | Encomenda **entregue** | ⚠️ | in-app (`auto_confirm_delivery` cria notificação) |
| 7 | Encomenda **cancelada** | ⚠️ | in-app |
| 8 | **Carrinho abandonado** | ✅ | `recover_abandoned_carts` (email + in-app) |
| 9 | Libertação de escrow ao vendedor | ⚠️ | `release_escrow_after_return_window` — sem email |

---

## 6. Devoluções & Reembolsos (`apps/orders` — returns)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Pedido de devolução criado (comprador) | ⚠️ | `return_update` in-app — falta email |
| 2 | Devolução aprovada / recusada | ✅ | `send_return_status_email` (buyer) |
| 3 | Devolução recebida no armazém | ✅ | `send_return_status_email` (buyer) |
| 4 | Reembolso processado | ✅ | `send_return_status_email` (buyer) |
| 5 | Devolução concluída | ✅ | `send_return_status_email` (buyer) |

---

## 7. Pagamentos & Carteira (`apps/wallet` / `apps/payments`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Pedido de saque (vendedor/afiliado) | ⚠️ | Alerta admin ✅; confirmação ao utilizador ❌ |
| 2 | Saque **aprovado** pelo admin | ❌ | Sem email |
| 3 | Saque **pago** (referência de pagamento) | ✅ | `send_payout_paid_email` |
| 4 | Saque **rejeitado** (com motivo) | ✅ | `send_payout_rejected_email` |
| 5 | Saldo creditado (venda liberada do escrow) | ❌ | Sem email |
| 6 | Falha/estorno de pagamento | ❌ | Sem email |

---

## 8. Afiliados (`apps/affiliates`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Comissão gerada (venda via link) | ⚠️ | `affiliate` in-app — falta email |
| 2 | Comissão **aprovada** (após janela de devolução) | ✅ | `send_affiliate_commission_email` |
| 3 | Comissão **rejeitada/clawback** | ⚠️ | in-app |
| 4 | Aprovação/rejeição do KYC de afiliado | ✅ | `send_kyc_status_email` |
| 5 | Mudança de tier (nível do programa) | ❌ | Sem email |

---

## 9. Cursos (`apps/courses`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Inscrição/compra de curso (confirmação + acesso) | ✅ | `send_course_enrollment_email` |
| 2 | Conclusão de curso / certificado | ✅ | `send_course_completion_email` (sem anexo de certificado) |
| 3 | Publicação de novo curso (vendedor) | ❌ | Sem email |
| 4 | Aprovação de curso pelo admin | ❌ | Sem email |

---

## 10. Chat & Mensagens (`apps/chat`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Nova mensagem não lida (comprador ↔ vendedor) | ✅ | Digest diário `send_chat_digest_email` (não em tempo real) |
| 2 | Nova conversa iniciada | ❌ | Sem email |

---

## 11. Avaliações (`apps/reviews`)

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Nova avaliação recebida (produto) | ✅ | `send_new_review_email` |
| 2 | Nova avaliação da loja | ✅ | `send_new_review_email` |
| 3 | Resposta do vendedor a uma avaliação | ✅ | `send_review_reply_email` |
| 4 | Avaliação removida/ocultada (moderação) | ❌ | Sem email |

---

## 12. Administração & Suporte

| # | Actividade / Gatilho | Estado | Observações |
|---|---|---|---|
| 1 | Novo ticket de suporte criado | ✅ | `send_ticket_email` (confirmação) |
| 2 | Ticket respondido pelo admin | ⚠️ | in-app — falta email |
| 3 | Ticket resolvido/fechado | ✅ | `send_ticket_email` (actualização) |
| 4 | Aviso ao admin: nova loja / novo saque / novo ticket / disputa | ✅ | `send_admin_alert_email` |
| 5 | Aviso de pico de erros 5xx | ✅ | `AdminEmailHandler` em `django.request` (ERROR) |

---

## 13. Tarefas agendadas (Celery Beat) que tocam email

| Tarefa | Frequência | Envia email? |
|---|---|---|
| `auto-refund-unprocessed-returns` | hora | ❌ (só in-app) |
| `auto-confirm-delivery` | hora | ❌ (só in-app) |
| `recover-abandoned-carts` | hora | ✅ |
| `auto-approve-affiliate-commissions` | hora | ✅ |
| `release-escrow-after-return-window` | hora | ❌ |
| `delete-stale-unverified-users` | diário | ❌ (podia avisar antes) |
| `send-verification-reminders` | diário | ✅ |
| `send-unread-chat-digests` | diário | ✅ |
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
- **Links públicos** (não hardcoded): os emails de loja já usam `https://e-shoppingcentre.com` (corrigido); o `SITE_URL` existe para unificar futuros emails.

---

## 16. Estado de implementação

Fases concluídas (2026-08-19):

| Fase | Âmbito | Estado |
|---|---|---|
| Fase 0 | Serviço central `apps/notifications/email_service.py` + templates | ✅ |
| Fase 1 | Encomendas (confirmação/nova venda/envio), saques (pago/rejeitado), comissão de afiliado, loja submetida | ✅ |
| Fase 2 | Stock baixo, novo produto (seguidores), devoluções, tickets, digest de chat | ✅ |
| Fase 3 | Password alterada, conta bloqueada, KYC, avaliações, cursos | ✅ |
| Fase 4 | Alertas admin (loja/saque/ticket/disputa) e erros 5xx (`AdminEmailHandler`) | ✅ |

**Itens que permanecem por fazer (fora do âmbito):**
- Confirmação de email ao utilizador no **pedido de saque** (só foi feito alerta admin).
- Email no **saque aprovado** (só pago e rejeitado têm email).
- **Mudança de email** de perfil (o campo `email` é read-only — exige fluxo novo com verificação).
- Email de **pagamento confirmado / encomenda confirmada / entregue / cancelada** (só in-app).
- Email no **pedido de devolução criado** e **avaliação removida/ocultada**.
- Email de **publicação/aprovação de curso** e **tier de afiliado**.
- Email em tempo real por **nova conversa/mensagem de chat** (existe apenas digest diário).
- Certificado de curso em anexo (o email de conclusão existe, mas sem PDF).
