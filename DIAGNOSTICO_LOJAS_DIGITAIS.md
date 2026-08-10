# 🔍 Diagnóstico: Lojas de Produtos Digitais — Funcionamento, Gaps & Padrões Internacionais

> Data: 10 de Agosto de 2026  
> Escopo: Mapeamento completo do ecossistema de lojas digitais (digital + cursos) no eShoppingCentre

---

## 1. ARQUITETURA GERAL

### 1.1 Modelo de Dados — Tipos de Loja

```
Store.product_type ∈ { 'physical', 'digital', 'course' }
```

Cada loja é **bloqueada a um único tipo** no momento do registo (`product_type` torna-se `read_only` após criação). O `StoreDetailSerializer.__init__` força `self.fields['product_type'].read_only = True` quando `instance is not None`.

| Tipo | Produtos | Comissão Afiliado | Stock | Envio Físico |
|------|----------|-------------------|-------|-------------|
| `physical` | Produtos físicos | 10% | Sim | Sim |
| `digital` | Downloads (PDF, ZIP, MP3, etc.) | 15% | Não (stock=0) | Não |
| `course` | Cursos online (vídeo Cloudflare) | 20% | Não (stock=0) | Não |

**Defaults aplicados no `StoreRegisterView.perform_create()`.**

### 1.2 Modelo de Dados — Produtos

`Product` tem campos **híbridos** — serve os 3 tipos. Campos específicos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `digital_file` | FileField | Arquivo para download (produtos digitais) |
| `digital_file_size` | CharField | Tamanho formatado (ex: "2.5 MB") |
| `digital_format` | CharField | PDF, ZIP, MP3, MP4, etc. |
| `digital_version` | CharField | "v1.0", "2026 Edition" |
| `digital_license` | ChoiceField | personal / commercial / extended |
| `digital_compatibility` | CharField | Requisitos de sistema |
| `download_limit` | PositiveInteger | Máx downloads (default: 3) |
| `download_expiry_days` | PositiveInteger | Dias até expirar (default: 365) |

### 1.3 Modelo de Dados — Cursos

```
Course ──1:N──> CourseModule ──1:N──> CourseLesson ──1:N──> LessonAttachment
  │                 │                        │
  │                 └──1:N── Quiz ──1:N── Question ──1:N── AnswerOption
  │
  └──1:N── Enrollment ──1:N── LessonProgress
                │
                └──1:N── QuizAttempt ──1:N── QuizAnswer
```

- `Course` tem `OneToOneField` para `Product` (1 produto = 1 curso)
- `CourseLesson` suporta Cloudflare Stream (`cloudflare_video_uid`, `cloudflare_video_status`)
- `Enrollment` com `access_expires_at` (null = vitalício)
- `LessonProgress` tracking por aula (watched_duration, completed)
- `Quiz` vinculado a módulo e opcionalmente a aula

---

## 2. O QUE ESTÁ IMPLEMENTADO ✅

### 2.1 Backend — APIs Completas

| Área | Endpoints | Estado |
|------|-----------|:------:|
| **Stores** | CRUD, registo, follow/unfollow, stats, earnings | ✅ |
| **Products** | List, detail, search, my products, update, categories | ✅ |
| **Courses** | List, detail (slug), builder, learn, modules CRUD, lessons CRUD, enrollment, progress, students list | ✅ |
| **Quizzes** | Quiz CRUD, question CRUD, attempt start/submit, results | ✅ |
| **Cloudflare** | Upload URL, video status, stream token (JWT signed), webhook | ✅ |
| **Attachments** | Upload, list, delete por lesson | ✅ |
| **Course Reviews** | Create, list, stats, reply, my reviews | ✅ |
| **Orders** | Create, my orders, store orders, cancel, returns | ✅ |
| **Wallet** | My wallet, transactions, payout (placeholder) | 🟡 |
| **Affiliates** | Profile, links, commissions | ✅ |
| **Chat** | Conversations, messages (WebSocket + REST) | ✅ |
| **Notifications** | Model exists | 🟡 |

### 2.2 Frontend — Páginas Implementadas

