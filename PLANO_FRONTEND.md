# 🖥️ Plano de Frontend — eShoppingCentre

## Mapeamento Completo de Páginas

---

## 1. ESTADO ACTUAL (14 páginas existentes ✅)

| Rota | Página | Componente | Status |
|------|--------|-----------|--------|
| `/` | Home | `BannerSlider` + `HomepageShop` | ✅ |
| `/about` | Sobre | Estática | ✅ |
| `/admin` | Admin Dashboard | `AdminDashboard` | ✅ |
| `/admin/login` | Login Admin | `AdminLogin` | ✅ |
| `/cart` | Carrinho | `CartContent` | ✅ |
| `/checkout` | Checkout | `CheckoutContent` | ✅ |
| `/contact` | Contacto | Estática | ✅ |
| `/faq` | FAQ | Estática | ✅ |
| `/login` | Entrar | `SignInForm` | ✅ |
| `/materials-care` | Materiais | Estática | ✅ |
| `/privacy` | Privacidade | Estática | ✅ |
| `/product/[slug]` | Detalhe Produto | `ProductDetailShop` | ✅ |
| `/signup` | Criar Conta | `RegisterForm` | ✅ |
| `/terms` | Termos | Estática | ✅ |

---

## 2. PÁGINAS EM FALTA (26 páginas)

### 🟥 FASE 1 — Core Marketplace (Alta Prioridade)

Estas páginas são **fundamentais** para o funcionamento básico do marketplace e algumas já estão referenciadas no Header/componentes.

| # | Rota | Página | Descrição | Componentes Necessários |
|---|------|--------|-----------|------------------------|
| **1** | `/category/[slug]` | **Categoria** | Lista produtos por categoria com filtros | `CategoryShop` (já existe) + novos: `CategoryFilters`, `CategoryHeader`, `ProductSort` |
| **2** | `/search` | **Pesquisa** | Resultados de pesquisa com query string `?q=` | `SearchShop` (já existe) + novos: `SearchFilters`, `SearchHeader`, `Pagination` |
| **3** | `/blog` | **Blog** | Lista de artigos do blog | `BlogCard`, `BlogList` |
| **4** | `/blog/[slug]` | **Post do Blog** | Artigo completo do blog | `BlogPost`, `BlogSidebar`, `BlogComments` |
| **5** | `/not-found` | **404 Personalizada** | Página de erro 404 personalizada | Estática com design |

### 🟧 FASE 2 — Multi-Vendor (Lojas)

Estas páginas activam o **sistema de multi-vendedor** — cada vendedor com a sua loja.

| # | Rota | Página | Descrição | Componentes Necessários |
|---|------|--------|-----------|------------------------|
| **6** | `/stores` | **Lista de Lojas** | Grade/lista de todas as lojas do marketplace | `StoreCard`, `StoreGrid`, `StoreSearch` |
| **7** | `/store/[slug]` | **Loja do Vendedor** | Página pública da loja com produtos | `StoreHeader`, `StoreProducts`, `StoreInfo`, `StoreReviews` |
| **8** | `/seller/register` | **Registo Vendedor** | Formulário para abrir uma loja | `SellerRegisterForm`, `SellerRegisterSteps` |
| **9** | `/seller/dashboard` | **Dashboard Vendedor** | Visão geral de vendas, ganhos, produtos | `SellerStats`, `SellerRecentOrders`, `SellerChart` |
| **10** | `/seller/products` | **Meus Produtos** | CRUD de produtos do vendedor | `SellerProductTable`, `SellerProductFilters` |
| **11** | `/seller/products/new` | **Novo Produto** | Formulário de criação de produto (físico/digital/curso) | `ProductForm`, `ProductFormDigital`, `ProductFormPhysical` |
| **12** | `/seller/products/[id]/edit` | **Editar Produto** | Edição de produto existente | Reutiliza `ProductForm` |
| **13** | `/seller/orders` | **Encomendas** | Gestão de encomendas recebidas | `SellerOrderTable`, `SellerOrderDetail` |
| **14** | `/seller/affiliates` | **Afiliados da Loja** | Ver e gerir afiliados dos seus produtos | `SellerAffiliateTable`, `AffiliateCommissions` |
| **15** | `/seller/earnings` | **Ganhos** | Extrato financeiro, saques | `EarningsChart`, `WithdrawForm`, `TransactionHistory` |
| **16** | `/seller/settings` | **Config. Loja** | Editar perfil da loja (logo, banner, políticas) | `StoreSettings`, `StoreShippingConfig` |

### 🟨 FASE 3 — Conta do Utilizador

