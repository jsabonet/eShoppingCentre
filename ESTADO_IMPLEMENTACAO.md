# 📊 eShoppingCentre — Estado de Implementação

> Análise completa do que está implementado vs. o que falta implementar.
> Data: 30 de Julho de 2026

---

## 📈 Resumo Geral

| Área | Implementado | Em Falta |
|------|:-----------:|:--------:|
| **Backend (Models)** | ~90% dos modelos | Sinais, serviços, celery tasks |
| **Backend (APIs)** | ~60% | Endpoints de analytics, relatórios, cupões |
| **Frontend (Páginas)** | 14/46 páginas | 32 páginas por criar |
| **Frontend (Componentes)** | ~25 componentes | ~30+ componentes por criar |

---

## ✅ O Que Já Está Implementado

### Backend — Modelos de Dados

| App | Modelos | Estado |
|-----|---------|:------:|
| `users/` | User, UserProfile (JWT auth) | ✅ |
| `stores/` | Store com status, logo, banner, tema, políticas, selo verificado | ✅ |
| `products/` | Category (hierárquica), Product (físico/digital/curso), ProductImage, ProductVariant, DigitalProduct | ✅ |
| `orders/` | Order, OrderItem com estados completos, tracking code, afiliado | ✅ |
| `payments/` | PaymentTransaction (M-Pesa, e-Mola, Stripe/PayPal) | ✅ |
| `wallet/` | Wallet, WalletTransaction (saldo, vendas, comissões, saques) | ✅ |
| `affiliates/` | AffiliateProfile, AffiliateLink, AffiliateCommission | ✅ |
| `courses/` | Course, CourseModule, CourseLesson, Enrollment, LessonProgress, Certificate | ✅ |
| `reviews/` | Review com rating, verified purchase | ✅ |
| `notifications/` | Notification (in-app) | ✅ |
| `blog/` | Post, Category | ✅ |
| `core/` | BaseModel, paginação | ✅ |

### Frontend — Páginas Existentes (14 ✅ Completas)

| Página | Rota | Estado |
|--------|------|:------:|
| Home | `/` | ✅ Completa |
| Sobre | `/about` | ✅ |
| Admin Dashboard | `/admin` | ✅ |
| Login Admin | `/admin/login` | ✅ |
| Carrinho | `/cart` | ✅ |
| Checkout | `/checkout` | ✅ |
| Contacto | `/contact` | ✅ |
| FAQ | `/faq` | ✅ |
| Login | `/login` | ✅ |
| Materiais | `/materials-care` | ✅ |
| Privacidade | `/privacy` | ✅ |
| Detalhe Produto | `/product/[slug]` | ✅ |
| Registo | `/signup` | ✅ |
| Termos | `/terms` | ✅ |

### Frontend — Páginas com Implementação Parcial (11 🟡)

| Página | Rota | Estado |
|--------|------|:------:|
| Categoria | `/category/[slug]` | 🟡 Conecta API mas faltam filtros |
| Pesquisa | `/search` | 🟡 Funcional, sem filtros avançados |
| Loja (pública) | `/store/[slug]` | 🟡 Conecta API |
| Lista de Lojas | `/stores` | 🟡 Conecta API |
| Blog (lista) | `/blog` | 🟡 Dados mock/hardcoded |
| Cursos (catálogo) | `/courses` | 🟡 Dados mock/hardcoded |
| Blog Post | `/blog/[slug]` | 🟡 Dados mock/hardcoded |
| Curso Detalhe | `/courses/[slug]` | 🟡 Dados mock/hardcoded |
| Meus Cursos | `/my-courses` | 🟡 Dados mock/hardcoded |
| Aula | `/my-courses/[id]/learn` | 🟡 Dados mock/hardcoded |
| 404 | `/not-found` | 🟡 Básica |

### Frontend — Área de Seller (7 🟡 Estrutura presente)

