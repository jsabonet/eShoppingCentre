# 🔒 Proteção da Loja de Cursos — Integração & Pontos de Risco

> Data: 10 de Agosto de 2026
> Objectivo: Garantir que as implementações de download digital NÃO quebram a loja de cursos existente

---

## 1. MAPA DA INTEGRAÇÃO — LOJA DE CURSOS

### 1.1 Fluxo Completo (Criação → Compra → Consumo)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DA LOJA DE CURSOS                          │
│                                                                     │
│  VENDEDOR                                                           │
│  ────────                                                           │
│  1. Regista loja com product_type="course"                          │
│     └─ StoreRegisterView.perform_create()                           │
│        └─ default_affiliate_commission = 20%                        │
│        └─ low_stock_threshold = 0                                   │
│                                                                     │
│  2. Cria produto (tipo "course")                                    │
│     └─ ProductListView.perform_create()                             │
│        └─ Cria Product + Course (via get_or_create)                 │
│        └─ instructor = request.user                                 │
│        └─ Frontend redireciona para /seller/courses/{id}/builder    │
│                                                                     │
│  3. Constrói conteúdo no Course Builder                             │
│     └─ Cria Module → Lesson → Upload video (Cloudflare Stream)      │
│     └─ Adiciona Quiz → Question → AnswerOption                      │
│     └─ Adiciona LessonAttachment (PDFs, slides)                     │
│                                                                     │
│  CLIENTE                                                             │
│  ───────                                                             │
│  4. Navega catálogo /courses / /courses/[slug]                      │
│     └─ Página pública com: descrição, módulos, aulas grátis          │
│                                                                     │
│  5. Compra o curso (checkout)                                       │
│     └─ CreateOrderSerializer.create()                               │
│        └─ Valida: não pode comprar curso já matriculado              │
│        └─ Se pagamento teste: chama _process_delivery()             │
│           └─ Cria Enrollment (matrícula)                             │
│                                                                     │
│  6. Pagamento confirmado (M-Pesa/e-Mola/Stripe)                     │
│     └─ Order é salvo com payment_status="completed"                 │
│     └─ Signal: enroll_in_courses (orders/signals.py)                │
│        └─ Cria Enrollment para cada Course no pedido                │
│                                                                     │
│  7. Acede ao curso /my-courses / /my-courses/[id]/learn              │
│     └─ CourseLearnView valida:                                       │
│        └─ Matrícula existe?                                         │
│        └─ Acesso não expirou? (has_access)                          │
│        └─ Drip content: módulo desbloqueado?                        │
│     └─ Player Cloudflare Stream via token JWT                       │
│        └─ LessonStreamTokenView gera token                          │
│        └─ IP binding opcional (anti-partilha)                       │
│                                                                     │
│  8. Tracking de progresso                                           │
│     └─ WatchProgressView: PATCH watched_duration                    │
│     └─ CompleteLessonView: PATCH completed=true                     │
│     └─ Enrollment.progress recalculado                              │
│                                                                     │
│  9. Certificado (quando completed=true)                              │
│     └─ certificate_enabled=True no modelo                           │
│     └─ ⚠️ PDF ainda NÃO é gerado automaticamente                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Modelos Envolvidos (Cadeia de Dependências)

```
Product (products.Product)
  ├── product_type = "course"
  ├── store → Store (com product_type="course")
  ├── images → ProductImage
  └── course → Course (OneToOne)
                 ├── instructor → User
                 ├── modules → CourseModule
                 │     ├── lessons → CourseLesson
                 │     │     ├── cloudflare_video_uid
                 │     │     ├── cloudflare_video_status
                 │     │     ├── attachments → LessonAttachment
                 │     │     └── quizzes → Quiz → Question → AnswerOption
                 │     └── quizzes → Quiz
                 ├── enrollments → Enrollment
                 │     ├── user → User
                 │     ├── lesson_progress → LessonProgress
                 │     └── quiz_attempts → QuizAttempt → QuizAnswer
                 └── reviews → CourseReview
```

---

## 2. PONTOS DE INTEGRAÇÃO CRÍTICOS (NÃO TOCAR)

### 2.1 Backend

