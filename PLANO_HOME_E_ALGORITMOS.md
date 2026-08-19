# Plano — Home, Curadoria e Algoritmos Internos

> Documento de planeamento das implementações a fazer na **home** e das restantes
> melhorias que podem ser feitas **já**, pensando na escala (centenas/milhares de
> lojas e utilizadores).
>
> Princípio orientador: **regras + scoring determinístico primeiro, ML depois**,
> com **dados instrumentados desde o início**.

---

## 1. Estado atual (já implementado)

- ✅ Carrosséis horizontais nas secções de produtos.
- ✅ Secções "Lojas em Destaque", "Mais Vendidos", "Novidades" e "Destaques".
- ✅ Categorias: só raiz + ativas + com imagem, ordenadas por nº de produtos, tira horizontal no mobile.
- ✅ Filtros/paginação no servidor (categoria), reutilização do `ProductCard` (loja), subcategorias + breadcrumb.
- ✅ Barra de pesquisa com autocomplete, recentes, navegação por teclado.
- ✅ Cache Redis (categorias/produtos/lojas) + fallback locmem em dev.
- ✅ Índices de BD (`sales_count`, `rating`, compostos `is_on_sale/is_featured`).
- ✅ Fetches da home independentes, com log de erro específico.

---

## 2. Implementações na Home

### 2.1 Definição correta das 4 secções

| Secção | Critério **atual** (a corrigir) | Critério **alvo** | Ordenação | Cap |
|---|---|---|---|---|
| 🔥 Ofertas do Dia | `is_on_sale=true` | Desconto **real ≥ 10%** (+ `sale_ends_at` para countdown no futuro) | Maior desconto | 20 |
| 🏆 Mais Vendidos | `sales_count` total (histórico) | Vendas nos **últimos 30 dias** (via `OrderItem`) | Vendas recentes | 20 |
| ✨ Novidades | `-created_at` | `status=active` + em stock primeiro | `-created_at` | 20 |
| ⭐ Destaques | `is_featured=true` (flag do vendedor) | **Score composto** (curadoria da plataforma) | Score | 20 |

**Fallback em cadeia** (nunca mostrar secção vazia):
- Destaques ← Mais Vendidos ← Novidades.
- Ofertas: se insuficientes, **esconder** a secção (não mostrar oferta falsa).

**Sem duplicação**: um produto aparece no máximo em 1–2 secções.

### 2.2 O problema do "Destaque" do vendedor (escala)

- A flag do vendedor **deixa de dar colocação na home** — passa a significar
  **"destacar na minha loja"** (topo da página da loja).
- A home tem **vagas fixas** preenchidas por **score + rotação + cap por loja**.

**Score composto (Destaques):**
```
score = 0.35·vendas_recentes + 0.30·rating + 0.15·qualidade_da_loja
      + 0.10·recência + 0.05·nº_reviews + 0.05·desconto
```

**Regras de escala:**
- Máx. **2–3 produtos por loja** por secção (uma loja gigante não monopoliza).
- **Rotação** diária/semanal para dar exposição a lojas diferentes.
- Lojas **verificadas** e bem avaliadas têm prioridade.
- (Futuro) **slots patrocinados** — o vendedor paga para aparecer (auto-limita e gera receita).

### 2.3 Estrutura para escala

1. **Secções sempre limitadas + "Ver todos"** → listagens completas com filtros.
2. **Listas pré-computadas** (Celery beat, de hora em hora) em cache/Redis.
3. **Dedup** entre secções.
4. **Caps por loja**.
5. **Fallbacks** em cadeia.

---

## 3. Outras implementações que podem ser feitas **agora**

### 3.1 Camada de scoring central (essencial)
- Criar um módulo único (`scoring.py`) com a função de score reutilizável,
  em vez de lógica espalhada nas views.
- Recebe produto + sinais (vendas recentes, rating, loja, recência) e devolve o score.

### 3.2 Registo de eventos (investimento estruturante)
- Modelo de eventos (ou tabelas simples): **visualização de produto**, **clique**,
  **pesquisa**, **compra**.
- Sem eventos, não há como evoluir para recomendações/personalização depois.
- Começar com **visualizações + pesquisas** (mais baratos e mais úteis).

### 3.3 Agregação agendada (Celery)
- Tarefa que recomputa as 4 listas da home e as guarda em cache.
- Endpoint único `/products/home-sections/` que devolve as listas prontas.

### 3.4 Índices de BD adicionais
- `OrderItem.created_at` (para a janela de vendas de 30 dias).
- (Opcional) índice composto em eventos (`user`, `created_at`).

### 3.5 Recomendações simples (Nível 1, já possível)
- "Produtos relacionados" **por categoria + score** (em vez de só mesma categoria).
- "Quem comprou X também comprou Y" (item-to-item) — quando houver volume de encomendas.

### 3.6 Outras quick wins
- **Badge "Mais vendido" / "Novo" / "Oferta"** consistente nos cards (já parcial).
- **Countdown** nas Ofertas do Dia (quando houver `sale_ends_at`).
- **Moderação de avaliações** (deteção de spam/repetidas).

---

## 4. Fases de implementação (priorizadas)

### Fase 1 — Modelo de dados (backbone)
- `Product`: `sale_ends_at`, `featured_score`, `is_sponsored` + `sponsor_expires_at`.
- (Opcional) tabela `CuratedSlot` para vagas da home.
- Modelo de eventos (visualização/pesquisa) ou tabela de contadores.
- Índices (`OrderItem.created_at`, eventos).

### Fase 2 — Lógica de curadoria (backend)
- Módulo `scoring.py` (score composto).
- Tarefa Celery de recomputação das 4 secções + cache.
- Endpoint `/products/home-sections/`.
- Renomear a flag do vendedor para "destaque na loja".

### Fase 3 — Frontend
- Home consome o endpoint curado (uma chamada), com fallbacks.
- Secções refletem os títulos (countdown, badges, dedup).

### Fase 4 — Monetização (opcional, depois)
- Slots patrocinados / leilão para Destaques.

---

## 5. Regras de negócio por secção (resumo para implementação)

| Secção | Filtros obrigatórios | Ordenação | Cap | Fallback |
|---|---|---|---|---|
| Ofertas do Dia | `is_on_sale` + desconto ≥ 10% | `-desconto` | 20 | esconder |
| Mais Vendidos | vendas 30 dias > 0 | `-vendas_30d` | 20 | `-sales_count` total |
| Novidades | `status=active` | `-created_at` (stock primeiro) | 20 | — |
| Destaques | score > limiar | `-score` | 20 (máx 3/loja) | Mais Vendidos |

---

## 6. Decisões a confirmar antes de implementar

1. **Limiar de desconto** para "Ofertas do Dia" (proposta: ≥ 10%).
2. **Janela de "Mais Vendidos"** (proposta: 30 dias).
3. **Pesos do score** de Destaques (proposta acima — ajustável).
4. **Rotação dos Destaques** (proposta: diária).
5. **Cap por loja** por secção (proposta: 3 nos Destaques, 2 nas restantes).
6. **Monetização** de Destaques agora ou depois (proposta: depois).