| Página | Rota | Estado |
|--------|------|:------:|
| Dashboard | `/seller/dashboard` | 🟡 Estrutura presente |
| Registo | `/seller/register` | ✅ Completa (3 passos) |
| Produtos | `/seller/products` | 🟡 Estrutura presente |
| Novo Produto | `/seller/products/new` | 🟡 Estrutura presente |
| Editar Produto | `/seller/products/[id]/edit` | 🟡 Estrutura presente |
| Encomendas | `/seller/orders` | 🟡 Estrutura presente |
| Afiliados | `/seller/affiliates` | 🟡 Estrutura presente |
| Ganhos | `/seller/earnings` | 🟡 Estrutura presente |
| Definições | `/seller/settings` | 🟡 Estrutura presente |
| Certificados | `/seller/certificates` | 🟡 Estrutura presente |
| Alunos | `/seller/students` | 🟡 Estrutura presente |

### Frontend — Área de Conta (7 🟡 Estrutura presente)

| Página | Rota | Estado |
|--------|------|:------:|
| Minha Conta | `/account` | 🟡 Estrutura presente |
| Perfil | `/account/profile` | 🟡 |
| Encomendas | `/account/orders` | 🟡 |
| Detalhe Encomenda | `/account/orders/[id]` | 🟡 |
| Endereços | `/account/addresses` | 🟡 |
| Downloads | `/account/downloads` | 🟡 |
| Wishlist | `/account/wishlist` | 🟡 |

### Frontend — Área de Afiliado (5 🟡 Estrutura presente)

| Página | Rota | Estado |
|--------|------|:------:|
| Registo | `/affiliate/register` | 🟡 |
| Dashboard | `/affiliate/dashboard` | 🟡 |
| Produtos | `/affiliate/products` | 🟡 |
| Links | `/affiliate/links` | 🟡 |
| Ganhos | `/affiliate/earnings` | 🟡 |

### Infraestrutura

| Item | Estado |
|------|:------:|
| Docker (Dockerfile + docker-compose) | ✅ |
| PWA (service worker, manifest) | ✅ |
| Django Channels (WebSocket configurado) | ✅ |
| Celery configurado | ✅ |
| Firebase Admin SDK | ✅ |
| Responsivo | ✅ |
| CI/CD | 🟡 |
| CDN para media | 🟡 |
| Backup automático | 🟡 |
| Monitorização (Sentry) | 🟡 |

---

## 🔴 O Que Falta Implementar

### 🔴 Alta Prioridade (8 Funcionalidades Core)

| # | Funcionalidade | Backend | Frontend |
|---|---------------|:------:|:--------:|
| 1 | **Variantes de produto** — tamanho/cor, SKU por variante, stock individual, imagens por variante | ❌ | ❌ |
| 2 | **Cupões e descontos** — códigos, % ou valor fixo, validade, limites, valor mínimo | ❌ | ❌ |
| 3 | **Chat vendor-cliente** — WebSocket em tempo real, por produto/encomenda, envio de imagens | ❌ | ❌ |
| 4 | **Devoluções/reembolsos** — RMA, fluxo de aprovação, estados, disputas | ❌ | ❌ |
| 5 | **Cálculo de frete** — zonas de entrega, tabela por peso/valor, frete grátis mínimo | ❌ | ❌ |
| 6 | **Levantamento de saldo** — vendor solicita transferência para M-Pesa/e-Mola/conta | ❌ | ❌ |
| 7 | **Emails transacionais** — verificação email, encomenda, pagamento, loja aprovada/rejeitada | ❌ | ❌ |
| 8 | **Relatórios/Gráficos** — vendas diárias/semanais/mensais, analytics no dashboard | ❌ | ❌ |

### 🟡 Média Prioridade (14 Funcionalidades)

| # | Funcionalidade |
|---|---------------|
| 9 | **Níveis de vendedor** — Bronze, Prata, Ouro, Diamante baseado em vendas/avaliações |
| 10 | **Múltiplos admins por loja** — convite por email, perfis de permissão, log de acções |
| 11 | **Flash sales** — produto com preço promocional, countdown, stock limitado, agendamento |
| 12 | **SEO** — sitemap.xml automático, robots.txt, schema.org markup, canonical URLs |
| 13 | **Certificados de conclusão** — PDF gerado automaticamente ao concluir curso |
| 14 | **Links rastreáveis de afiliado** — cookie de atribuição (X dias), dashboard de performance |
| 15 | **Download seguro** — link único, expira após X downloads ou dias, protecção |
| 16 | **Login social** — Google, Facebook |
| 17 | **2FA** — autenticação de dois factores |
| 18 | **Tracking de encomendas** — integração com transportadoras moçambicanas |
| 19 | **Q&A por produto** — clientes perguntam, vendor responde publicamente |
| 20 | **Materiais de marketing** — banners, links prontos para afiliados partilharem |
| 21 | **Facturação automática** — PDF/recibo gerado por cada venda |
| 22 | **Push notifications** — browser push para eventos importantes |