| Página | Rota | Estado |
|--------|------|:------:|
| Catálogo de Cursos | `/courses` | ✅ Consome API real |
| Detalhe do Curso | `/courses/[slug]` | ✅ Reviews, buy, enrollment check |
| Meus Cursos | `/my-courses` | ✅ Progresso, acesso, review |
| Página da Loja | `/store/[slug]` | ✅ Owner editable, produtos, reviews |
| Lista de Lojas | `/stores` | ✅ Consome API real |
| Seller Dashboard | `/seller/dashboard` | ✅ Stats, gráficos |
| Seller Produtos | `/seller/products` | ✅ CRUD com filtro por tipo |
| Seller Cursos | `/seller/courses` | ✅ Lista, delete |
| Course Builder | `/seller/courses/[id]/builder` | ✅ Módulos, aulas, video upload, quizzes, attachments |
| Course Edit | `/seller/courses/[id]/edit` | ✅ Metadados |
| Novo Produto | `/seller/products/new` | ✅ Form unificado (physical/digital/course) |
| Checkout | `/checkout` | ✅ Fluxo completo |
| Carrinho | `/cart` | ✅ Multi-loja |
| Account Downloads | `/account/downloads` | 🟡 |

### 2.3 Infraestrutura Técnica

| Componente | Estado |
|------------|:------:|
| Docker (Dockerfile + docker-compose) | ✅ |
| Django Channels (WebSocket) | ✅ |
| Celery configurado | ✅ |
| JWT Auth com refresh token | ✅ |
| Cloudflare Stream (DRM, token JWT) | ✅ |
| PWA (service worker, manifest) | ✅ |
| Mensagens encriptadas (AES) | ✅ |
| Rate limiting (stream tokens) | ✅ |

---

## 3. O QUE ESTÁ FALTANDO 🔴

### 3.1 GAPS CRÍTICOS (Quebram funcionalidade core)

#### 🔴 #1 — Download Digital NÃO funciona

**Problema:** O modelo `DigitalDownload` é criado no `CreateOrderSerializer._process_delivery()`, mas **não existe endpoint para o cliente fazer download do ficheiro**.

```python
# backend/apps/products/models_digital.py — modelo existe:
class DigitalDownload(BaseModel):
    user = models.ForeignKey(...)
    product = models.ForeignKey(...)
    order = models.ForeignKey(...)
    download_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
```

**Falta:**
- View para servir o ficheiro com URL assinada/temporária
- Verificação de `download_limit` e `download_expiry_days`
- Incremento de `download_count` a cada download
- Streaming do ficheiro com `FileResponse` ou X-Sendfile

**Impacto:** Cliente compra produto digital mas não consegue descarregar. 🚫

---

#### 🔴 #2 — Wallet Payout (Saque) é Placeholder

```python
# backend/apps/wallet/views.py
class WalletPayoutView(APIView):
    def post(self, request):
        return Response({'detail': 'Solicitação de saque recebida.'}, status=200)
        # NÃO FAZ NADA — não processa M-Pesa, e-Mola, nem banco
```

**Falta:**
- Integração real com API M-Pesa/e-Mola para disbursement
- Verificação de saldo disponível
- Período de retenção (hold period para proteção ao comprador)
- Histórico de levantamentos
- Estados: pending → processing → completed / failed
- Notificação ao vendor

**Impacto:** Vendedor acumula saldo mas nunca consegue sacar. 🚫

---

#### 🔴 #3 — Auto-Enrollment após pagamento real

**Problema:** A matrícula em cursos e libertação de downloads só acontece quando `payment_status='completed'` no momento da criação da order. Com pagamentos reais (M-Pesa callback assíncrono), o pagamento é confirmado depois.

```python
# CreateOrderSerializer.create():
if order.payment_status == 'completed':  # só funciona em modo teste
    self._process_delivery(order)
```

**Falta:**
- Signal ou callback no `PaymentTransaction` quando status muda para `completed`
- Trigger de `_process_delivery()` no webhook/callback do M-Pesa
- Celery task para retry em caso de falha

**Impacto:** Cliente paga via M-Pesa mas não ganha acesso ao curso/download. 🚫

---

#### 🔴 #4 — Emails Transacionais (Zero implementação)

Não há envio de emails em nenhum ponto do sistema:
- Verificação de email no registo
- Confirmação de encomenda
- Loja aprovada/rejeitada
- Curso comprado (com link de acesso)
- Recuperação de senha
- Notificação de nova mensagem no chat

**Impacto:** Experiência de onboarding incompleta; sem recuperação de senha. 🚫

---

### 3.2 GAPS DE ALTA PRIORIDADE

#### 🟡 #5 — Cálculo de Frete

Modelo `Order` tem `shipping_cost` mas o checkout não calcula frete real. Para lojas `physical` é essencial; para `digital`/`course` é sempre 0 (já tratado).

**Falta:**
- Modelo de zonas de entrega (províncias/cidades)
- Tabela de preços por peso/dimensões
- Frete grátis acima de valor X
- Endpoint de estimativa no checkout

---

#### 🟡 #6 — Cupões no Checkout