| # | Rota | Página | Descrição | Componentes Necessários |
|---|------|--------|-----------|------------------------|
| **17** | `/account` | **Minha Conta** | Dashboard do utilizador | `AccountSidebar`, `AccountOverview` |
| **18** | `/account/profile` | **Perfil** | Editar dados pessoais | `ProfileForm` |
| **19** | `/account/orders` | **Encomendas** | Histórico de encomendas | `OrderHistory`, `OrderCard` |
| **20** | `/account/orders/[id]` | **Detalhe Encomenda** | Acompanhamento de encomenda | `OrderDetail`, `OrderTimeline` |
| **21** | `/account/addresses` | **Endereços** | Gestão de endereços de entrega | `AddressForm`, `AddressList` |
| **22** | `/account/downloads` | **Downloads** | Produtos digitais adquiridos | `DownloadList`, `DownloadCard` |
| **23** | `/account/wishlist` | **Lista de Desejos** | Produtos favoritos | `WishlistGrid` (reutiliza `ProductCard`) |

### 🟩 FASE 4 — Sistema de Afiliados

| # | Rota | Página | Descrição | Componentes Necessários |
|---|------|--------|-----------|------------------------|
| **24** | `/affiliate/register` | **Registo Afiliado** | Activar conta de afiliado | `AffiliateRegisterForm` |
| **25** | `/affiliate/dashboard` | **Dashboard Afiliado** | Visão de cliques, vendas, comissões | `AffiliateStats`, `AffiliateChart` |
| **26** | `/affiliate/products` | **Produtos para Promover** | Catálogo de produtos disponíveis para afiliação | `AffiliateProductCard`, `AffiliateProductFilters` |
| **27** | `/affiliate/links` | **Meus Links** | Gerir e gerar links de afiliado | `LinkGenerator`, `LinkTable`, `LinkShare` |
| **28** | `/affiliate/earnings` | **Comissões** | Histórico de comissões e solicitar saque | `CommissionHistory`, `WithdrawForm` |

### 🟦 FASE 5 — E-Learning (Cursos Online)

| # | Rota | Página | Descrição | Componentes Necessários |
|---|------|--------|-----------|------------------------|
| **29** | `/courses` | **Catálogo de Cursos** | Todos os cursos disponíveis | `CourseCard`, `CourseFilters`, `CourseGrid` |
| **30** | `/courses/[slug]` | **Página do Curso** | Detalhes, currículo, comprar | `CourseHero`, `CourseCurriculum`, `CourseInstructor`, `CourseReviews` |
| **31** | `/my-courses` | **Meus Cursos** | Cursos que comprei | `MyCourseGrid`, `MyCourseCard` |
| **32** | `/my-courses/[id]/learn` | **Assistir Aula** | Player de vídeo + conteúdo | `VideoPlayer`, `LessonContent`, `CourseSidebar`, `LessonProgress` |

---

## 3. NOVOS COMPONENTES A CRIAR

### 3.1 Componentes Compartilhados (Cross-cutting)

| Componente | Descrição | Fase |
|-----------|-----------|------|
| `Pagination` | Paginação reutilizável | 1 |
| `PageBreadcrumb` | Breadcrumb dinâmico por página | 1 |
| `EmptyState` | Estado vazio (sem resultados) | 1 |
| `LoadingSkeleton` | Skeleton loading para carregamento | 1 |
| `FileUploader` | Upload de imagens/ficheiros (para vendedores) | 2 |
| `RichTextEditor` | Editor de texto rico (descrições, blog) | 2 |
| `AddressAutocomplete` | Formulário de endereço com províncias | 3 |
| `ShareButton` | Botão de partilha (WhatsApp, Facebook, link) | 4 |
| `CopyToClipboard` | Copiar link de afiliado | 4 |
| `VideoPlayer` | Player de vídeo para cursos | 5 |
| `ProgressBar` | Barra de progresso do curso | 5 |

### 3.2 Layouts Compartilhados

| Layout | Rotas | Descrição |
|--------|-------|-----------|
| `AccountLayout` | `/account/*` | Sidebar de navegação da conta + conteúdo |
| `SellerLayout` | `/seller/*` | Sidebar de navegação do vendedor + dashboard |
| `AffiliateLayout` | `/affiliate/*` | Sidebar de navegação do afiliado + dashboard |
| `AdminLayout` | `/admin/*` | Layout do painel admin (já parcialmente implementado) |

---

## 4. ÁRVORE DE ROTAS COMPLETA (Futuro)

