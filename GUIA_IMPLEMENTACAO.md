# 🚀 Guia de Implementação — Lojas Digitais eShoppingCentre

> Versão: 1.0 — 10 de Agosto de 2026
> Foco: Produtos Digitais + Cursos + Infraestrutura Cloudflare
> Sem código — guia de arquitectura, decisões e passos

---

## Índice

1. [Resumo das Tarefas](#1-resumo-das-tarefas)
2. [Configurar Cloudflare R2](#2-configurar-cloudflare-r2)
3. [Configurar Cloudflare Stream](#3-configurar-cloudflare-stream)
4. [Download Digital Seguro](#4-download-digital-seguro)
5. [Auto-Enrollment após Pagamento Real](#5-auto-enrollment-após-pagamento-real)
6. [Wallet Payout (Saque do Vendedor)](#6-wallet-payout-saque-do-vendedor)
7. [Emails Transacionais](#7-emails-transacionais)
8. [Cálculo de Frete](#8-cálculo-de-frete)
9. [Cupões no Checkout](#9-cupões-no-checkout)
10. [Certificados de Conclusão](#10-certificados-de-conclusão)
11. [SEO Técnico](#11-seo-técnico)
12. [Cronograma](#12-cronograma)

---

## 1. Resumo das Tarefas

| # | Tarefa | Prioridade | Esforço | Dependências |
|---|--------|:----------:|:-------:|-------------|
| 1 | Configurar Cloudflare R2 | 🔴 Crítica | 2h | Conta Cloudflare |
| 2 | Verificar Cloudflare Stream | 🔴 Crítica | 30min | Conta Cloudflare |
| 3 | Download Digital Seguro | 🔴 Crítica | 3 dias | R2 configurado |
| 4 | Auto-Enrollment pós-pagamento | 🔴 Crítica | 1 dia | — |
| 5 | Wallet Payout real | 🔴 Crítica | 3 dias | APIs M-Pesa/e-Mola |
| 6 | Emails Transacionais | 🔴 Crítica | 2 dias | SMTP/Resend |
| 7 | Cálculo de Frete | 🟡 Alta | 3 dias | — |
| 8 | Cupões no Checkout | 🟡 Alta | 2 dias | — |
| 9 | Certificados PDF | 🟡 Alta | 2 dias | — |
| 10 | SEO (Sitemap, Schema) | 🟡 Alta | 1 dia | — |

---

## 2. Configurar Cloudflare R2

### 2.1 O que é

Cloudflare R2 é um serviço de object storage (como AWS S3) mas **sem taxas de egress** (banda de saída). Vai armazenar:
- Ficheiros digitais para download (PDF, ZIP, MP3, MP4)
- Documentos KYC dos vendedores (BI, NUIT)
- Anexos de cursos (slides, PDFs, exercícios)

### 2.2 Passo a Passo

**Passo 1 — Criar conta Cloudflare**
- Aceder a https://dash.cloudflare.com/sign-up
- Registar com email e password
- Verificar email

**Passo 2 — Activar R2**
- No dashboard, menu lateral esquerdo: R2 → Overview
- Clicar "Set up R2" ou "Purchase R2" (plano gratuito: 10 GB grátis)
- Confirmar plano (Pay-as-you-go após 10 GB)

**Passo 3 — Criar Bucket**
- R2 → Overview → "Create bucket"
- Nome: `eshoppingcentre-media`
- Região: `EEUR` (Europa) ou `APAC` — escolher a mais próxima de Moçambique
  - Sugestão: `EEUR` se não houver opção África (menor latência que US)
- Localização: usar o hint de latência no dashboard
- Clicar "Create bucket"

**Passo 4 — Criar API Token**
- R2 → Overview → "Manage R2 API Tokens" (canto superior direito)
- "Create API Token"
- Nome: `eshoppingcentre-backend`
- Permissões: "Object Read & Write"
- Especificar bucket: `eshoppingcentre-media`
- Copiar e guardar:
  - **Access Key ID** (ex: `abc123...`)
  - **Secret Access Key** (ex: `xyz789...`)
  - **Endpoint** (ex: `https://<account-id>.r2.cloudflarestorage.com`)

**Passo 5 — Configurar CORS (opcional)**
- R2 → Bucket `eshoppingcentre-media` → Settings → CORS
- Adicionar regra para permitir o domínio do frontend

**Passo 6 — Configurar no projeto**
- Adicionar ao `.env` do backend:

```
# Cloudflare R2 (S3-compatible)
AWS_ACCESS_KEY_ID=<Access Key ID do passo 4>
AWS_SECRET_ACCESS_KEY=<Secret Access Key do passo 4>
AWS_STORAGE_BUCKET_NAME=eshoppingcentre-media
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
```

- O código em `backend/config/settings/production.py` já está preparado — se `AWS_STORAGE_BUCKET_NAME` existir, usa S3; senão, usa filesystem local.

### 2.3 Estrutura de Pastas no Bucket

```
eshoppingcentre-media/
├── public/
│   ├── products/images/
│   ├── stores/logos/
│   ├── stores/banners/
│   ├── categories/
│   └── blog/
└── protected/
    ├── products/digital/
    ├── stores/documents/
    └── courses/attachments/
```

### 2.4 Verificação

- Subir backend com as env vars e fazer upload de uma imagem de produto
- Verificar no dashboard R2 se o ficheiro aparece
- Confirmar que o frontend consegue carregar a imagem via URL do Cloudflare

---

## 3. Configurar Cloudflare Stream

### 3.1 O que já está implementado

- Modelo `CourseLesson` com campos `cloudflare_video_uid`, `cloudflare_video_status`, `video_duration_seconds`, `video_thumbnail`
- Serviço `cloudflare_stream.py` com `create_direct_upload()`, `get_video_status()`, `generate_stream_token()`, `get_stream_url()`
- Endpoints: upload URL, video status, stream token, webhook
- Frontend: `VideoUploader.tsx` e `CourseVideoPlayer.tsx` já integrados
- Player Cloudflare com iframe e token JWT assinado

### 3.2 O que verificar

**Passo 1 — Activar Cloudflare Stream**
- Dashboard Cloudflare → Stream → Overview
- Activar o serviço (plano: $1 por 1000 minutos armazenados + $1 por 1000 minutos visualizados)

**Passo 2 — Criar API Token para Stream**
- Cloudflare Dashboard → Manage API Tokens
- Criar token com permissão: Account → Stream → Edit
- Copiar o token

**Passo 3 — Verificar env vars no projeto**
```
CLOUDFLARE_ACCOUNT_ID=<Account ID do dashboard>
CLOUDFLARE_API_TOKEN=<Token do passo 2>
CLOUDFLARE_STREAM_DOMAIN=customer-xxxxx.cloudflarestream.com
CLOUDFLARE_JWT_SECRET=<chave secreta para assinar tokens de visualização>
CLOUDFLARE_STREAM_SIGNING_SECRET=<chave secreta para verificar webhooks>
```

**Passo 4 — Criar JWT Secret para Stream**
- Gerar uma chave aleatória (base64, 32+ caracteres)
- Configurar no Cloudflare Stream → Settings → Signing Keys
- Usar o mesmo valor em `CLOUDFLARE_JWT_SECRET`

**Passo 5 — Testar o fluxo**
- Criar um curso → adicionar módulo → adicionar aula
- Fazer upload de vídeo via Course Builder
- Verificar status até ficar "ready"
- Comprar o curso (modo teste) → aceder à aula → verificar player

### 3.3 O que ainda não está perfeito

| Item | Estado | Acção |
|------|:------:|-------|
| JWT signing key | Pode estar hardcoded | Mover para env var |
| Webhook signature | Skip se não configurado | Configurar signing secret |
| Rate limiting | 60 tokens/min | OK para MVP |
| Thumbnails | OK via status poll | OK |

---

## 4. Download Digital Seguro

### 4.1 Arquitectura do Fluxo

```
Cliente → "Descarregar" 
  → GET /api/v1/products/downloads/{id}/token/      (gera JWT de 5 min)
  → 302 Redirect para S3 Presigned URL              (expira em 60s)
  → Browser faz download directo do R2              (zero carga no Django)
```

### 4.2 O que Criar

**Backend — Novo ficheiro:** `backend/apps/products/views_downloads.py`
- View `MyDownloadsView`: lista downloads do utilizador (nome, formato, tamanho, downloads restantes, expiração, data compra)
- View `DownloadTokenView`: gera token JWT assinado com `user_id`, `download_id`, `exp` de 5 minutos, `jti` único
- View `DownloadFileView`: valida token JWT, verifica limites (`download_count < download_limit`, `expires_at > now`), incrementa contador, gera presigned URL e faz redirect HTTP 302

**Backend — Novo ficheiro:** `backend/apps/products/serializers_downloads.py`
- Serializer para listagem de downloads com campos: nome do produto, formato, tamanho, downloads restantes, estado, data compra, número da encomenda

**Backend — URL:** Adicionar rotas em `backend/apps/products/urls.py` ou novo `urls_downloads.py`

**Backend — Sinal:** Criar signal `post_save` em `PaymentTransaction` que quando `status` muda para `completed`, chama `_process_delivery()` para libertar downloads e matrículas

**Frontend — Actualizar página:** `frontend/app/account/downloads/page.tsx`
- Consumir API `GET /products/downloads/`
- Tabela com: ícone do formato, nome, downloads restantes, data compra, botão "Descarregar"
- Botão desabilitado quando: limite atingido ou expirado
- Lógica de download: pedir token → criar link invisível → download via browser

**Nginx — Proteger ficheiros locais (dev):**
- Separar `/media/public/` (acesso directo) de `/media/protected/` (bloqueado com `internal;`)
- Em produção, esta protecção é feita pelo R2 com presigned URLs

### 4.3 Decisões de Segurança

| Decisão | Motivo |
|---------|--------|
| URL nunca exposta no HTML | Previne hotlinking e partilha de links |
| Token JWT de 5 min | Janela curta para replay attacks |
| Presigned URL de 60s | S3 gera, expira rápido, não passa pelo Django |
| Redirect em vez de stream | Zero CPU/memória no servidor Django |
| Contador de downloads atómico | `download_count += 1` com `update_fields` |

---

## 5. Auto-Enrollment após Pagamento Real

### 5.1 Problema Actual

O `CreateOrderSerializer._process_delivery()` só é chamado se `payment_status='completed'` no momento da criação da order. Com M-Pesa/e-Mola, o pagamento é confirmado de forma assíncrona (via callback/polling), portanto a order é criada com `payment_status='pending'`.

### 5.2 Solução

**Opção A — Signal no PaymentTransaction (Recomendado)**
- Criar `signals.py` em `apps/payments/`
- `post_save` no modelo `PaymentTransaction`: quando `status` muda para `completed`, disparar Celery task que chama `_process_delivery(order)`
- Vantagem: desacoplado, reutiliza lógica existente do `CreateOrderSerializer`

**Opção B — No callback/webhook do M-Pesa**
- No endpoint que recebe o callback do M-Pesa, após confirmar pagamento, chamar `_process_delivery()`
- Desvantagem: duplicação de lógica se houver múltiplos provedores

### 5.3 O que Criar

- `backend/apps/payments/signals.py` — signal `post_save` em `PaymentTransaction`
- `backend/apps/payments/tasks.py` — Celery task `process_digital_delivery(order_id)`
- `backend/apps/payments/apps.py` — registar signals no `ready()`
- Extrair `_process_delivery` para um serviço partilhado (`apps/orders/services.py`) para reutilização

### 5.4 Verificação

- Criar encomenda com produto digital/curso via M-Pesa (modo teste)
- Confirmar pagamento via admin
- Verificar que `DigitalDownload`/`Enrollment` foi criado
- Verificar que aparece em `/account/downloads` e `/my-courses`

---

## 6. Wallet Payout (Saque do Vendedor)

### 6.1 Problema Actual

`WalletPayoutView` retorna `"Solicitação de saque recebida."` mas não processa nada.

### 6.2 Arquitectura do Fluxo

```
Vendedor → Dashboard → Carteira → Solicitar Saque
  → Escolhe método (M-Pesa, e-Mola, Conta Bancária)
  → Insere valor e detalhes
  → Sistema verifica:
      ✓ Saldo disponível >= valor solicitado
      ✓ Valor >= mínimo (ex: 500 MZN)
      ✓ Período de retenção cumprido (ex: 7 dias após venda)
      ✓ Sem saques pendentes
  → Cria WalletTransaction (type='withdrawal', status='pending')
  → Admin aprova ou sistema automático (até X valor)
  → Dispara disbursement via API M-Pesa/e-Mola
  → Atualiza status: completed / failed
  → Notifica vendedor (email + in-app)
```

### 6.3 O que Criar

**Backend — Modelo novo/alterações:**
- Campo `payout_method` e `payout_details` no modelo `Wallet` ou tabela separada `PayoutMethod`
- Novo modelo `PayoutRequest` com: `wallet`, `amount`, `method`, `status` (pending/processing/completed/failed), `provider_reference`, `admin_notes`

**Backend — Serviços:**
- `apps/wallet/services.py`: função `request_payout(wallet, amount, method, details)` que valida saldo e cria `PayoutRequest`
- `apps/payments/services.py`: função `disburse_mpesa(phone, amount, reference)` que chama API M-Pesa B2C
- `apps/payments/services.py`: função `disburse_emola(phone, amount, reference)` que chama API e-Mola

**Backend — Views:**
- `POST /api/v1/wallet/payout/` — solicitar saque (substituir placeholder actual)
- `GET /api/v1/wallet/payouts/` — histórico de saques
- `GET /api/v1/wallet/payouts/{id}/` — detalhe de saque

**Backend — Admin:**
- Acção "Aprovar saque" no Django Admin
- Registo de quem aprovou e quando

**Frontend — Páginas:**
- Página de saque: formulário com método, valor (slider com saldo disponível), confirmação
- Histórico na carteira com estados visuais (pending = amarelo, completed = verde, failed = vermelho)

### 6.4 Regras de Negócio

| Regra | Valor |
|-------|-------|
| Saque mínimo | 500 MZN |
| Período de retenção | 7 dias após confirmação do pagamento |
| Saque máximo automático | 10.000 MZN (acima: aprovação manual) |
| Frequência máxima | 1 saque a cada 24h |
| Métodos disponíveis | M-Pesa, e-Mola, Transferência Bancária |
| Taxa de saque | 2% (configurável por settings) |

---

## 7. Emails Transacionais

### 7.1 O que Implementar

| Email | Gatilho | Prioridade |
|-------|---------|:----------:|
| Verificação de email | Registo de utilizador | 🔴 |
| Recuperação de senha | "Esqueci senha" | 🔴 |
| Confirmação de encomenda | Order criada | 🔴 |
| Pagamento confirmado | PaymentTransaction completed | 🔴 |
| Loja aprovada | Store status → active | 🔴 |
| Loja rejeitada | Store status → rejected | 🔴 |
| Curso comprado | Enrollment criado | 🟡 |
| Nova mensagem | Chat: nova mensagem (se offline há >1h) | 🟡 |
| Saque processado | PayoutRequest completed/failed | 🟡 |
| Produto avaliado | Novo review recebido (vendor) | 🟢 |

### 7.2 Provedor de Email

| Provedor | Preço | Limite Grátis |
|----------|-------|:-------------:|
| **Resend** | $20/mês (50k emails) | 100/dia |
| **SendGrid** | $20/mês (50k emails) | 100/dia |
| **AWS SES** | $0.10/1000 emails | 62.000/mês (via EC2) |
| **Mailgun** | $35/mês (50k emails) | — |

**🥇 Recomendação: Resend** — SDK React/Node nativo, templates em React, dashboard simples.

### 7.3 O que Criar

- `backend/apps/core/email.py` — serviço central de envio (wrapper sobre Resend SDK)
- Templates HTML para cada tipo de email (React Email ou MJML)
- `backend/apps/notifications/tasks.py` — Celery tasks para envio assíncrono
- Sinais: `post_save` em Store, Order, PaymentTransaction, Enrollment
- Variáveis de ambiente: `RESEND_API_KEY`, `EMAIL_FROM`

---

## 8. Cálculo de Frete

### 8.1 Modelo de Dados

Novo modelo `ShippingZone`:
- Nome da zona (ex: "Maputo Cidade", "Maputo Província", "Sul", "Centro", "Norte")
- Países/Províncias incluídas
- Preço base
- Preço por kg adicional
- Frete grátis acima de valor X (opcional)
- Tempo estimado de entrega

Novo modelo `ShippingMethod`:
- Vinculado à loja
- Nome (ex: "Entrega Standard", "Expresso")
- Zonas onde está disponível
- Preços por zona

### 8.2 Endpoints

- `GET /api/v1/shipping/estimate/` — calcula frete com base no carrinho + morada
- `GET /api/v1/shipping/zones/` — lista zonas disponíveis
- `POST /api/v1/seller/shipping/methods/` — vendor cria método
- `PUT /api/v1/seller/shipping/methods/{id}/` — vendor edita

### 8.3 Integração no Checkout

- `CheckoutContent.tsx` chama endpoint de estimativa quando morada muda
- Mostra opções de envio com preço e prazo estimado
- `CreateOrderSerializer` recebe `shipping_method_id` e calcula `shipping_cost`

---

## 9. Cupões no Checkout

### 9.1 O que já existe

Modelo `Coupon` completo com: código, tipo (% ou fixo), valor, compra mínima, usos máximos, validade, por produto/categoria.

### 9.2 O que falta

**Backend:**
- Validar cupão no `CreateOrderSerializer`: verificar código, data, usos restantes, valor mínimo
- Aplicar desconto no `total`
- Incrementar `used_count`
- Registar cupão usado na order (campo `coupon` FK)

**Frontend:**
- Campo "Código de desconto" no checkout
- Validação visual: cupão aplicado (verde) vs inválido (vermelho)
- Mostrar desconto na linha de total

### 9.3 Endpoint

- `POST /api/v1/coupons/validate/` — recebe `{ code, cart_total }` e retorna desconto calculado

---

## 10. Certificados de Conclusão

### 10.1 Requisitos

- Gerar PDF quando `enrollment.completed = True`
- Template com: nome do aluno, nome do curso, nome do instrutor, data de conclusão, logo da plataforma
- ID único verificável (URL pública: `/certificates/{uuid}`)
- Página pública de verificação

### 10.2 Tecnologia

- Biblioteca: **WeasyPrint** (HTML → PDF, mais leve que ReportLab)
- Template HTML/CSS inline
- Armazenar PDF no R2 (`protected/certificates/`)

### 10.3 O que Criar

- Modelo `Certificate`: `enrollment`, `certificate_number` único, `pdf_file`, `issued_at`
- Signal `post_save` em `Enrollment` — quando `completed` muda para `True`, gera PDF via Celery
- View pública `CertificateVerifyView`: por `certificate_number`, mostra info do certificado
- Página no frontend: `/certificates/{number}` — página pública de verificação
- Botão "Certificado" em `/my-courses` quando curso concluído

---

## 11. SEO Técnico

### 11.1 O que Criar

**Sitemap.xml Dinâmico:**
- Ficheiro `frontend/app/sitemap.xml/route.ts` (Next.js App Router)
- Incluir: páginas estáticas, produtos, categorias, lojas, cursos, blog
- Actualização: via `revalidate` ou ISR

**Robots.txt:**
- Ficheiro `frontend/app/robots.txt/route.ts`
- Permitir indexação de páginas públicas, bloquear admin/seller/account

**Schema.org JSON-LD:**
- Componentes React que injectam `<script type="application/ld+json">` no `<head>`
- Tipos: `Product`, `Course`, `Store`, `BreadcrumbList`, `Organization`
- Páginas: `/product/[slug]`, `/courses/[slug]`, `/store/[slug]`

### 11.2 Páginas a Cobrir com Schema

| Página | Schema Type |
|--------|------------|
| Home | `Organization` + `WebSite` |
| Produto | `Product` + `Offer` + `BreadcrumbList` |
| Curso | `Course` + `BreadcrumbList` |
| Loja | `LocalBusiness` ou `Store` |
| Blog Post | `Article` + `BreadcrumbList` |
| Pesquisa | `SearchAction` (no `WebSite`) |

---

## 12. Cronograma

```
SEMANA 1-2: CRÍTICO (Corrigir o que não funciona)
├── Dia 1: Configurar Cloudflare R2 + Stream ✓
├── Dia 2-4: Download Digital Seguro (backend + frontend)
├── Dia 5: Auto-Enrollment via Signal/Celery
├── Dia 6-7: Wallet Payout (modelo + serviço M-Pesa)
├── Dia 8-10: Emails Transacionais (templates + Celery)

SEMANA 3-5: ALTA PRIORIDADE
├── Dia 11-13: Cálculo de Frete
├── Dia 14-15: Cupões no Checkout
├── Dia 16-17: Certificados PDF
├── Dia 18: SEO (Sitemap + Robots + Schema)

SEMANA 6+: PADRÃO INTERNACIONAL
├── Login social (Google)
├── 2FA para vendedores
├── Watermark em PDFs
├── i18n (multi-idioma)
├── CDN para assets estáticos
└── Monitorização (Sentry)
```

---

## Anexo A — Variáveis de Ambiente Completas

```
# .env (backend)

# Django
SECRET_KEY=...
DJANGO_SETTINGS_MODULE=config.settings.production
DEBUG=False
ALLOWED_HOSTS=api.eshoppingcentre.co.mz,localhost

# Database
DB_NAME=eshoppingcentre
DB_USER=...
DB_PASSWORD=...
DB_HOST=db
DB_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0

# Cloudflare R2 (Object Storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=eshoppingcentre-media
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com

# Cloudflare Stream (Vídeos)
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_STREAM_DOMAIN=customer-xxxxx.cloudflarestream.com
CLOUDFLARE_JWT_SECRET=...
CLOUDFLARE_STREAM_SIGNING_SECRET=...

# Email (Resend)
RESEND_API_KEY=...
EMAIL_FROM=noreply@eshoppingcentre.co.mz

# Firebase Auth
FIREBASE_SERVICE_ACCOUNT_KEY=/app/credentials/firebase-adminsdk.json

# M-Pesa
MPESA_API_KEY=...
MPESA_PUBLIC_KEY=...
MPESA_ENVIRONMENT=sandbox

# e-Mola
EMOLA_API_KEY=...
EMOLA_API_SECRET=...
EMOLA_ENVIRONMENT=sandbox

# Payments
PLATFORM_FEE_PERCENTAGE=8
HOLD_PERIOD_DAYS=7
MINIMUM_PAYOUT=500
MAX_AUTO_PAYOUT=10000
PAYOUT_FEE_PERCENTAGE=2
```

---

## Anexo B — Estrutura de Ficheiros a Criar/Modificar

```
backend/
├── apps/
│   ├── products/
│   │   ├── views_downloads.py       ← NOVO
│   │   ├── serializers_downloads.py ← NOVO
│   │   └── urls.py                  ← MODIFICAR
│   ├── payments/
│   │   ├── signals.py               ← NOVO
│   │   ├── tasks.py                 ← NOVO (se não existir)
│   │   └── apps.py                  ← MODIFICAR
│   ├── orders/
│   │   └── services.py              ← NOVO (extrair _process_delivery)
│   ├── wallet/
│   │   ├── models.py                ← MODIFICAR (PayoutRequest)
│   │   ├── services.py              ← NOVO
│   │   └── views.py                 ← MODIFICAR
│   ├── core/
│   │   └── email.py                 ← NOVO
│   ├── courses/
│   │   ├── models.py                ← MODIFICAR (Certificate)
│   │   └── views_certificates.py    ← NOVO
│   └── shipping/                    ← NOVO (app inteira)
│       ├── models.py
│       ├── views.py
│       ├── serializers.py
│       └── urls.py
├── config/
│   ├── settings/
│   │   ├── base.py                  ← MODIFICAR (STORAGES)
│   │   └── production.py            ← MODIFICAR (R2 config)
│   └── celery.py                    ← MODIFICAR (novas tasks)
└── templates/
    └── emails/                      ← NOVO (templates HTML)

frontend/
├── app/
│   ├── account/
│   │   └── downloads/
│   │       └── page.tsx             ← MODIFICAR
│   ├── certificates/
│   │   └── [number]/
│   │       └── page.tsx             ← NOVO
│   ├── sitemap.xml/
│   │   └── route.ts                 ← NOVO
│   └── robots.txt/
│       └── route.ts                 ← NOVO
└── src/
    ├── components/
    │   ├── DigitalDownloadCard.tsx   ← NOVO
    │   ├── PayoutForm.tsx            ← NOVO
    │   └── SchemaOrg.tsx             ← NOVO
    └── lib/
        └── api.ts                    ← MODIFICAR (novos tipos)
```

---

*Guia gerado com base no diagnóstico completo de 10/08/2026. Sem código — apenas arquitectura, decisões e passos.*
