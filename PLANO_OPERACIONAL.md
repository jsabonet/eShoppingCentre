# 🏪 eShoppingCentre — Plano Operacional e Funcional

## Marketplace Híbrido Multi-Vendedor com Sistema de Afiliados

---

## 1. VISÃO GERAL DA PLATAFORMA

O **eShoppingCentre** é um **marketplace híbrido** que permite:

- **Venda de produtos físicos** (eletrônicos, moda, casa, etc.)
- **Venda de produtos digitais** (ebooks, cursos online, software, templates, musica, etc.)
- **Multi-vendor** (qualquer utilizador pode abrir sua própria loja dentro da plataforma)
- **Sistema de afiliados** (utilizadores podem promover produtos de terceiros e ganhar comissão)
- **Marketplaces internos** (cada vendedor tem a sua loja com identidade própria)

---

## 2. ARQUITETURA DE USUÁRIOS (4 Perfis)

```
┌─────────────────────────────────────────────────────────┐
│                   eShoppingCentre                        │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│   │ Comprador│  │ Vendedor │  │ Afiliado │  │  Admin │ │
│   │ (Cliente)│  │ (Lojista)│  │ (Parceiro)│  │ (Gestor)│
│   └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                                                          │
│   Obs: Um usuário pode ter MÚLTIPLOS papéis              │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Comprador / Cliente
- Navega, pesquisa e compra produtos (físicos e digitais)
- Deixa avaliações e classificações
- Tem acesso a downloads dos produtos digitais adquiridos
- Histórico de encomendas

### 2.2 Vendedor / Lojista
- Cria e gere a sua própria loja dentro da plataforma
- Define produtos, preços, stock, categorias
- Define **taxas de comissão para afiliados** por produto
- Recebe notificações de vendas
- Acede a relatórios de vendas e desempenho
- Configura métodos de pagamento e envio

### 2.3 Afiliado / Parceiro
- Promove produtos de outros vendedores
- Gera links de afiliado únicos (com código de rastreio)
- Ganha **comissão por venda** (definida pelo vendedor)
- Acede a dashboard de desempenho de afiliado
- Solicita saque das comissões acumuladas

### 2.4 Administrador da Plataforma
- Gere utilizadores, lojas, produtos
- Define taxas e comissões da plataforma
- Modera conteúdo, resolve disputas
- Acede a relatórios globais (financeiros, operacionais)
- Configura métodos de pagamento globais

---

## 3. MODELO DE NEGÓCIO

### Fluxo Financeiro

```
┌──────────┐     Venda       ┌──────────────┐
│          │ ──────────────> │              │
│ Cliente  │    Pagamento    │  Plataforma  │
│          │ ──────────────> │              │
└──────────┘                 └──────┬───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌──────────┐   ┌──────────┐   ┌──────────────┐
             │ Vendedor │   │  Admin   │   │  Afiliado    │
             │ (80-90%) │   │ (5-10%)  │   │ (5-15% com.) │
             └──────────┘   └──────────┘   └──────────────┘
