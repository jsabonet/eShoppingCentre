# 🔍 Diagnóstico: Loja de Produtos Físicos — Funcionalidades & Padrão Internacional

> Data: 10 de Agosto de 2026
> Escopo: Avaliação completa da loja de produtos físicos (modelo, inventário, envios, devoluções, checkout)

---

## 1. O QUE ESTÁ IMPLEMENTADO ✅

### 1.1 Modelo de Produto Físico

| Campo | Estado | Descrição |
|-------|:------:|-----------|
| `name`, `slug`, `description`, `short_description` | ✅ | Base do produto |
| `price`, `compare_price` | ✅ | Preço + referência para desconto |
| `stock` | ✅ | Quantidade em inventário |
| `sku` | ✅ | Código interno do vendedor |
| `barcode` | ✅ | GTIN/EAN/UPC/ISBN |
| `brand` | ✅ | Marca/fabricante |
| `condition` | ✅ | Novo/Usado/Recondicionado |
| `weight`, `height`, `width`, `length` | ✅ | Peso (kg) + dimensões (cm) |
| `warranty_days` | ✅ | Dias de garantia (0 = sem) |
| `allow_backorder` | ✅ | Permitir venda sem stock |
| `min_order_quantity` | ✅ | Quantidade mínima por encomenda |
| `meta_title`, `meta_description` | ✅ | SEO |
| `video_url` | ✅ | YouTube/Vimeo embed |
| `specifications` (JSON) | ✅ | Tabela de specs customizável |
| `tags` (JSON) | ✅ | Tags de pesquisa |

### 1.2 Variantes de Produto

| Funcionalidade | Estado | Detalhe |
|---------------|:------:|---------|
| `ProductVariant` (SKU, preço, stock, imagem) | ✅ | Modelo completo |
| Atributos (JSON: cor, tamanho, etc.) | ✅ | `attributes = {"Cor": "Azul", "Tamanho": "M"}` |
| Preço diferencial por variante | ✅ | `price` no variant sobrescreve o do produto |
| Stock individual por variante | ✅ | `stock` no variant |
| Imagem por variante | ✅ | `image` + `image_url` no serializer |
| Selector de variantes no frontend | ✅ | `ProductDetailShop` renderiza atributos |

### 1.3 Imagens do Produto

| Funcionalidade | Estado |
|---------------|:------:|
| Galeria múltipla (`ProductImage`) | ✅ |
| Imagem principal (`is_primary`) | ✅ |
| Alt text por imagem | ✅ |
| Ordenação (`sort_order`) | ✅ |
| Upload no formulário de criação | ✅ |
| Galeria com zoom no frontend (`ProductImageGallery`) | ✅ |

### 1.4 Encomendas

| Funcionalidade | Estado |
|---------------|:------:|
| Estados: pending → confirmed → processing → shipped → delivered | ✅ |
| Cancelamento (restaura stock físico) | ✅ |
| Reembolso (`refunded`) | ✅ |
| `tracking_code` | ✅ (campo existe) |
| `estimated_delivery` | ✅ (campo existe) |
| `shipping_address` (JSON) | ✅ |
| `buyer_notes` + `seller_notes` | ✅ |
| `platform_fee` (8% automático) | ✅ |
| Affiliate tracking na order | ✅ |
| Lista de encomendas (buyer + seller) | ✅ |
| Seller pode mudar status + tracking | ✅ |
| Filtro por status + busca no frontend | ✅ |

### 1.5 Devoluções

| Funcionalidade | Estado |
|---------------|:------:|
| `ReturnRequest` com 6 estados | ✅ |
| Buyer cria pedido (API) | ✅ |
| Seller lista devoluções (API) | ✅ |
| `vendor_notes` + `refund_amount` | ✅ |

### 1.6 Checkout

| Funcionalidade | Estado |
|---------------|:------:|
| Formulário multi-campo (nome, telefone, morada, cidade, província) | ✅ |
| 6 métodos de pagamento (M-Pesa, e-Mola, Banco, Cartão, COD, Teste) | ✅ |
| Validação de stock antes de criar order | ✅ |
| Instruções por método de pagamento | ✅ |
| Multi-loja (produtos de lojas diferentes no mesmo carrinho) | ✅ |