Modelo `Coupon` existe (com validação de `is_valid`, datas, limites), mas o `CreateOrderSerializer` não tem campo para `coupon_code` nem lógica de aplicação.

---

#### 🟡 #7 — Certificado de Conclusão (PDF)

`Course.certificate_enabled = True` mas não há geração de PDF. Campos necessários:
- Nome do aluno, nome do curso, data de conclusão
- ID único de verificação (URL pública)
- Template visual com logo da plataforma

---

#### 🟡 #8 — Downloads Seguros (Digital)

- URLs de download não são assinadas (token único, expira em X minutos)
- Não há proteção contra hotlinking (Referer check)
- Watermark dinâmico não implementado

---

#### 🟡 #9 — Tracking de Afiliados (Cookie)

Modelo `AffiliateLink` existe mas não há cookie de atribuição (30 dias padrão). Quando um cliente clica num link de afiliado e compra dias depois, a comissão não é atribuída.

---

### 3.3 GAPS DE MÉDIA PRIORIDADE

| # | Funcionalidade | Impacto |
|---|---------------|---------|
| 10 | **Múltiplos admins por loja** | Lojas grandes precisam de equipa |
| 11 | **Flash sales** | Urgência e conversão |
| 12 | **Preview de produto digital** | Amostra antes de comprar |
| 13 | **Importação/Exportação CSV** | Gestão de catálogo em massa |
| 14 | **Sitemap.xml / robots.txt** | SEO — zero indexação orgânica |
| 15 | **Schema.org JSON-LD** | Rich snippets no Google |
| 16 | **Login social (Google, Facebook)** | Conversão de registo |
| 17 | **2FA** | Segurança de vendedores |
| 18 | **Q&A por produto** | Perguntas públicas + resposta do vendor |
| 19 | **Fórum do curso** | Alunos interagem entre si |
| 20 | **Aulas ao vivo (Zoom/Meet)** | Integração com videoconferência |

---

## 4. PADRÕES INTERNACIONAIS 🇺🇳

### 4.1 Conformidade & Regulamentação

| Padrão | Estado | O que falta |
|--------|:------:|------------|
| **GDPR (Europa)** | ❌ | Consentimento de cookies, exportação de dados, direito ao esquecimento, política de privacidade detalhada |
| **LGPD (Brasil)** | ❌ | Similar ao GDPR — base legal para tratamento de dados |
| **PCI DSS** | 🟡 | Pagamentos via gateways externos (M-Pesa, Stripe) reduzem escopo, mas auditoria necessária |
| **WCAG 2.1 (Acessibilidade)** | ❌ | Sem alt text consistente, sem navegação por teclado testada, sem contraste verificado |
| **KYC do Vendedor** | 🟡 | Upload de documentos existe mas sem verificação real (manual pelo admin) |

### 4.2 Internacionalização (i18n)

| Funcionalidade | Estado |
|---------------|:------:|
| Multi-idioma (PT, EN, FR) | ❌ |
| Multi-moeda (MZN, USD, EUR) | ❌ (só MZN) |
| Formatação regional (datas, números) | 🟡 Parcial (pt-MZ) |
| Tradução de conteúdo (lojas/produtos) | ❌ |

### 4.3 SEO & Discoverabilidade

| Funcionalidade | Estado |
|---------------|:------:|
| Meta tags dinâmicas | ✅ (Next.js generateMetadata) |
| Sitemap.xml automático | ❌ |
| robots.txt | ❌ |
| Schema.org (Product, Course, Store) | ❌ |
| Breadcrumbs JSON-LD | ❌ |
| Canonical URLs | ❌ |
| Open Graph / Twitter Cards | 🟡 Parcial |
| URLs amigáveis (slug) | ✅ |

### 4.4 Segurança & Performance

| Funcionalidade | Estado |
|---------------|:------:|
| Rate limiting | 🟡 Só nos stream tokens |
| CORS configurado | ✅ (Django CORS headers) |
| Content Security Policy | ❌ |
| CDN para media | 🟡 (local, sem CDN) |
| Backup automático | ❌ |
| Monitorização (Sentry) | ❌ |
| HTTPS forçado | 🟡 (nginx config existe) |
| Content-Encoding (gzip/brotli) | 🟡 |

### 4.5 Funcionalidades de Marketplace (Benchmark)

Comparação com marketplaces internacionais (Udemy, Hotmart, Gumroad, Etsy, Amazon):

