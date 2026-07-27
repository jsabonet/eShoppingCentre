# 📋 Diagnóstico: Categorias, Subcategorias & Formulário de Produto

> **Data:** 26 de Julho de 2026

---

## 1. 🐛 O Erro: "'moda' is not a valid UUID"

### Causa

O modelo `Product.category` é uma **ForeignKey** para `Category`:

```python
# backend/apps/products/models.py
category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, ...)
```

O Django REST Framework espera receber o **UUID** da categoria (ex: `7197c54f-e8e7-4e11-b27d-6e68d741b021`), mas o formulário frontend envia o **slug** (ex: `"moda"`).

### Solução

Adicionar um `SlugRelatedField` no serializer do produto:

```python
# No ProductDetailSerializer ou serializer de criação
category = serializers.SlugRelatedField(
    slug_field='slug',
    queryset=Category.objects.filter(is_active=True)
)
```

Isto permite enviar `"moda"` no request e o DRF resolve automaticamente para o UUID correspondente. É a abordagem padrão do DRF e a mais limpa.

---

## 2. 🏪 Como E-commerces Reais Lidam com Categorias

### 2.1 Modelos de categorias no mercado

| Plataforma | Categorias | Subcategorias | Criadas por |
|---|---|---|---|
| **Shopify** | Globais + custom do vendedor | Até 3 níveis | Admin + Vendor |
| **WooCommerce** | Hierárquicas (pai/filho) | Ilimitadas | Admin |
| **Amazon** | Template fixo por categoria | 2-3 níveis | Amazon apenas |
| **Mercado Livre** | Fixas por país | 2 níveis | Plataforma |
| **Etsy** | Tags + categorias | 2 níveis | Vendedor escolhe das existentes |

### 2.2 Abordagem recomendada para o eShoppingCentre

Como **marketplace multi-vendedor**, o ideal é um modelo híbrido:

```
┌─────────────────────────────────────────────────────┐
│                 CATEGORIAS GLOBAIS                   │
│  (criadas pelo admin, visíveis para todos)          │
│                                                     │
│  Eletrônicos                                        │
│  ├── Smartphones                                    │
│  ├── Laptops                                        │
│  └── Acessórios                                     │
│  Moda                                               │
│  ├── Roupa Masculina                                │
│  ├── Roupa Feminina                                 │
│  └── Calçado                                        │
│  Cursos                                             │
│  ├── Programação                                    │
│  ├── Design                                         │
│  └── Negócios                                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              CATEGORIAS DO VENDEDOR                  │
│  (opcionais, o vendedor pode criar as suas)         │
│                                                     │
│  Colecção Verão 2026  (criada pelo vendedor)        │
│  ├── T-shirts                                        │
│  └── Calções                                         │
│  Produtos em Promoção  (criada pelo vendedor)       │
└─────────────────────────────────────────────────────┘
```

**Regras:**
- Categorias globais: admin cria, todos os vendedores usam
- Subcategorias: admin cria (ex: Eletrônicos → Smartphones)
- Categorias do vendedor: o vendedor pode criar as suas próprias para organizar internamente (visíveis só na loja dele)
- Um produto pertence a **1 categoria global** + opcionalmente **1 categoria do vendedor**

### 2.3 Modelo de dados proposto

```python
class Category(BaseModel):  # Já existe — categorias globais
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    parent = models.ForeignKey('self', null=True, blank=True, ...)  # ✅ Já existe
    product_type = models.CharField(choices=..., default='physical')  # 🆕 Filtrar por tipo
    is_active = models.BooleanField(default=True)
    # ... resto igual

class VendorCategory(BaseModel):  # 🆕 Categorias do vendedor
    store = models.ForeignKey('stores.Store', ...)
    name = models.CharField(max_length=255)
    slug = models.SlugField()
    parent = models.ForeignKey('self', null=True, blank=True, ...)

    class Meta:
        unique_together = [('store', 'slug')]
```

---

## 3. 📝 Formulário de Criação de Produto — O Que Falta

### 3.1 Campos actuais vs. Plataformas reais