### 1.7 Frontend

| Página | Estado |
|--------|:------:|
| `/product/[slug]` — detalhe com galeria, variantes, specs | ✅ |
| `/seller/products` — CRUD com filtros | ✅ |
| `/seller/products/new` — formulário 4 passos (physical/digital/course) | ✅ |
| `/seller/orders` — lista com busca, filtro, change status | ✅ |
| `/checkout` — formulário + métodos pagamento | ✅ |
| `/account/orders` — histórico de compras | ✅ |
| `/cart` — carrinho lateral | ✅ |

---

## 2. O QUE ESTÁ FALTANDO 🔴

### 2.1 🔴 CRÍTICO — Cálculo de Frete (Shipping)

**Problema:** `shipping_cost` na Order é sempre `0`. Não existe modelo de zonas de entrega, transportadoras, ou tabelas de preço.

**Modelos em falta:**
- `ShippingZone` — zona geográfica (ex: "Maputo Cidade", "Sul", "Norte")
- `ShippingMethod` — método por loja (ex: "Standard", "Expresso")
- `ShippingRate` — preço por zona × método × peso/valor

**Impacto:** Checkout não mostra custo de envio real. Vendedor não pode definir para onde envia nem quanto cobra. 🚫

### 2.2 🔴 CRÍTICO — Devoluções (Frontend + Fluxo)

**Problema:** API existe (`ReturnRequest` + endpoints), mas **zero frontend**:
- Buyer não tem página para solicitar devolução
- Seller não tem página para aprovar/rejeitar
- Não há notificação quando devolução é criada

**Impacto:** Impossível usar devoluções sem acessar diretamente a API. 🚫

### 2.3 🔴 CRÍTICO — Tracking de Encomendas

**Problema:** `tracking_code` existe mas não há:
- Integração com transportadoras moçambicanas (DHL, Correios, transportadoras locais)
- Página pública de rastreio
- Atualização automática de status

**Impacto:** Cliente não sabe onde está a encomenda. 🚫

### 2.4 🔴 CRÍTICO — Stock History / Inventory Log

**Problema:** Stock é alterado diretamente (`product.stock -= quantity`), sem registo de:
- Quem alterou
- Quando
- Quantidade anterior → nova
- Motivo (venda, cancelamento, ajuste manual, devolução)

**Modelo em falta:** `StockMovement` ou `InventoryLog`

**Impacto:** Sem auditoria de inventário. Impossível reconciliar stock. 🚫

### 2.5 🔴 CRÍTICO — Invoice / Factura PDF

**Problema:** Não há geração de factura/recibo para o comprador.

**Impacto:** Cliente não tem comprovativo fiscal. Vendedor não tem registo para contabilidade. 🚫

---

### 2.6 🟡 ALTA — Sistema de Envios

| Falta | Prioridade |
|-------|:----------:|
| Zonas de entrega por loja (províncias/cidades) | 🟡 |
| Tabela de preços por zona + peso/dimensões | 🟡 |
| Frete grátis acima de valor X | 🟡 |
| Cálculo em tempo real no checkout | 🟡 |
| Estimativa de entrega automática | 🟡 |
| Múltiplas transportadoras por loja | 🟡 |
| Pickup points / recolha em loja | 🟢 |
| Dimensional weight (peso volumétrico) | 🟡 |

### 2.7 🟡 ALTA — Gestão de Inventário

| Falta | Prioridade |
|-------|:----------:|
| Histórico de alterações de stock (StockMovement) | 🟡 |
| Importação CSV/Excel de produtos | 🟡 |
| Exportação CSV do catálogo | 🟢 |
| Duplicar/clonar produto | 🟢 |
| Alerta de stock baixo por email (já há notificação in-app) | 🟡 |
| Stock multi-armazém | 🟢 |
| Back-in-stock notification (waitlist) | 🟡 |

### 2.8 🟡 ALTA — Devoluções & After-Sales

