# 📋 Comparação: Formulário de Produto Físico vs Digital

> Análise comparativa do formulário de criação de produtos para lojas físicas vs lojas digitais.
> Baseado no ficheiro `frontend/app/seller/products/new/page.tsx`

---

## 1. COMPARAÇÃO DOS FORMULÁRIOS

### Passo 1 — Essencial (comum aos dois)

| Campo | Físico | Digital | Observação |
|-------|:------:|:-------:|-----------|
| Nome do Produto | ✅ | ✅ | Igual |
| Descrição Curta | ✅ | ✅ | Igual |
| Preço (MZN) | ✅ | ✅ | Igual |
| Preço Original (compare) | ✅ | ✅ | Igual |
| Categoria | ✅ | ✅ | Categorias filtradas por tipo de loja |
| Imagem Principal | ✅ | ✅ | Igual |
| Descrição Completa | ✅ | ✅ | Igual |

### Passo 2 — Detalhes (DIFERENTE por tipo)

#### 🟦 Produto Físico (13 campos)
| Campo | Descrição |
|-------|-----------|
| SKU | Código de stock |
| Código de Barras | GTIN, EAN, UPC |
| Marca | Fabricante |
| Condição | Novo / Usado / Recondicionado |
| Peso (kg) | Para cálculo de frete |
| Altura (cm) | Dimensões para frete |
| Largura (cm) | Dimensões para frete |
| Comprimento (cm) | Dimensões para frete |
| Stock | Quantidade disponível |
| Qtd. Mínima | Por encomenda |
| Garantia (dias) | 0 = sem garantia |
| Comissão Afiliados (%) | % para afiliados |
| Backorder | Permitir venda sem stock |
| **Variantes** | Cor, Tamanho, SKU, preço, stock, imagem por variante |

#### 🟩 Produto Digital (2 campos — MUITO simplificado)
| Campo | Descrição |
|-------|-----------|
| Ficheiro | Upload do ficheiro digital (PDF, ZIP, etc.) |
| Stock | Fixo em 999 (automático) |

> ⚠️ **Problema:** O formulário de produto digital está extremamente vazio no Passo 2. Faltam campos essenciais.

---

## 2. CAMPOS EM FALTA NO FORMULÁRIO DE PRODUTO DIGITAL

### 🔴 Alta Prioridade — Essenciais para vender produtos digitais

| # | Campo | Justificação |
|---|-------|-------------|
| 1 | **Formato/Tipo de ficheiro** | Informar o comprador: PDF, ZIP, MP3, MP4, etc. |
| 2 | **Tamanho do ficheiro** | Mostrar MB/GB antes da compra |
| 3 | **Versão do produto** | Ex: "v2.1", "2026 Edition" |
| 4 | **Licença** | Pessoal, Comercial, Extended — afecta o preço |
| 5 | **Limite de downloads** | Campo `download_limit` já existe no modelo mas não no form (default: 3) |
| 6 | **Expiração do link** | Campo `download_expiry_days` já existe no modelo mas não no form (default: 365) |
| 7 | **Pré-visualização** | Screenshots, demo, ou amostra do produto digital |
| 8 | **Compatibilidade** | SO, software necessário (ex: "Requer Windows 10+, Photoshop CC") |

### 🟡 Média Prioridade — Diferenciação e Confiança

| # | Campo | Justificação |
|---|-------|-------------|
| 9 | **Política de reembolso específica** | Produtos digitais geralmente não têm devolução |
| 10 | **Actualizações incluídas** | Se comprador recebe versões futuras gratuitas |
| 11 | **Suporte incluído** | Email, chat, documentação — quanto tempo |
| 12 | **Uso comercial permitido** | Se pode ser revendido ou usado em trabalhos de cliente |

### 🟢 Baixa Prioridade — Futuro

| # | Campo | Justificação |
|---|-------|-------------|
| 13 | **Watermark** | Marca d'água automática com nome/email do comprador |
| 14 | **Chave de licença** | Geração automática de serial key |
| 15 | **DRM / Protecção** | Protecção anti-cópia |

---

## 3. BACKEND — O QUE JÁ EXISTE NO MODELO

O modelo `Product` já tem **todos** os campos necessários para produtos digitais:

```python
# Estes campos já existem mas NÃO estão no formulário:
digital_file = models.FileField(upload_to='products/digital/', blank=True)    # ✅ Upload
digital_file_size = models.CharField(max_length=50, blank=True)               # ✅ Tamanho
download_limit = models.PositiveIntegerField(default=3)                       # ✅ Limite downloads
download_expiry_days = models.PositiveIntegerField(default=365)               # ✅ Expiração
```

