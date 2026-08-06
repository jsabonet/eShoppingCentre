# Plano de Funcionalidades Faltantes — Lojas Físicas e Digitais

> Data: 2026-08-06
> Estado: Análise concluída. Nada implementado ainda.
> Referência: Comparação com plataformas internacionais (Shopify, WooCommerce, Etsy, Gumroad, Hotmart, Mercado Livre, Amazon)

---

## 📊 Estado Atual (Para Referência)

### O que JÁ existe:

| Área | Físicas | Digitais |
|------|---------|----------|
| Produto CRUD | ✅ | ✅ |
| Variantes (cor/tamanho) | ✅ | — |
| Imagens (principal + miniaturas) | ✅ | ✅ |
| Categorias por tipo | ✅ | ✅ |
| Carrinho + Checkout | ✅ | ✅ |
| Orders (status flow) | ✅ | ✅ |
| Devoluções (modelo) | ✅ | — |
| Cupons (loja/produto/categoria) | ✅ | ✅ |
| Reviews (compra verificada) | ✅ | ✅ |
| Wishlist | ✅ | ✅ |
| Afiliados | ✅ | ✅ |
| Wallet (saldo vendedor) | ✅ | ✅ |
| Pagamentos (M-Pesa, e-Mola, Stripe, PayPal) | ✅ | ✅ |
| Campos físicos (peso, dimensões, código de barras) | ✅ | — |
| Metadados digitais (formato, versão, licença) | — | ✅ |
| DigitalDownload (tracking) | — | ✅ |
| Limite de downloads + expiração | — | ✅ |
| Upload de ficheiro digital único | — | ✅ |
| Documentos de verificação da loja | ✅ | ✅ |
| Dashboard do vendedor | ✅ | ✅ |
| SEO (meta title/description) | ✅ | ✅ |
| Notificações (modelo base) | ✅ | ✅ |

---

## 🔴 CRÍTICO — Experiência de compra quebrada sem isto

### 1. Envio / Shipping / Logística (FÍSICAS)

**NÃO EXISTE NADA.** O modelo `Order` tem campos `shipping_method`, `tracking_code`, `estimated_delivery` MAS:

- ❌ Zero integração com transportadoras (DHL, FedEx, Correios de Moçambique, etc.)
- ❌ Zero cálculo de frete (nem fixo nem dinâmico)
- ❌ Zero zonas de envio (Maputo vs Nampula, nacional vs internacional)
- ❌ Zero geração de etiqueta de envio
- ❌ Zero opção de recolha em loja (pickup point)
- ❌ Zero estimativa de prazo de entrega automática

#### Modelos necessários:
- **`ShippingZone`** — `name`, `countries`/`regions` (JSON)
- **`ShippingRate`** — `zone` (FK), `method_name`, `base_rate`, `per_kg_rate`, `free_above` (valor mínimo para frete grátis), `estimated_days_min`, `estimated_days_max`
- **`ShippingLabel`** — `order` (FK), `carrier`, `tracking_code`, `label_url`, `created_at`

#### Funcionalidades:
- Cálculo de frete no checkout baseado no CEP/cidade do comprador
- Frete grátis acima de X MZN (configurável por loja)
- Múltiplos métodos: "Normal (5-10 dias)", "Expresso (2-3 dias)", "Recolha em loja"
- Tracking automático via webhook da transportadora
- Notificação: "Encomenda enviada", "Encomenda entregue"

---

### 2. Gestão de Inventário Avançada (FÍSICAS)

`low_stock_threshold` existe como campo mas **não dispara nada**.

#### Funcionalidades:
- Alerta no dashboard quando stock <= threshold
- Email diário de stock baixo para o vendedor
- Registo de ajustes de stock (log de auditoria: quem, quando, porquê)
- Importação/exportação CSV de produtos
- Histórico de movimentação de stock por produto
- Contagem de inventário assistida (parcial/total)
- Stock por armazém/localização (se houver múltiplos)

#### Modelos necessários:
- **`StockAdjustment`** — `product`, `previous_stock`, `new_stock`, `reason`, `user`, `notes`

---

### 3. Facturação / Recibos Fiscais (FÍSICAS)

Crítico para Moçambique — sem isto não há conformidade fiscal.

#### Funcionalidades:
- Geração de factura PDF com:
  - Dados da loja (nome, NUIT, endereço)
  - Dados do comprador
  - Itens, quantidades, preços, IVA (se aplicável)
  - Total, método de pagamento
  - Número sequencial único por loja
- Envio automático por email após confirmação de pagamento
- Histórico de facturas no `/account/orders`
- Configuração de IVA por loja (%)

#### Modelos necessários:
- **`Invoice`** — `order` (FK, único), `invoice_number`, `tax_rate`, `tax_amount`, `pdf_file`