| Funcionalidade | eShopping | Udemy | Hotmart | Gumroad |
|---------------|:---------:|:-----:|:-------:|:-------:|
| Cursos com vídeo | ✅ | ✅ | ✅ | ❌ |
| Download digital | 🟡 | ❌ | ✅ | ✅ |
| Certificado | ❌ | ✅ | ✅ | ❌ |
| Drip content | 🟡 | ❌ | ✅ | ✅ |
| Afiliados | 🟡 | ✅ | ✅ | ✅ |
| Cupões | 🟡 | ✅ | ✅ | ✅ |
| Carrinho multi-loja | ✅ | ❌ | ❌ | ❌ |
| Chat vendor-cliente | ✅ | ❌ | ❌ | ❌ |
| Wallet integrada | 🟡 | ❌ | ✅ | ❌ |
| M-Pesa/e-Mola | ✅ | ❌ | ❌ | ❌ |
| Quizzes | ✅ | ✅ | ❌ | ❌ |
| App mobile | ❌ | ✅ | ✅ | ❌ |
| Live streaming | ❌ | ❌ | ✅ | ❌ |
| Assinaturas | ❌ | ❌ | ✅ | ✅ |
| 2FA | ❌ | ✅ | ✅ | ✅ |
| i18n (PT) | ✅ | ❌ | ✅ | ❌ |

---

## 5. PLANO DE ACÇÃO PRIORIZADO

### 🚨 FASE 1 — Corrigir o que não funciona (Semanas 1-2)

| # | Tarefa | Esforço |
|---|--------|:------:|
| 1 | **Endpoint de download digital seguro** — View com token JWT assinado, limite de downloads, expiração | 3 dias |
| 2 | **Processar matrícula/download no callback M-Pesa** — Signal ou webhook handler que chama `_process_delivery()` | 1 dia |
| 3 | **Wallet payout real** — Integrar disbursement M-Pesa/e-Mola, estados, retenção | 4 dias |
| 4 | **Emails transacionais básicos** — Verificação email, confirmação encomenda, loja aprovada/rejeitada, reset senha | 3 dias |

### 🔴 FASE 2 — Funcionalidades core pendentes (Semanas 3-5)

| # | Tarefa | Esforço |
|---|--------|:------:|
| 5 | **Cálculo de frete** — Zonas, tabelas, endpoint de estimativa | 3 dias |
| 6 | **Cupões no checkout** — Aplicar/validar código no CreateOrderSerializer | 2 dias |
| 7 | **Certificados PDF** — Geração com WeasyPrint/ReportLab, ID único verificável | 3 dias |
| 8 | **Cookie de tracking de afiliado** — 30 dias, atribuição na ordem | 2 dias |
| 9 | **Sitemap.xml + robots.txt** — Geração dinâmica no Next.js | 1 dia |
| 10 | **Schema.org JSON-LD** — Product, Course, Store, Breadcrumbs | 2 dias |

### 🟡 FASE 3 — Diferenciação competitiva (Semanas 6-9)

| # | Tarefa | Esforço |
|---|--------|:------:|
| 11 | Login social (Google + Facebook) | 3 dias |
| 12 | 2FA para vendedores | 3 dias |
| 13 | Watermark dinâmico em PDFs/images | 2 dias |
| 14 | Preview de produto digital (amostra) | 2 dias |
| 15 | Q&A por produto | 3 dias |
| 16 | Flash sales | 4 dias |
| 17 | Múltiplos admins por loja | 5 dias |

### 🟢 FASE 4 — Padrões internacionais (Semanas 10+)

| # | Tarefa |
|---|--------|
| 18 | Multi-idioma (i18n com next-intl) |
| 19 | Multi-moeda (USD, EUR) |
| 20 | GDPR/LGPD compliance |
| 21 | WCAG 2.1 AA accessibility audit |
| 22 | CDN para media (Cloudflare R2) |
| 23 | Monitorização (Sentry + health checks) |
| 24 | Assinaturas recorrentes |
| 25 | App mobile (PWA avançada ou React Native) |

---

## 6. CONCLUSÃO

O **eShoppingCentre** tem uma base arquitetural **sólida e bem desenhada**: a separação por `product_type` na Store, o modelo de Product polimórfico, a hierarquia Course→Module→Lesson e a integração Cloudflare Stream estão bem implementados.

**No entanto, o sistema está a ~70% de prontidão para lojas digitais.** Os 4 gaps críticos (download digital, payout, auto-enrollment pós-pagamento, emails) são **bloqueadores** — impedem que um cliente complete o ciclo completo de compra → entrega.

Corrigidos esses 4 itens, o marketplace atinge **~85%** e fica funcional. As fases 2-4 levam aos **padrões internacionais** de marketplaces como Udemy/Hotmart.

---

*Relatório gerado por análise completa do código: 12 apps Django + 40+ páginas Next.js + 30+ componentes React.*