| # | Ficheiro | O que faz | Risco se alterado |
|---|----------|-----------|-------------------|
| **1** | `orders/signals.py:enroll_in_courses` | Matricula aluno quando pagamento confirmado | 🔴 Se quebrar, cliente paga e não tem acesso |
| **2** | `orders/signals.py:deliver_digital_products` | Cria DigitalDownload quando pagamento confirmado | 🔴 Se quebrar, cliente paga produto digital e não descarrega |
| **3** | `orders/serializers.py:_process_delivery` | Mesma lógica para pagamentos imediatos (teste) | 🔴 Duplicata do signal — manter ambos sincronizados |
| **4** | `orders/serializers.py:validate_items` | Impede compra duplicada de curso já matriculado | 🟡 Se quebrar, cliente pode comprar 2x o mesmo curso |
| **5** | `products/views.py:perform_create` | Auto-cria Course quando product_type='course' | 🔴 Se quebrar, produto criado sem Course vinculado |
| **6** | `products/serializers.py:SellerProductSerializer.get_course` | Lazy creation de Course se não existir | 🟡 Fallback de segurança |
| **7** | `products/serializers.py:ProductDetailSerializer.get_course` | Lazy creation + dados do instrutor para frontend | 🟡 Fallback de segurança |
| **8** | `courses/views.py:CourseLearnView` | Estrutura do curso para aluno + drip + progresso | 🔴 Página principal de consumo |
| **9** | `courses/views.py:CourseBuilderView` | Estrutura para seller editar conteúdo | 🔴 Ferramenta principal do vendedor |
| **10** | `courses/views_cloudflare.py:LessonStreamTokenView` | Gera token JWT para player de vídeo | 🔴 Se quebrar, vídeos não carregam |
| **11** | `courses/services/cloudflare_stream.py` | API calls para Cloudflare Stream | 🔴 Dependência externa crítica |
| **12** | `stores/views.py:StoreRegisterView.perform_create` | Define defaults por product_type | 🟡 Só afecta novas lojas |

### 2.2 Frontend

| # | Ficheiro | O que faz | Risco |
|---|----------|-----------|------|
| **13** | `seller/courses/page.tsx` | Lista cursos do vendedor, filtro por product_type | 🟡 |
| **14** | `seller/courses/[id]/builder/page.tsx` | Course Builder — módulos, aulas, video upload, quizzes | 🔴 Ferramenta core |
| **15** | `seller/courses/[id]/edit/page.tsx` | Editar metadados do curso | 🟡 |
| **16** | `seller/products/new/page.tsx` | Formulário unificado — redireciona para builder se course | 🔴 Porta de entrada |
| **17** | `seller/products/page.tsx` | Redireciona lojas course para /seller/courses | 🟡 |
| **18** | `courses/page.tsx` | Catálogo público | 🟡 |
| **19** | `courses/[slug]/page.tsx` | Detalhe do curso + reviews | 🟡 |
| **20** | `my-courses/page.tsx` | Lista de cursos matriculados | 🟡 |
| **21** | `store/[slug]/page.tsx` | Página pública da loja (mostra produtos de qualquer tipo) | 🟡 |
| **22** | `CourseVideoPlayer.tsx` | Player Cloudflare Stream | 🔴 Core da experiência |

---

## 3. O QUE VAMOS ALTERAR (E O QUE NÃO TOCAR)

### 3.1 Ficheiros NOVOS (zero risco para cursos)

| Ficheiro | Propósito |
|----------|-----------|
| `backend/apps/products/views_downloads.py` | Endpoints de download digital |
| `backend/apps/products/serializers_downloads.py` | Serializers para listagem de downloads |
| `backend/apps/payments/signals.py` | Signal para trigger de delivery no pagamento |
| `backend/apps/payments/tasks.py` | Celery task de processamento assíncrono |
| `backend/apps/orders/services.py` | Serviço partilhado de delivery (extrair de CreateOrderSerializer) |
| `frontend/app/account/downloads/page.tsx` | Página de downloads do cliente |

### 3.2 Ficheiros MODIFICADOS (risco controlado)

| Ficheiro | Mudança | Risco | Mitigação |
|----------|---------|:-----:|-----------|
| `config/settings/production.py` | Adicionar STORAGES para R2 | 🟡 | O código EXISTENTE já suporta S3 — só estamos a ligar as env vars. Testar no ambiente dev primeiro. |
| `config/urls.py` | Adicionar `urls_downloads` | 🟢 | Apenas adicionar include(), sem alterar rotas existentes |
| `products/urls.py` | Adicionar rotas de download | 🟢 | Apenas adicionar, sem alterar |
| `orders/signals.py` | NÃO ALTERAR — já trata courses | 🟢 | O signal existente já está correcto |
| `orders/serializers.py` | Extrair `_process_delivery` para serviço | 🟡 | Refactor — mover, não alterar lógica. Manter ambos (signal + serviço) a usar a mesma função. |
| `payments/apps.py` | Registrar signals no `ready()` | 🟢 | Apenas adicionar import |

### 3.3 Ficheiros INTOCÁVEIS (não alterar de todo)

```
backend/apps/courses/          ← APP INTEIRA (views, models, serializers, services, urls)
backend/apps/orders/signals.py ← Signals de enrollment já perfeitos
backend/apps/products/signals.py ← Low stock alerts (physical only)
frontend/app/seller/courses/   ← Course builder e gestão
frontend/app/courses/          ← Catálogo público
frontend/app/my-courses/       ← Área do aluno
frontend/src/components/CourseVideoPlayer.tsx ← Player
frontend/src/components/VideoUploader.tsx     ← Upload
```