```

### Entidades e Percentagens

| Entidade | Função | Percentual |
|----------|--------|------------|
| **Vendedor** | Dono do produto | 75% - 85% |
| **Plataforma (Admin)** | Operação da plataforma | 5% - 10% |
| **Afiliado** | Quem promoveu a venda | 5% - 15% |

> **Nota:** As percentagens são flexíveis e configuráveis pelo Admin.
> O vendedor define a comissão do afiliado por produto (ex: 10%).
> A taxa da plataforma é global e deduzida do valor restante.

### Fluxo de Pagamento (Exemplo)

**Produto:** Curso Online — 1.000 MZN  
**Comissão de Afiliado definida pelo vendedor:** 10%

```
1. Cliente compra via link de afiliado → 1.000 MZN
2. Taxa da Plataforma (8%) → 80 MZN
3. Comissão do Afiliado (10%) → 100 MZN
4. Vendedor recebe → 820 MZN
```

---

## 4. MÓDULOS FUNCIONAIS

### 4.1 Módulo de Autenticação e Perfis

```
┌──────────────────────────────────────────────────┐
│                 AUTENTICAÇÃO                      │
├──────────────────────────────────────────────────┤
│ • Registo com email/telemóvel                     │
│ • Login social (Google, Facebook)                 │
│ • Verificação de identidade (para vendedores)     │
│ • Perfil único com múltiplos papéis               │
│ • Gestão de password/2FA                          │
│ • Painel de configuração do perfil                │
│   - Informações pessoais                          │
│   - Endereços de entrega                          │
│   - Métodos de pagamento                          │
│   - Preferências de notificação                   │
└──────────────────────────────────────────────────┘
```

### 4.2 Módulo de Catálogo e Produtos

```
┌──────────────────────────────────────────────────┐
│               CATÁLOGO DE PRODUTOS                │
├──────────────────────────────────────────────────┤
│ • Produtos Físicos                                │
│   - Gestão de stock em tempo real                 │
│   - Múltiplas variações (tamanho, cor, etc.)     │
│   - Cálculo de frete integrado                   │
│   - Galeria de imagens                           │
│                                                   │
│ • Produtos Digitais                               │
│   - Upload de ficheiros (PDF, vídeo, ZIP, etc.)  │
│   - Streaming de vídeo (cursos)                   │
│   - Área de membros (cursos online)              │
│   - DRM básico / watermarking                    │
│   - Download links com expiração                 │
│                                                   │
│ • Produtos Mistos (ex: físico + acesso digital)  │
└──────────────────────────────────────────────────┘
```

### 4.3 Módulo de Multi-Vendor (Lojas)

```
┌──────────────────────────────────────────────────┐
│            SISTEMA DE LOJAS (VENDORS)             │
├──────────────────────────────────────────────────┤
│ • Cada vendedor tem uma loja virtual própria      │
│ • URL personalizada: /loja/{slug}                 │
│   Ex: /loja/tecnomoz, /loja/livrariaabc          │
│                                                   │
│ • Configurações da Loja:                          │
│   - Nome, descrição, logótipo, banner             │
│   - Redes sociais, políticas de envio/troca       │
│   - Métodos de pagamento aceites                 │
│   - Taxas de comissão padrão para afiliados       │
│                                                   │
│ • Dashboard do Vendedor:                          │
│   - Gestão de produtos (CRUD completo)           │
│   - Gestão de encomendas                          │
│   - Gestão de afiliados (aceitar/rejeitar)       │
│   - Relatórios de vendas                          │
│   - Configuração de comissões por produto         │
│   - Saques e extrato financeiro                   │
│                                                   │
│ • Níveis de Vendedor (gamificação):               │
│   - Bronze, Prata, Ouro, Platinum                │
│   - Benefícios por nível (taxas reduzidas,        │
│     maior visibilidade, suporte prioritário)      │
└──────────────────────────────────────────────────┘
```

### 4.4 Módulo de Afiliados

```
┌──────────────────────────────────────────────────┐
│              SISTEMA DE AFILIADOS                 │
├──────────────────────────────────────────────────┤
│ • Qualquer utilizador pode ser afiliado           │
│ • Navega pelos produtos disponíveis para afiliação│
│ • Gera links de afiliado únicos:                  │
│   /produto/{slug}?ref={codigo_afiliado}           │
│                                                   │
│ • Dashboard do Afiliado:                          │
│   - Links gerados e desempenho                    │
│   - Cliques, conversões, comissões geradas        │
│   - Produtos mais rentáveis                       │
│   - Histórico de pagamentos                       │
│   - Saque de comissões                            │
│                                                   │
│ • Ferramentas de Promoção:                        │
│   - Banners e materiais promocionais              │
│   - Links para redes sociais (WhatsApp, FB, IG)  │
│   - Códigos de cupão personalizados              │
│   - API de afiliados (para sites externos)       │
│                                                   │
│ • Níveis de Afiliado:                             │
│   - Iniciante (0-5 vendas/mês)                   │
│   - Médio (5-20 vendas/mês)                      │
│   - Expert (20+ vendas/mês) — bónus extra        │
└──────────────────────────────────────────────────┘
```

### 4.5 Módulo de Carrinho e Checkout

```
┌──────────────────────────────────────────────────┐
│              CARRINHO & CHECKOUT                  │
├──────────────────────────────────────────────────┤
│ • Carrinho unificado (físicos + digitais)         │
│ • Checkout multi-passo:                           │
│   1. Revisão do carrinho                          │
│   2. Endereço de entrega (físicos)               │
│   3. Método de envio                             │
│   4. Método de pagamento                         │
│   5. Código de afiliado (opcional)               │
│   6. Confirmação                                  │
│                                                   │
│ • Métodos de Pagamento (Moçambique + Global):     │
│   - M-Pesa                                        │
│   - e-Mola                                        │
│   - Cartão Visa/Mastercard (Stripe)              │
│   - PayPal                                        │
│   - Transferência Bancária                        │
│                                                   │
│ • Para produtos digitais:                         │
│   - Acesso imediato após pagamento                │
│   - Links de download na página de confirmação    │
│   - Envio por email com links seguros             │
└──────────────────────────────────────────────────┘
```

### 4.6 Módulo de Entregas (Produtos Físicos)

```
┌──────────────────────────────────────────────────┐
│           SISTEMA DE ENTREGAS                     │
├──────────────────────────────────────────────────┤
│ • Múltiplos métodos de envio:                     │
│   - Entrega padrão (correio nacional)            │
│   - Entrega expressa                              │
│   - Pickup (recolha em ponto designado)          │
│                                                   │
│ • Rastreamento de encomendas                      │
│ • Notificações de atualização de estado          │
│ • Cálculo automático de frete                    │
└──────────────────────────────────────────────────┘
```

### 4.7 Módulo de Cursos Online (E-Learning)

```
┌──────────────────────────────────────────────────┐
│              MÓDULO DE CURSOS                     │
├──────────────────────────────────────────────────┤
│ • Estrutura: Curso → Módulo → Aula               │
│ • Suporte a vídeo (Vimeo/YouTube/Bunny.net)      │
│ • Materiais complementares (PDF, links)          │
│ • Progresso do aluno                              │
│ • Certificado de conclusão                       │
│ • Área do aluno: /meus-cursos                    │
│ • Comentários e avaliações por aula              │
│ • Suporte a quizzes/avaliações                   │
└──────────────────────────────────────────────────┘
```

### 4.8 Módulo de Pagamentos e Comissões

```
┌──────────────────────────────────────────────────┐
│            SISTEMA FINANCEIRO                     │
├──────────────────────────────────────────────────┤
│ • Carteira digital interna (wallet):             │
│   - Fundos ficam retidos (holding period)        │
│   - Período de segurança: 14 dias para físicos   │
│   - Período de segurança: 7 dias para digitais   │
│                                                   │
│ • Saques:                                         │
│   - Vendedores sacam saldo da wallet             │
│   - Afiliados sacam comissões                    │
│   - Mínimo para saque: 500 MZN                   │
│   - Métodos: M-Pesa, e-Mola, Transferência       │
│                                                   │
│ • Relatórios Financeiros:                         │
│   - Extrato detalhado por período                │
│   - Relatório de comissões pagas/recebidas       │
│   - Relatório fiscal (faturas/recibos)           │
└──────────────────────────────────────────────────┘
```

---

## 5. ARQUITETURA TÉCNICA PREVISTA

```
┌────────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js 15)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Páginas      │  │ Componentes │  │ Estado & Contexto │  │
│  │ Públicas     │  │ React       │  │ (Cart/Auth/...)  │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────▼─────────────────────────────────┐
│                   BACKEND (Django DRF)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Auth     │ │ Produtos │ │ Lojas    │ │ Financeiro   │  │
│  │ (JWT)    │ │ API      │ │ API      │ │ Wallet/      │  │
│  │          │ │          │ │          │ │ Comissões    │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────────┤  │
│  │ Afiliados│ │ Cursos   │ │ Pedidos  │ │ Admin       │  │
│  │ API      │ │ API      │ │ API      │ │ Dashboard   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                   BASE DE DADOS (PostgreSQL)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Users    │ │ Products │ │ Orders   │ │ Wallets/     │  │
│  │ Roles    │ │ Digital  │ │ Payments │ │ Transactions │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Stores   │ │ Affiliate│ │ Courses  │ │ Shipping/    │  │
│  │ (Vendors)│ │ Links    │ │ Lessons  │ │ Tracking     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 6. SERVIÇOS EXTERNOS NECESSÁRIOS