```
/                               # Home
├── /category/[slug]            # Produtos por categoria
├── /product/[slug]             # Detalhe do produto
├── /search                     # Resultados de pesquisa
│
├── /cart                       # Carrinho de compras
├── /checkout                   # Finalizar compra
│
├── /login                      # Entrar
├── /signup                     # Criar conta
├── /account                    # Minha Conta (dashboard)
│   ├── /account/profile        # Editar perfil
│   ├── /account/orders         # Minhas encomendas
│   │   └── /account/orders/[id] # Detalhe da encomenda
│   ├── /account/addresses      # Endereços
│   ├── /account/downloads      # Downloads digitais
│   └── /account/wishlist       # Lista de desejos
│
├── /stores                     # Todas as lojas
├── /store/[slug]               # Loja do vendedor
│
├── /seller                     # Painel do Vendedor (redirect)
│   ├── /seller/dashboard       # Dashboard
│   ├── /seller/register        # Abrir loja
│   ├── /seller/products        # Gerir produtos
│   │   ├── /seller/products/new       # Novo produto
│   │   └── /seller/products/[id]/edit # Editar produto
│   ├── /seller/orders          # Encomendas
│   ├── /seller/affiliates      # Afiliados
│   ├── /seller/earnings        # Ganhos
│   └── /seller/settings        # Configurações
│
├── /affiliate                  # Painel do Afiliado (redirect)
│   ├── /affiliate/register     # Registar como afiliado
│   ├── /affiliate/dashboard    # Dashboard
│   ├── /affiliate/products     # Produtos para promover
│   ├── /affiliate/links        # Gerar links
│   └── /affiliate/earnings     # Comissões
│
├── /courses                    # Catálogo de cursos
├── /courses/[slug]             # Página do curso
├── /my-courses                 # Meus cursos
│   └── /my-courses/[id]/learn  # Assistir aula
│
├── /blog                       # Blog
├── /blog/[slug]                # Artigo do blog
│
├── /admin                      # Admin (já existe)
│   ├── /admin/login            # (já existe)
│   ├── /admin/users            # Gestão de utilizadores
│   ├── /admin/stores           # Gestão de lojas
│   ├── /admin/products         # Gestão de produtos global
│   ├── /admin/affiliates       # Gestão de afiliados
│   └── /admin/settings         # Configurações da plataforma
│
├── /about                      # Sobre (já existe)
├── /contact                    # Contacto (já existe)
├── /faq                        # FAQ (já existe)
├── /privacy                    # Privacidade (já existe)
├── /terms                      # Termos (já existe)
├── /materials-care             # Materiais (já existe)
└── /not-found                  # 404
```

---

## 5. PRIORIDADE DE IMPLEMENTAÇÃO

```
FASE 1 ████████████████████████░  Alta  — Core Marketplace
FASE 2 ████████████████░░░░░░░░░  Alta  — Multi-Vendor
FASE 3 ██████████░░░░░░░░░░░░░░  Média — Conta Utilizador
FASE 4 ████████░░░░░░░░░░░░░░░░  Média — Afiliados
FASE 5 ████░░░░░░░░░░░░░░░░░░░░  Baixa — E-Learning
FASE 6 ██░░░░░░░░░░░░░░░░░░░░░░  Baixa — Complementares
```

### Ordem Recomendada

1. **FASE 1** — `/category/[slug]` + `/search` → Essenciais, já referenciados no código
2. **FASE 1** — `/blog` + `/blog/[slug]` → Referenciado no Header
3. **FASE 3** — `/account/*` → Necessário para qualquer gestão de perfil
4. **FASE 2** — `/seller/*` → Activa o multi-vendor
5. **FASE 4** — `/affiliate/*` → Activa o sistema de afiliados
6. **FASE 2** — `/stores` + `/store/[slug]` → Vitrines públicas das lojas
7. **FASE 5** — `/courses/*` + `/my-courses/*` → Módulo de e-learning
8. **FASE 6** — Complementos e refinamentos

---

## 6. ESFORÇO ESTIMADO

| Fase | Páginas | Componentes Novos | Esforço |
|------|---------|-------------------|---------|
| 1 — Core | 4 | ~8 | ⏱ 2-3 dias |
| 2 — Multi-Vendor | 11 | ~20 | ⏱ 5-7 dias |
| 3 — Conta | 7 | ~10 | ⏱ 3-4 dias |
| 4 — Afiliados | 5 | ~10 | ⏱ 2-3 dias |
| 5 — E-Learning | 4 | ~10 | ⏱ 3-4 dias |
| **Total** | **26 páginas** | **~58 componentes** | **~15-21 dias** |

---

## 7. COMO IMPLEMENTAR (Próximos Passos)

Se quiser começar, sugiro a seguinte sequência:

```
Passo 1: Página /category/[slug] — listar produtos por categoria
Passo 2: Página /search — resultados de pesquisa
Passo 3: Layout de Conta (/account/*) com sidebar
Passo 4: Páginas da Conta (perfil, encomendas, endereços)
Passo 5: Módulo Multi-Vendor (/seller/*)
Passo 6: Módulo de Afiliados (/affiliate/*)
Passo 7: Blog
Passo 8: Vitrines públicas (/stores, /store/[slug])
Passo 9: E-Learning (/courses/*)
```

> 📌 **Nota:** Este plano assume que o frontend continuará com dados mock até o backend Django estar pronto. Cada página pode ser construída e testada independentemente.