---

## 4. ESTRATÉGIA DE STORAGE — NÃO QUEBRAR CURSOS

### 4.1 Configuração Actual (ANTES das mudanças)

```
Desenvolvimento:
  MEDIA_ROOT = backend/media/
  MEDIA_URL  = /media/
  STORAGES['default'] = FileSystemStorage

Produção (com S3 configurado):
  STORAGES['default'] = S3Boto3Storage
  TUDO vai para S3 — imagens, logos, documentos, ficheiros digitais
```

### 4.2 Configuração Proposta (DEPOIS das mudanças)

```
Desenvolvimento (sem alterações):
  MEDIA_ROOT = backend/media/
  Tudo local — como sempre funcionou ✅

Produção (com R2):
  STORAGES['default'] = S3Boto3Storage
  TUDO vai para R2 — mesma estratégia, só muda o endpoint
  ✅ Compatível com o código existente
  ✅ Imagens de produtos continuam a funcionar
  ✅ Logos/banners de lojas continuam a funcionar
  ✅ Ficheiros digitais vão para R2 (protegidos)
  ✅ Anexos de cursos vão para R2
```

### 4.3 Verificação Pós-Migração para Cursos

Após configurar R2, verificar estes cenários:

- [ ] Criar loja tipo "course" → OK
- [ ] Criar produto tipo "course" → Course auto-criado → OK
- [ ] Upload de imagem de curso → aparece no R2 → OK
- [ ] Course Builder: criar módulo + aula → OK
- [ ] Upload de vídeo via Cloudflare Stream → OK
- [ ] Upload de attachment na aula → ficheiro no R2 → OK
- [ ] Comprar curso (teste) → Enrollment criado → OK
- [ ] Aceder `/my-courses` → curso listado → OK
- [ ] Aceder aula → player carrega vídeo → OK
- [ ] Progresso tracking → OK

---

## 5. CREDENCIAIS CONFIGURADAS

### 5.1 `.env` do Backend (Actualizado)

| Variável | Valor | Serviço |
|----------|-------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | `9a7d53ef...` | Stream + R2 |
| `CLOUDFLARE_API_TOKEN` | `cfat_gw6y...` | Stream |
| `CLOUDFLARE_STREAM_DOMAIN` | `customer-fr78...cloudflarestream.com` | Stream |
| `CLOUDFLARE_JWT_SECRET` | `c37ab3d4...` | Stream Token |
| `AWS_ACCESS_KEY_ID` | `cf71c167...` | R2 |
| `AWS_SECRET_ACCESS_KEY` | `3d1698b5...` | R2 |
| `AWS_STORAGE_BUCKET_NAME` | `eshoppingcentre-media` | R2 |
| `AWS_S3_REGION_NAME` | `auto` | R2 |
| `AWS_S3_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` | R2 |

### 5.2 Ainda Falta Criar

- [ ] **Bucket R2:** `eshoppingcentre-media` — ainda não foi criado no dashboard
- [ ] **Stream API Token separado:** Token atual pode servir para ambos, mas ideal criar um token só para Stream com permissão `Stream:Edit`

---

## 6. CHECKLIST DE SEGURANÇA — ANTES DE QUALQUER DEPLOY

```
☐ 1. Fazer backup da base de dados
☐ 2. Testar em ambiente local com DEBUG=True e R2 (usar endpoint local ou bucket separado)
☐ 3. Verificar que imagens de cursos carregam após migração
☐ 4. Verificar que upload de nova imagem funciona
☐ 5. Verificar que vídeos Cloudflare Stream continuam a tocar
☐ 6. Verificar que matrícula automática funciona (signal)
☐ 7. Rodar testes automatizados (se existirem)
☐ 8. Fazer deploy em staging antes de produção
☐ 9. Monitorizar logs após deploy
```

---

## 7. REGRAS DE OURO

1. **NUNCA alterar `orders/signals.py`** — os signals `enroll_in_courses` e `deliver_digital_products` são sagrados
2. **NUNCA alterar lógica de `product_type`** em `ProductListView.perform_create()` — a auto-criação de Course depende disso
3. **NUNCA alterar `CourseLearnView`** sem testar com todos os cenários (matriculado, não matriculado, expirado, drip)
4. **SEMPRE testar o fluxo completo** após qualquer mudança em models/serializers de products ou orders
5. **Mudanças em STORAGES** devem ser testadas com upload de imagem de curso + upload de attachment
6. **Refactors:** extrair lógica para serviços partilhados, NUNCA duplicar

---

*Documento gerado após análise completa de 12 apps Django + 40+ páginas Next.js + 30+ componentes.*