| Serviço | Finalidade |
|---------|-----------|
| **Stripe** | Pagamentos internacionais (cartão) |
| **M-Pesa API** | Pagamento móvel Moçambique |
| **e-Mola API** | Pagamento móvel Moçambique |
| **Vimeo / Bunny.net** | Hospedagem de vídeos (cursos) |
| **AWS S3 / Cloudflare R2** | Armazenamento de ficheiros digitais e imagens |
| **SendGrid / Mailchimp** | Emails transacionais e marketing |
| **Supabase / Redis** | WebSockets para notificações em tempo real |

---

## 7. ESTADO ACTUAL VS. FUTURO

### ✅ Já Implementado (Frontend)
- Estrutura base Next.js 15 + TypeScript
- Páginas públicas (Home, Produto, Contacto, Sobre, FAQ, etc.)
- Carrinho de compras com persistência localStorage
- Catálogo de produtos mock (físicos)
- Painel Admin básico com mock data
- PWA (Service Worker + Manifest)
- Design responsivo com Tailwind + shadcn/ui

### 🔧 Próximas Etapas Recomendadas

| Fase | O quê | Prioridade |
|------|-------|-----------|
| **1** | Backend Django com modelos Users, Products, Stores | 🔴 Alta |
| **2** | API REST de autenticação (JWT) e produtos | 🔴 Alta |
| **3** | Módulo Multi-Vendor (criação e gestão de lojas) | 🔴 Alta |
| **4** | Checkout real com M-Pesa/e-Mola/Stripe | 🔴 Alta |
| **5** | Upload e entrega de produtos digitais | 🟡 Média |
| **6** | Sistema de Afiliados (links, tracking, comissões) | 🟡 Média |
| **7** | Módulo de Cursos Online (vídeo, progresso) | 🟡 Média |
| **8** | Carteira virtual (wallet) e saques | 🟡 Média |
| **9** | Dashboard Vendedor completo | 🟢 Baixa |
| **10** | Dashboard Afiliado completo | 🟢 Baixa |
| **11** | Gamificação (níveis de vendedor/afiliado) | 🟢 Baixa |
| **12** | Aplicativo Mobile (React Native) | 🟢 Baixa |