### 🟢 Baixa Prioridade / Futuro (9 Funcionalidades)

| # | Funcionalidade |
|---|---------------|
| 23 | Temas de layout personalizáveis por loja (grid vs lista, colunas, hero section) |
| 24 | Pré-venda / Backorder — vender sem stock com data prevista |
| 25 | Assinaturas recorrentes — pagamento mensal/anual com renovação automática |
| 26 | Drip content para cursos — libertar conteúdo gradualmente |
| 27 | Watermark dinâmico em produtos digitais |
| 28 | Pickup points — pontos de recolha físicos |
| 29 | App nativa mobile (React Native) |
| 30 | Live streaming para vendedores |

---

## 🎯 Plano de Acção Recomendado

### Fase 1 — Core do Marketplace (Semanas 1-3)

1. **Cálculo de frete + zonas de entrega** — essencial para checkout funcionar com produtos físicos
2. **Emails transacionais** — onboarding completo (verificação email, notificações vendor)
3. **Variantes de produto** — core do e-commerce físico (tamanho, cor, SKU, stock individual)

### Fase 2 — Conversão & Finanças (Semanas 4-6)

4. **Cupões** — motor de marketing e conversão
5. **Levantamento de saldo** — fechar o ciclo financeiro do vendor
6. **Relatórios/Gráficos** — dashboards com dados reais para vendors e admin

### Fase 3 — After-Sales & Comunicação (Semanas 7-9)

7. **Devoluções** — after-sales obrigatório para marketplace
8. **Chat vendor-cliente** — comunicação em tempo real na plataforma

### Fase 4 — Diferenciação & Escala (Semanas 10+)

- Níveis de vendedor
- Flash sales
- SEO completo
- Login social + 2FA
- Certificados de cursos
- Download seguro para digitais

---

## 📁 Estrutura de Ficheiros por Módulo

### Backend (`backend/apps/`)

```
users/       — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
stores/      — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅, permissions.py ✅
products/    — models.py ✅, models_digital.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
orders/      — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅, signals.py ✅
payments/    — models.py ✅, views.py ✅, urls.py ✅, services/ ✅
wallet/      — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
affiliates/  — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
courses/     — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
reviews/     — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
blog/        — models.py ✅, serializers.py ✅, views.py ✅, urls.py ✅
notifications/ — models.py ✅, routing.py ✅
```

### Frontend (`frontend/app/`)

```
✅ /                    — Home completa
✅ /about               — Sobre
✅ /admin               — Admin Dashboard
✅ /admin/login         — Login Admin
🟡 /account/*           — 7 páginas (estrutura presente)
🟡 /affiliate/*         — 5 páginas (estrutura presente)
🟡 /blog                — Lista (dados mock)
🟡 /blog/[slug]         — Post (dados mock)
✅ /cart                — Carrinho
🟡 /category/[slug]     — Categoria (falta filtros)
✅ /checkout            — Checkout
✅ /contact             — Contacto
🟡 /courses             — Catálogo (dados mock)
🟡 /courses/[slug]      — Detalhe (dados mock)
✅ /faq                 — FAQ
✅ /login               — Login
✅ /materials-care       — Materiais
🟡 /my-courses           — Meus Cursos (dados mock)
🟡 /my-courses/[id]/learn — Aula (dados mock)
🟡 /not-found            — 404 básica
✅ /privacy              — Privacidade
✅ /product/[slug]       — Detalhe Produto
🟡 /search               — Pesquisa (sem filtros avançados)
🟡 /seller/*             — 11 páginas (estrutura presente)
✅ /signup               — Registo
🟡 /store/[slug]         — Loja pública
🟡 /stores               — Lista de Lojas
✅ /terms                — Termos
```

---

*Última actualização: 30 de Julho de 2026*