---

### 4. Sistema de Mensagens Comprador↔Vendedor (AMBAS)

**Não há absolutamente nada.** O utilizador que compra não tem como contactar o vendedor dentro da plataforma.

#### Funcionalidades:
- Chat por encomenda ("Tenho uma dúvida sobre o pedido #PED-123ABC")
- Chat pré-venda na página do produto ("Este produto tem garantia?")
- Notificações de nova mensagem (email + in-app)
- Histórico de conversas em `/account/messages`
- Vendedor vê conversas no dashboard

#### Modelos necessários:
- **`Conversation`** — `buyer`, `seller`, `product`, `order`, `subject`, `created_at`
- **`Message`** — `conversation` (FK), `sender`, `body`, `is_read`, `created_at`

---

### 5. Proteção de Ficheiros Digitais (DIGITAIS)

Actualmente o ficheiro é servido directamente pelo Django. Zero segurança.

#### Funcionalidades:
- URLs de download assinadas (temporárias, expiram em 1h)
- Proteção contra hotlinking (verificar `Referer`)
- Prevenção de downloads simultâneos da mesma compra
- CDN para ficheiros grandes (Cloudflare R2, S3)
- Suporte a múltiplos ficheiros por produto (não apenas 1)
- Watermarking automático em PDFs

#### Infraestrutura:
- Integração com Cloudflare R2 ou AWS S3
- `django-storages` para servir ficheiros via CDN
- URLs pré-assinadas com expiração

---

## 🟠 IMPORTANTE — Diferenciação competitiva

### 6. Recuperação de Carrinho Abandonado (AMBAS)

#### Funcionalidades:
- Tracking de carrinhos abandonados (última actividade > 1h)
- Email automático: "Tens itens no carrinho!" após 2h, 24h
- Cupom de desconto no 2º email para incentivar conversão
- Dashboard com taxa de abandono e recuperação

---

### 7. Recomendações / "Clientes também compraram" (AMBAS)

#### Funcionalidades:
- Secção na página de produto: "Quem comprou este, também comprou..."
- Secção na homepage: "Baseado no teu histórico"
- Email: "Produtos que podem interessar-te"
- Cross-sell no checkout: "Adiciona também..."

---

### 8. Bundles / Kits de Produtos (AMBAS)

#### Funcionalidades:
- Vendedor cria bundle: "Kit Escritório = Monitor + Teclado + Rato" com preço especial
- Bundle de produtos digitais: "Pack de 3 Ebooks com 30% desconto"
- Desconto automático se comprar todos os itens do bundle
- Upsell "Complete o bundle" no checkout

#### Modelos necessários:
- **`ProductBundle`** — `name`, `store`, `discount_percentage`, `is_active`
- **`BundleItem`** — `bundle`, `product`, `quantity`

---

### 9. Planos de Assinatura / Produtos Recorrentes (DIGITAIS)

#### Funcionalidades:
- Produto vendido como subscrição mensal/anual
- Pagamento recorrente automático
- Acesso vitalício ou por período pago
- Gestão de assinaturas pelo comprador (cancelar, pausar, renovar)
- Notificação antes da renovação

#### Modelos necessários:
- **`SubscriptionPlan`** — `product`, `interval` (monthly/yearly), `price`
- **`Subscription`** — `user`, `plan`, `status`, `current_period_start`, `current_period_end`

---

### 10. App Mobile / PWA (AMBAS)

- Transformar o frontend Next.js numa PWA
- Service Worker para cache offline
- Notificações push nativas
- Instalação na homescreen do telemóvel

---

### 11. Variações Visuais de Produto (FÍSICAS)

`ProductVariant` existe com `image` por variante, mas não há:

- Swatches visuais (cor, imagem) no selector da página de produto
- Galeria que muda ao selecionar variante
- Indicador de stock por variante no selector ("Vermelho/M — 3 em stock")

---

## 🟡 DESEJÁVEL — Maturidade da plataforma

### 12. Programa de Fidelidade / Pontos (AMBAS)

- Sistema de pontos por compra (ex: 1 MZN = 1 ponto)
- Trocar pontos por descontos
- Níveis VIP (Bronze, Prata, Ouro) com benefícios

### 13. Guest Checkout (AMBAS)

- Comprar sem criar conta
- Pedir email + telefone no checkout
- Criar conta opcionalmente após compra

### 14. Comparação de Produtos (AMBAS)

- Selecionar 2-4 produtos e comparar lado a lado
- Tabela de especificações comparativa

### 15. Feed de Produtos (Google Shopping, Facebook) (AMBAS)

- Gerar XML/CSV compatível com Google Merchant Center
- Sincronização automática de inventário
- Facebook Catalog via pixel/catálogo

