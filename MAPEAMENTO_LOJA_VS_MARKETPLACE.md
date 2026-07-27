# 🗺️ Mapeamento: Nível Loja vs Nível Marketplace

> **Data:** 27 de Julho de 2026

---

## Regra de Ouro

```
┌─────────────────────────────────────────────────────────┐
│  NÍVEL MARKETPLACE (eShoppingCentre global)             │
│  → Visível para TODOS os visitantes (compradores)       │
│  → Agrega produtos de VÁRIAS lojas                      │
│  → Rotas: /, /product/, /stores, /category/, /cart, etc │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  NÍVEL LOJA (painel do vendedor)                        │
│  → Visível APENAS para o vendedor dono da loja          │
│  → Mostra SÓ os dados daquela loja                      │
│  → Rotas: /seller/*                                      │
│  → Protegido por SellerLayout (auth + store check)      │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Formulário de Produto (o que acabámos de construir)

### ✅ Nível Loja — `/seller/products/new`

Tudo o que implementámos está correctamente no **nível loja**:

| Campo | Onde aparece | Quem vê |
|---|---|---|
| Nome, Descrição, Preço | Form de criação | Só o vendedor |
| SKU, Código Barras, Marca | Form de criação | Só o vendedor |
| Condição, Dimensões, Peso | Form de criação | Só o vendedor |
| Stock, Backorder, Qtd Mínima | Form de criação | Só o vendedor |
| SEO (meta título/descrição) | Form de criação | Só o vendedor |
| Palavras-chave | Form de criação | Só o vendedor |
| Toggles (Ativo, Destaque, Promoção) | Form de criação | Só o vendedor |
| Garantia, Vídeo, Comissão | Form de criação | Só o vendedor |

### ⚠️ O que NÃO deve aparecer na página pública da loja

| Campo | Deve aparecer em `/store/[slug]`? | Deve aparecer em `/product/[slug]`? |
|---|---|---|
| Nome | ✅ Sim | ✅ Sim |
| Descrição | ❌ Não (é da loja, não do produto) | ✅ Sim |
| Descrição Curta | ❌ Não | ✅ Sim (card) |
| Preço | ❌ Não | ✅ Sim |
| SKU | ❌ Não | ❌ Não (interno) |
| Código de Barras | ❌ Não | ❌ Não (interno) |
| Marca | ❌ Não | ✅ Sim |
| Condição | ❌ Não | ✅ Sim |
| Dimensões/Peso | ❌ Não | ❌ (só no checkout/frete) |
| Stock | ❌ Não | ❌ (só "Em stock"/"Esgotado") |
| Backorder | ❌ Não | ❌ Não |
| Qtd Mínima | ❌ Não | ❌ Não |
| SEO | ❌ Não | ❌ Não (meta tags só no HTML) |
| Palavras-chave | ❌ Não | ❌ Não |
| Toggles | ❌ Não | ❌ Não (controlam visibilidade) |
| Garantia | ❌ Não | ✅ Sim (info ao comprador) |
| Vídeo | ❌ Não | ✅ Sim |
| Comissão | ❌ Não | ❌ Não (interno) |

---

## 2. Listagem de Produtos

### Marketplace — `/products` ou Homepage

```
┌─────────────────────────────────────────┐
│ Card de Produto (público)               │
│ ┌─────────────────────────────────────┐ │
│ │ [Imagem]                            │ │
│ │ Nome do Produto                     │ │
│ │ Preço — Preço Original (riscado)    │ │
│ │ ⭐ 4.5 (23 reviews)                 │ │
│ │ Badge: "Promoção" ou "Novo"         │ │
│ │ Vendido por: Nome da Loja           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Dados exibidos:** `name`, `price`, `compare_price`, `primary_image`, `rating`, `review_count`, `is_on_sale` → badge, `store.name`

**NÃO exibe:** SKU, barcode, brand, condition, dimensões, stock exato, backorder, comissão

### Loja — `/seller/products`