---

## 8. MODELO DE DADOS (Core Tables)

```
┌────────────────────────────────────────────────────────────────┐
│                     MODELO DE DADOS PRINCIPAL                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ 👤 users                                                        │
│    id, email, password, name, phone, role[] (buyer/seller/     │
│    affiliate/admin), created_at                                │
│                                                                │
│ 🏪 stores                                                      │
│    id, owner_id (FK users), slug, name, description,           │
│    logo, banner, commission_rate (default %), status,          │
│    total_sales, rating, created_at                             │
│                                                                │
│ 📦 products                                                    │
│    id, store_id (FK stores), type (physical|digital|course),   │
│    name, slug, description, price, compare_price,              │
│    stock (NULL if digital), images[], category,                │
│    affiliate_commission (%), featured, status,                 │
│    file_url (digital), created_at                             │
│                                                                │
│ 📁 product_variations                                          │
│    id, product_id, name (ex: "32GB"), price_modifier, stock    │
│                                                                │
│ 🛒 orders                                                      │
│    id, buyer_id (FK users), store_id, status,                  │
│    total_amount, commission_amount, affiliate_id (nullable),   │
│    payment_method, payment_status, shipping_address,           │
│    tracking_code, notes, created_at                            │
│                                                                │
│ 📄 order_items                                                 │
│    id, order_id, product_id, product_name, quantity,           │
│    unit_price, variation_data                                  │
│                                                                │
│ 🔗 affiliate_links                                             │
│    id, affiliate_id (FK users), product_id, code,              │
│    clicks, conversions, commission_rate, created_at            │
│                                                                │
│ 💰 affiliate_commissions                                       │
│    id, affiliate_id, order_id, product_id, amount,             │
│    status (pending|approved|paid), created_at                  │
│                                                                │
│ 💳 wallets                                                     │
│    id, user_id, balance, total_earned, total_withdrawn         │
│                                                                │
│ 💸 transactions                                                │
│    id, wallet_id, type (sale|commission|withdrawal|fee),       │
│    amount, reference_id, description, status, created_at       │
│                                                                │
│ 📚 courses                                                     │
│    id, product_id, instructor_id, level, duration,             │
│    certificate_enabled                                         │
│                                                                │
│ 📖 course_modules                                              │
│    id, course_id, title, sort_order                            │
│                                                                │
│ 🎥 course_lessons                                              │
│    id, module_id, title, video_url, content, duration,         │
│    sort_order                                                   │
│                                                                │
│ ✅ course_progress                                             │
│    id, student_id, lesson_id, completed, completed_at          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. UX / FLUXOS PRINCIPAIS

### Fluxo 1: Comprador Comum
```
Home → Navegar Categorias → Ver Produto → Adicionar ao Carrinho
→ Checkout → Pagamento (M-Pesa/Cartão) → Confirmação → Receber Produto
```

### Fluxo 2: Vendedor (Abrir Loja)
```
Registo → Completar Perfil → Solicitar Abertura de Loja
→ Admin Aprova → Configurar Loja (logo, banner, política)
→ Adicionar Produtos → Definir Preços e Comissões → Vender!
```

### Fluxo 3: Afiliado
```
Registo → Navegar Produtos com "Afiliação Disponível"
→ Gerar Link Único → Partilhar (WhatsApp, Facebook, Site)
→ Alguém Compra → Comissão Creditada → Solicitar Saque
```

### Fluxo 4: Compra de Curso Online
```
Explorar Cursos → Ver Prévia (aula grátis) → Comprar Curso
→ Acesso Imediato → Área do Aluno → Progresso → Certificado
```

---

## 10. PRÓXIMOS PASSOS IMEDIATOS

Com base no que já existe no frontend, recomendo começar por:

1. **Backend Django** com todos os modelos acima
2. **API de autenticação** (registo, login, JWT)
3. **Integrar frontend com API real** (remover dados mock)
4. **Módulo multi-vendor** (criação e gestão de lojas)
5. **Checkout real** com integração de pagamentos Moçambicanos
6. **Sistema de afiliados** com tracking de links
7. **Produtos digitais** com upload e entrega automática

---

> 📌 **Nota:** Este plano é um documento vivo e deve ser actualizado à medida que o projecto evolui.