### 16. Vendedor em Destaque / Loja Patrocinada (AMBAS)

- Sistema de "featured listing" pago
- Loja destacada na homepage
- Produto patrocinado nos resultados de busca

### 17. Múltiplos Idiomas / Multi-moeda (AMBAS)

- Suporte a PT, EN
- Conversão de preços (MZN, USD, EUR, ZAR)
- Taxa de câmbio configurável

### 18. Acessibilidade (WCAG 2.1) (AMBAS)

- Navegação por teclado
- Labels ARIA em todos os componentes
- Contraste de cores adequado
- Texto alternativo obrigatório em imagens
- Suporte a leitor de ecrã

### 19. Análise de Dados para Vendedor (AMBAS)

| Dashboard | Métricas |
|-----------|----------|
| Vendas | Receita diária/semanal/mensal, ticket médio |
| Produtos | Mais vendidos, menos vendidos, taxa de conversão |
| Clientes | Recorrentes, novos, por região, LTV |
| Tráfego | Visitas à loja, origem (directa, busca, redes sociais) |
| Inventário | Giro de stock, produtos parados, rupturas |

### 20. Bulk Operations (AMBAS)

- Importação CSV de produtos
- Exportação de produtos, pedidos, clientes
- Edição em massa (preço, stock, categoria)

---

## 🔵 PADRÕES INTERNACIONAIS — Interoperabilidade

### 21. GTIN/EAN/ISBN Validation (FÍSICAS)

- Validação automática de códigos de barras
- Integração com base de dados de produtos (Google Product API)
- Auto-preenchimento de nome, marca, categoria a partir do GTIN

### 22. Open Commerce / APIs Públicas (AMBAS)

- API pública para consultar produtos (headless commerce)
- Webhooks para integrações externas (ERP, CRM)
- API keys com permissões granulares

### 23. Conformidade Fiscal Moçambicana (AMBAS)

- Integração com sistema de facturação electrónica da AT
- Comunicação obrigatória de facturas (Decreto 77/2020)
- SAF-T (Standard Audit File for Tax) export

---

## 📋 Ordem de Implementação Recomendada

| Fase | # | Funcionalidade | Tipo | Esforço | Impacto |
|------|---|---------------|------|---------|---------|
| **Fase 1** | 1 | Shipping/Logística | FÍSICA | Alto | 🔴 Sem isto não há loja física funcional |
| **Fase 1** | 3 | Facturas/Recibos Fiscais | FÍSICA | Médio | 🔴 Obrigatório legal em MZ |
| **Fase 1** | 5 | Proteção de Ficheiros | DIGITAL | Médio | 🔴 Produtos digitais sem segurança |
| **Fase 2** | 4 | Chat Comprador↔Vendedor | AMBAS | Alto | 🔴 Essencial para confiança |
| **Fase 2** | 2 | Gestão de Inventário | FÍSICA | Médio | 🔴 Operação de loja |
| **Fase 3** | 6 | Carrinho Abandonado | AMBAS | Baixo | 🟠 ROI directo (conversão) |
| **Fase 3** | 8 | Bundles/Kits | AMBAS | Médio | 🟠 Aumenta ticket médio |
| **Fase 3** | 11 | Variações Visuais | FÍSICA | Baixo | 🟠 UX de selecção |
| **Fase 4** | 7 | Recomendações | AMBAS | Médio | 🟠 Cross-sell |
| **Fase 4** | 9 | Assinaturas | DIGITAL | Alto | 🟠 Receita recorrente |
| **Fase 4** | 10 | PWA | AMBAS | Médio | 🟠 Experiência mobile |
| **Fase 5** | 12-20 | Fidelidade, Guest, Comparação, Feed, Patrocinado, i18n, WCAG, Analytics, Bulk | AMBAS | Baixo-Médio | 🟡 Maturidade |
| **Fase 6** | 21-23 | GTIN, Open APIs, SAF-T | AMBAS | Médio | 🔵 Enterprise/Compliance |

---

## 🎯 Resumo — Top 5 Críticos

| # | Funcionalidade | Porquê |
|---|---------------|--------|
| 1 | **Shipping** | Não podes vender produtos físicos sem calcular/envios. É a alma do e-commerce físico. |
| 2 | **Facturação fiscal** | Moçambique exige facturação electrónica. Sem isto, lojas não operam legalmente. |
| 3 | **Chat comprador↔vendedor** | Marketplace sem comunicação = zero confiança. Etsy, OLX, Marketplace do FB todos têm. |
| 4 | **Protecção de ficheiros digitais** | Neste momento qualquer pessoa com o URL pode baixar o ficheiro. É urgente. |
| 5 | **Carrinho abandonado** | ~70% dos carrinhos são abandonados. Recuperar 10% = +7% receita sem adquirir novo tráfego. |