| Falta | Prioridade |
|-------|:----------:|
| Página de solicitar devolução (buyer) | 🟡 |
| Página de gerir devoluções (seller) | 🟡 |
| Aprovar/rejeitar devolução (seller endpoint) | 🟡 |
| RMA number (número único de autorização) | 🟡 |
| Política de devolução por produto (prazo diferente) | 🟡 |
| Devolução parcial (itens individuais, não order inteira) | 🟡 |
| Disputa/escalação para admin | 🟢 |
| Upload de fotos na devolução (prova de dano) | 🟡 |

### 2.9 🟡 ALTA — Order Management

| Falta | Prioridade |
|-------|:----------:|
| Order timeline / audit log (quem mudou status, quando) | 🟡 |
| Processamento em lote (bulk status change) | 🟡 |
| Impressão de factura/guia de remessa | 🟡 |
| Notas internas visíveis só para equipa da loja | 🟡 |
| Filtro avançado: por período, valor, província | 🟡 |
| Exportar encomendas CSV | 🟢 |

### 2.10 🟡 ALTA — Produto

| Falta | Prioridade |
|-------|:----------:|
| Barcode/EAN por variante (só existe no produto) | 🟡 |
| Guia de tamanhos (size chart) para roupa/calçado | 🟡 |
| Produtos relacionados manuais (cross-sell) | 🟡 |
| Upsell "Quem comprou X também comprou Y" | 🟢 |
| Comparação de produtos (2-3 side by side) | 🟢 |
| Review com foto (cliente anexa imagem) | 🟡 |
| Q&A por produto (perguntas públicas + resposta vendor) | 🟡 |

---

## 3. PADRÃO INTERNACIONAL 🇺🇳

### 3.1 Comparação com Marketplaces de Referência

| Funcionalidade | eShopping | Shopify | WooCommerce | Amazon | Mercado Livre |
|---------------|:---------:|:-------:|:-----------:|:------:|:------------:|
| Variantes (tamanho/cor) | ✅ | ✅ | ✅ | ✅ | ✅ |
| SKU por variante | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cálculo de frete automático | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tracking integrado | ❌ | ✅ | ✅ | ✅ | ✅ |
| Devoluções (end-to-end) | 🟡 | ✅ | ✅ | ✅ | ✅ |
| Factura/Invoice PDF | ❌ | ✅ | ✅ | ✅ | ✅ |
| Stock history | ❌ | ✅ | ✅ | ✅ | ✅ |
| Importação CSV | ❌ | ✅ | ✅ | ✅ | ✅ |
| Multi-armazém | ❌ | ✅ | ✅ | ✅ | ✅ |
| Order timeline | ❌ | ✅ | ✅ | ✅ | ✅ |
| Impressão de guia de remessa | ❌ | ✅ | ✅ | ✅ | ✅ |
| Carrinho multi-loja | ✅ | ❌ | ❌ | ❌ | ❌ |
| Chat vendor-cliente | ✅ | ❌ | ❌ | ❌ | ✅ |
| M-Pesa/e-Mola | ✅ | ❌ | ❌ | ❌ | ❌ |
| PWA | ✅ | ❌ | ❌ | ❌ | ❌ |

### 3.2 Funcionalidades Standard em E-commerce (Fonte: Shopify Plus, Magento, WooCommerce)

Estas são consideradas **obrigatórias** para qualquer e-commerce profissional:

| # | Funcionalidade | eShopping |
|---|---------------|:---------:|
| 1 | Cálculo de frete em tempo real | ❌ |
| 2 | Tracking de encomenda (público) | ❌ |
| 3 | Devoluções self-service | ❌ |
| 4 | Factura/recibo automático | ❌ |
| 5 | Histórico de inventário | ❌ |
| 6 | Notificações de status (email) | ❌ |
| 7 | Carrinho abandonado (recovery) | ❌ |
| 8 | Wishlist | ✅ |
| 9 | Cupões/descontos | 🟡 |
| 10 | Reviews com verificação de compra | ✅ |
| 11 | Multi-idioma | ❌ |
| 12 | SEO (sitemap, schema, canonical) | ❌ |
| 13 | Checkout como convidado | ❌ |
| 14 | Estimativa de entrega | ❌ |
| 15 | Order export (CSV/PDF) | ❌ |