```
┌─────────────────────────────────────────┐
│ Tabela de Produtos (vendedor)           │
│ ┌─────────────────────────────────────┐ │
│ │ [Img] Nome │ Preço │ Stock │ Status │ │
│ │ [Img] Nome │ Preço │ Stock │ Status │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Dados exibidos:** `name`, `price`, `primary_image`, `stock`, `status`, `sales_count`

**NÃO exibe ao público:** Stock exato, status interno (draft/inactive)

---

## 3. Página de Detalhe do Produto — `/product/[slug]`

### O que mostrar (marketplace — qualquer visitante)

```
┌─────────────────────────────────────────┐
│ Breadcrumb: Home > Categoria > Produto  │
├─────────────────────────────────────────┤
│ [Imagem Principal]  [Miniaturas]        │
│                                         │
│ Nome do Produto                         │
│ Marca: Samsung                          │  ← NOVO (brand)
│ Condição: Novo                          │  ← NOVO (condition)
│ ⭐ 4.5 (23 avaliações)                  │
│                                         │
│ Preço: 4.999 MZN                        │
│ Preço Original: 5.999 MZN (riscado)     │
│                                         │
│ Descrição:                              │
│ Lorem ipsum dolor sit amet...           │
│                                         │
│ Garantia: 365 dias                      │  ← NOVO (warranty_days)
│                                         │
│ Vídeo: [YouTube embed]                  │  ← NOVO (video_url)
│                                         │
│ Vendido por: Loja Crere                 │
│                                         │
│ [Adicionar ao Carrinho]                 │
└─────────────────────────────────────────┘
```

### O que NÃO mostrar

| Campo | Razão |
|---|---|
| SKU | Interno do vendedor |
| Código de Barras | Interno |
| Dimensões exatas | Só no cálculo de frete |
| Stock exato | Mostrar "Em stock" ou "Apenas 3 restantes" |
| Preço de custo | Não existe no modelo |
| Comissão | Interno |
| Meta title/description | Só no `<head>` HTML |
| Tags | Podem aparecer como "tags" visuais |

---

## 4. Página da Loja — `/store/[slug]`

### O que mostrar (marketplace — qualquer visitante)

```
┌─────────────────────────────────────────┐
│ [Banner da Loja]                        │
│ [Logo] Nome da Loja                     │
│ Slogan / Tagline                        │
│ ⭐ 4.2 | 📍 Maputo | 📦 156 produtos    │
├─────────────────────────────────────────┤
│ Sobre a Loja                            │
│ Informações (telefone, email)           │
├─────────────────────────────────────────┤
│ Grid de Produtos desta loja:            │
│ [Card] [Card] [Card]                    │
└─────────────────────────────────────────┘
```

**Dados exibidos:** `name`, `logo`, `banner`, `tagline`, `description`/`about`, `rating`, `location`, `total_products`, `total_sales`, `phone`, `email`

**NÃO exibe:** `status` da loja (pending/active), `default_affiliate_commission`, `low_stock_threshold`

---

## 5. Dashboard do Vendedor — `/seller/dashboard`

### O que mostrar (nível loja — só o vendedor)

```
┌─────────────────────────────────────────┐
│ Cards:                                  │
│ Vendas Hoje │ Receita Total │ Produtos  │
│ Pendentes   │ Avaliação                 │
├─────────────────────────────────────────┤
│ Encomendas Recentes                     │
│ (cliente, valor, status, data)          │
├─────────────────────────────────────────┤
│ Produtos Mais Vendidos                  │
│ (nome, unidades, receita)               │
└─────────────────────────────────────────┘
```

**Dados exibidos:** `today_sales`, `today_revenue`, `total_revenue`, `total_products`, `total_orders`, `pending_orders`, `store_rating`, `recent_orders`, `top_products`

**NÃO exibe:** Dados de outras lojas, comissões de afiliados (está em `/seller/affiliates`)

---

## 6. Resumo: O que vai para onde

| Dado | Marketplace | Loja (Seller) |
|---|---|---|
| **Produto — nome** | ✅ Cards + Detail | ✅ Lista + Edit |
| **Produto — preço** | ✅ Cards + Detail | ✅ Lista + Edit |
| **Produto — imagem** | ✅ Cards + Detail | ✅ Lista + Edit |
| **Produto — descrição** | ✅ Detail | ✅ Edit |
| **Produto — descrição curta** | ✅ Cards | ✅ Edit |
| **Produto — marca** | ✅ Detail | ✅ Edit |
| **Produto — condição** | ✅ Detail | ✅ Edit |
| **Produto — rating/reviews** | ✅ Cards + Detail | ✅ Lista |
| **Produto — stock (bool)** | ✅ "Em stock" | ✅ Número exato |
| **Produto — SKU** | ❌ | ✅ Lista + Edit |
| **Produto — código barras** | ❌ | ✅ Edit |
| **Produto — dimensões** | ❌ (só frete) | ✅ Edit |
| **Produto — garantia** | ✅ Detail | ✅ Edit |
| **Produto — vídeo** | ✅ Detail | ✅ Edit |
| **Produto — comissão** | ❌ | ✅ Edit |
| **Produto — tags** | ✅ (visual) | ✅ Edit |
| **Produto — status** | ❌ | ✅ Lista + Edit |
| **Produto — toggles** | ❌ (efeito visível) | ✅ Edit |
| **Loja — nome/logo** | ✅ Detail + Cards | ✅ Settings |
| **Loja — descrição** | ✅ Detail | ✅ Settings |
| **Loja — contacto** | ✅ Detail | ✅ Settings |
| **Loja — políticas** | ✅ Detail | ✅ Settings |
| **Loja — comissão padrão** | ❌ | ✅ Settings |
| **Loja — stock threshold** | ❌ | ✅ Settings |
| **Loja — status** | ❌ | ✅ (pendente/activa) |
| **Encomendas** | ❌ | ✅ Lista |
| **Dashboard stats** | ❌ | ✅ Cards |
| **Afiliados** | ❌ | ✅ Lista |
| **Alunos/Certificados** | ❌ | ✅ Lista |

---

## 7. O que falta construir (marketplace — lado público)

| # | Funcionalidade | Rota | Prioridade |
|---|---|---|---|
| 1 | Mostrar **marca** no detalhe do produto | `/product/[slug]` | 🔴 |
| 2 | Mostrar **condição** no detalhe do produto | `/product/[slug]` | 🔴 |
| 3 | Mostrar **garantia** no detalhe do produto | `/product/[slug]` | 🔴 |
| 4 | Mostrar **descrição curta** nos cards | `/products`, `/store/[slug]` | 🔴 |
| 5 | Embed de **vídeo** no detalhe do produto | `/product/[slug]` | 🟡 |
| 6 | Badge visual de **condição** nos cards | `/products` | 🟡 |
| 7 | Página de **tags** do marketplace | `/search?tag=smartphone` | 🟢 |

---

> **Conclusão:** Tudo o que implementámos até agora está correctamente no **nível loja** (`/seller/*`). O que falta é expor alguns desses campos no **nível marketplace** (páginas públicas de produto e loja).