| Campo | Actual | Shopify | WooCommerce | Amazon | Prioridade |
|---|---|---|---|---|---|
| Nome | ✅ | ✅ | ✅ | ✅ | — |
| Descrição | ✅ (textarea) | ✅ (rich text) | ✅ (rich text) | ✅ (rich text) | 🔴 |
| Preço | ✅ | ✅ | ✅ | ✅ | — |
| Preço original | ✅ | ✅ | ✅ | ✅ | — |
| Categoria | ⚠️ (quebrado) | ✅ | ✅ | ✅ (fixo) | 🔴 |
| Imagens | ✅ | ✅ | ✅ | ✅ | — |
| Stock | ✅ | ✅ | ✅ | ✅ | — |
| SKU | ✅ | ✅ | ✅ | ✅ | — |
| Variantes | ✅ (modelo) | ✅ | ✅ | ✅ | ✅ (já existe) |
| **Peso** | ✅ | ✅ | ✅ | ✅ | — |
| **Dimensões** | ❌ | ✅ | ✅ | ✅ | 🟡 |
| **Marca** | ❌ | ✅ | ✅ | ✅ | 🟡 |
| **Código de barras** | ❌ | ✅ (GTIN) | ✅ (SKU) | ✅ (EAN/UPC) | 🟢 |
| **SEO title** | ❌ | ✅ | ✅ | ❌ | 🟡 |
| **SEO description** | ❌ | ✅ | ✅ | ❌ | 🟡 |
| **Estado** | ❌ | ❌ | ❌ | ✅ (novo/usado) | 🟢 |
| **Condição** | ❌ | ✅ (novo/usado) | ❌ | ✅ | 🟢 |
| **Visibilidade** | ❌ | ✅ | ✅ | ❌ | 🟡 |
| **Data publicação** | ❌ | ✅ | ✅ | ❌ | 🟢 |
| **Qtd mín/máx** | ❌ | ❌ | ✅ | ❌ | 🟢 |
| **Backorder** | ❌ | ✅ | ✅ | ❌ | 🟢 |
| **Produtos relacionados** | ❌ | ✅ | ✅ | ✅ | 🟢 |
| **Política devolução** | ❌ | ❌ | ❌ | ❌ | 🟢 |
| **Garantia** | ❌ | ❌ | ❌ | ❌ | 🟢 |
| **Vídeo** | ❌ | ❌ | ✅ | ✅ | 🟢 |

### 3.2 O que implementar AGORA (🔴 Alta prioridade)

1. **Corrigir o campo categoria** — usar `SlugRelatedField` no serializer
2. **Adicionar subcategorias** — usar o campo `parent` que já existe no modelo
3. **Rich text editor** para descrição — TinyMCE, Quill ou TipTap
4. **SEO básico** — meta_title, meta_description (usar nome/descrição como fallback)
5. **Marca / Fabricante** — campo simples de texto ou modelo Brand

### 3.3 O que implementar DEPOIS (🟡 Média)

6. **Dimensões** (altura, largura, comprimento, unidade) — para cálculo de frete
7. **Código de barras** (GTIN/EAN/UPC) — importante para marketplaces
8. **Visibilidade** — rascunho vs publicado, agendamento
9. **Categorias do vendedor** — o vendedor organiza os seus produtos

### 3.4 Futuro (🟢 Baixa)

10. Condição do produto, quantidade mínima, backorder, relacionados, vídeo

---

## 4. 🎯 Plano de Acção Imediato

| # | Tarefa | Tempo |
|---|---|---|
| 1 | Corrigir `Product.category` — `SlugRelatedField(slug_field='slug')` | 15 min |
| 2 | Popular subcategorias no admin (usar `parent`) | 30 min |
| 3 | Endpoint `GET /api/v1/categories/?parent=slug` para subcategorias | 1h |
| 4 | Frontend: dropdown de categoria com subcategorias aninhadas | 1h |
| 5 | Corrigir formulário de produto para enviar slug da categoria | 15 min |

**Total estimado:** ~3 horas para ter categorias + subcategorias funcionais.

---

> **Conclusão:** O bug é simples de resolver (SlugRelatedField). O sistema de categorias já tem a estrutura base (modelo Category com parent), só precisa ser exposto na API e no frontend. O formulário de produto está funcional mas básico — as maiores lacunas são subcategorias, editor rico e SEO.