### 3.3 Contexto Moçambicano — Funcionalidades Específicas

| Funcionalidade | Importância | Estado |
|---------------|:-----------:|:------:|
| M-Pesa (Vodacom) | 🔴 Essencial | ✅ |
| e-Mola (Movitel) | 🔴 Essencial | ✅ |
| Pagamento na entrega (COD) | 🔴 Essencial | 🟡 (UI mas sem fluxo) |
| Entregas via transportadoras locais | 🔴 Essencial | ❌ |
| Referência bancária (Millennium BIM, BCI) | 🟡 Importante | 🟡 (UI mas sem fluxo) |
| Zonas de entrega (províncias Moçambique) | 🔴 Essencial | ❌ |
| Preços em MZN | 🔴 Essencial | ✅ |

---

## 4. PLANO DE ACÇÃO PRIORIZADO

### 🚨 FASE 1 — Funcionalidades Bloqueadoras (3 semanas)

| # | Tarefa | Esforço | Impacto |
|---|--------|:------:|---------|
| 1 | **Cálculo de frete** — ShippingZone, ShippingMethod, ShippingRate + endpoint estimativa + integração checkout | 4 dias | 🔴 Desbloqueia checkout real |
| 2 | **Devoluções frontend** — Buyer solicita + Seller aprova/rejeita + email notificação | 3 dias | 🔴 Fecha ciclo after-sales |
| 3 | **Tracking público** — Página `/tracking/{code}` + atualização seller | 2 dias | 🔴 Transparência para cliente |
| 4 | **Stock History** — Modelo StockMovement + log automático | 2 dias | 🔴 Auditoria de inventário |
| 5 | **Factura PDF** — Geração na order confirmada + download | 2 dias | 🔴 Comprovativo fiscal |

### 🟡 FASE 2 — Diferenciação Competitiva (3 semanas)

| # | Tarefa | Esforço |
|---|--------|:------:|
| 6 | Importação/Exportação CSV produtos | 3 dias |
| 7 | Order timeline (event log) | 1 dia |
| 8 | Bulk order processing (mudar status em lote) | 2 dias |
| 9 | Back-in-stock notification (waitlist) | 2 dias |
| 10 | Carrinho abandonado (recovery email) | 2 dias |
| 11 | Checkout como convidado | 2 dias |
| 12 | Review com foto | 1 dia |
| 13 | Q&A por produto | 2 dias |

### 🟢 FASE 3 — Padrão Internacional (4 semanas)

| # | Tarefa |
|---|--------|
| 14 | Impressão de guia de remessa (PDF) |
| 15 | Multi-armazém |
| 16 | Dimensional weight para frete |
| 17 | Comparação de produtos |
| 18 | Pickup points / recolha em loja |
| 19 | Integração transportadoras (API) |
| 20 | Scheduled delivery (time slots) |
| 21 | Devolução parcial (por item) |
| 22 | Size guide visual |

---

## 5. CONCLUSÃO

A loja de produtos físicos está a **~55%** de prontidão. É a área mais fraca do marketplace.

**O que está bom:**
- Modelo de dados rico (variantes, dimensões, peso, barcode, condição)
- Sistema de encomendas completo (estados, tracking code, estimated delivery)
- Checkout funcional (embora sem frete real)
- Galeria de imagens e variantes no frontend

**O que é crítico implementar:**
1. **Cálculo de frete** — sem isto, o checkout para produtos físicos não é real
2. **Devoluções frontend** — sem isto, o after-sales não funciona
3. **Tracking público** — expectativa básica de qualquer e-commerce
4. **Stock history** — sem auditoria, não há confiança no inventário
5. **Factura PDF** — obrigatório para contabilidade

Os 5 itens acima são **bloqueadores** — sem eles, a loja física não está pronta para produção real.

---

*Relatório gerado por análise completa: modelo Product, Order, ReturnRequest + endpoints + frontend checkout/seller/account.*