E o modelo `DigitalDownload` (em `models_digital.py`) rastreia downloads:
```python
class DigitalDownload(BaseModel):
    user → FK User
    product → FK Product
    order → FK Order
    download_count → int
    expires_at → datetime
```

---

## 4. ADAPTAÇÕES NECESSÁRIAS NAS OUTRAS PÁGINAS DA LOJA DIGITAL

Com base no `product_type` da loja, várias páginas do seller precisam ser adaptadas:

### 4.1 Dashboard do Vendedor (`/seller/dashboard`)

| Elemento | Loja Física | Loja Digital |
|----------|------------|-------------|
| Métricas principais | Vendas, receita, stock baixo | Vendas, receita, downloads |
| Alertas | "Stock baixo" (≤ threshold) | "Link expirado", "Downloads esgotados" |
| Gráficos | Vendas por período | Downloads por período |
| Top produtos | Por vendas | Por downloads |
| Acções rápidas | "Adicionar stock" | "Renovar links", "Upload nova versão" |

### 4.2 Lista de Produtos (`/seller/products`)

| Elemento | Loja Física | Loja Digital |
|----------|------------|-------------|
| Colunas da tabela | Nome, Preço, Stock, SKU, Vendas | Nome, Preço, Downloads, Licença, Vendas |
| Status badges | "Stock baixo", "Esgotado" | "Link activo", "Link expirado" |
| Filtros | Por stock, categoria | Por licença, formato |
| Acções em massa | "Ajustar stock" | "Renovar links" |

### 4.3 Página de Produto Individual (editar)

| Secção | Loja Física | Loja Digital |
|--------|------------|-------------|
| Inventário | Stock, peso, dimensões | Ficheiro, tamanho, versão |
| Variantes | Cor, tamanho (físico) | Licença (pessoal/comercial) |
| Métricas | Unidades vendidas | Downloads efectuados |

### 4.4 Definições da Loja (`/seller/settings`)

| Elemento | Loja Física | Loja Digital |
|----------|------------|-------------|
| Políticas padrão | Envio, devolução | Reembolso, licença |
| Templates de email | Envio, tracking, entrega | Link download, expiração |

### 4.5 Página Pública da Loja (`/store/[slug]`)

| Elemento | Loja Física | Loja Digital |
|----------|------------|-------------|
| Badge no header | "Envios para todo Moçambique" | "Download imediato" |
| Informação extra | Política de envio | Tipos de ficheiro, licenças |
| Filtros laterais | Por tamanho, cor | Por formato, licença |

---

## 5. PLANO DE ACÇÃO RECOMENDADO

### Fase 1 — Corrigir Formulário de Produto Digital (agora)
1. Adicionar os 8 campos de alta prioridade ao Passo 2 do formulário
2. Mapear campos do formulário para o modelo `Product` (já existem)
3. Calcular `digital_file_size` automaticamente no backend após upload

### Fase 2 — Adaptar Seller Dashboard e Listas
4. Dashboard condicional por `product_type`
5. Tabela de produtos condicional
6. Filtros adaptados

### Fase 3 — Páginas Públicas e Definições
7. Badges e informações condicionais na página pública da loja
8. Templates de email transacional por tipo de loja

---

## 6. RESUMO DO FORMULÁRIO — PRODUTO DIGITAL (PROPOSTA)

### Passo 1 — Essencial (igual ao físico)
- Nome, preço, categoria, descrição, imagem principal

### Passo 2 — Ficheiro e Licenciamento (NOVO)
- Upload do ficheiro (já existe)
- Tamanho do ficheiro (auto-calculado)
- Formato/Tipo (select: PDF, ZIP, MP3, MP4, Outro)
- Versão (texto)
- Licença (select: Pessoal, Comercial, Extended)
- Limite de downloads (número, default: 3)
- Expiração do link (dias, default: 365)
- Compatibilidade (texto)

### Passo 3 — Media e Pré-visualização (adaptado)
- Screenshots/Preview (upload múltiplo)
- Vídeo demo (YouTube/Vimeo URL)
- Especificações técnicas (JSON, como no físico)

### Passo 4 — Publicar (igual)
- Status, featured, on sale, SEO

---

*Data: 30 de Julho de 2026*
