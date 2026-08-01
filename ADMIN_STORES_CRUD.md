# 🛡️ Admin > Gestão de Lojas — Especificação CRUD

> Data: 31 de Julho de 2026
> Aba: `?tab=stores` no painel de administração

---

## 1. Lista de Lojas (VISÃO GERAL)

| # | Coluna | Descrição | Estado |
|---|--------|-----------|:---:|
| 1 | **Logo + Nome** | Logo da loja (thumbnail 40×40) + nome clickable para detalhe | 🟡 sem link |
| 2 | **Tipo** | `physical` / `digital` / `course` com badge colorido | ❌ ausente |
| 3 | **Dono** | Nome + email do `owner` | ❌ só email |
| 4 | **Produtos** | `total_products` | ✅ |
| 5 | **Vendas** | `total_sales` + receita total | ❌ só produtos |
| 6 | **Avaliação** | `rating` (⭐ 4.2) | ❌ ausente |
| 7 | **Data registo** | `created_at` formatado (dd/mm/aaaa) | ❌ ausente |
| 8 | **Estado** | Badge colorido: Pendente 🟡 / Activo 🟢 / Suspenso 🟠 / Rejeitado 🔴 | ✅ |
| 9 | **Documentos** | Indicador se tem documentos de verificação enviados | ❌ não existe |
| 10 | **Acções** | Aprovar / Rejeitar / Suspender / Reactivar / Editar / Eliminar | 🟡 parcial |

### Filtros e busca necessários:
- 🔍 Busca por nome da loja
- 📌 Filtrar por `status` (pending, active, suspended, rejected)
- 🏷️ Filtrar por `product_type` (physical, digital, course)
- 📅 Ordenar por data de registo, vendas, avaliação

---

## 2. Painel de Detalhe da Loja (ao clicar na linha)

O admin deve ver **TODOS** os dados que o vendedor preencheu no registo, mais métricas operacionais.

### 2.1 📌 Dados de Identificação

| Campo | Modelo | Descrição |
|-------|--------|-----------|
| `name` | `Store.name` | Nome da loja |
| `slug` | `Store.slug` | URL amigável |
| `tagline` | `Store.tagline` | Slogan curto |
| `description` | `Store.description` | Descrição da loja |
| `about` | `Store.about` | Sobre a loja (texto longo) |

### 2.2 👤 Dados do Dono (read-only)

| Campo | Modelo | Descrição |
|-------|--------|-----------|
| `owner.name` | `User.get_full_name()` | Nome completo |
| `owner.email` | `User.email` | Email |
| `owner.phone` | `UserProfile.phone` | Telefone |
| `owner.is_verified` | `User.is_verified` | Email verificado? |
| `owner.date_joined` | `User.date_joined` | Data de registo na plataforma |

### 2.3 🖼️ Media

| Campo | Modelo | Descrição |
|-------|--------|-----------|
| `logo` | `Store.logo` | Logo da loja (pré-visualização full-size) |
| `banner` | `Store.banner` | Banner da loja (pré-visualização) |
| `theme_color` | `Store.theme_color` | Cor do tema (hex) |

### 2.4 ⚙️ Configuração

| Campo | Modelo | Descrição |
|-------|--------|-----------|
| `product_type` | `Store.product_type` | Tipo de produtos (physical/digital/course) — **read-only** |
| `category` | `Store.category` | Categoria principal |
| `default_affiliate_commission` | `Store.default_affiliate_commission` | Comissão de afiliados (%) |
| `low_stock_threshold` | `Store.low_stock_threshold` | Alerta de stock baixo |

### 2.5 📞 Contacto & Localização

| Campo | Modelo | Descrição |
|-------|--------|-----------|
| `phone` | `Store.phone` | Telefone de contacto |
| `email` | `Store.email` | Email de contacto da loja |
| `location` | `Store.location` | Localização |
| `website` | `Store.website` | Website externo |

### 2.6 📜 Políticas

| Campo | Modelo | Descrição |
|-------|--------|-----------|
| `shipping_policy` | `Store.shipping_policy` | Política de envio |
| `return_policy` | `Store.return_policy` | Política de devolução |

### 2.7 📊 Métricas Operacionais (read-only)

| Campo | Origem | Descrição |
|-------|--------|-----------|
| `status` | `Store.status` | Estado actual |
| `rating` | `Store.rating` | Avaliação média |
| `total_sales` | `Store.total_sales` | Total de vendas |
| `total_products` | `Store.total_products` | Produtos activos |
| `created_at` | `Store.created_at` | Data de criação da loja |
| Nº encomendas | `store.orders.count()` | Total de encomendas |
| Receita total | `SUM(orders.total)` | Somatório de receita |

### 2.8 ⚠️ Documentos de Verificação (NOVO — a adicionar ao modelo)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `identity_document` | `ImageField` / `FileField` | Documento de identidade (BI/passaporte) |
| `tax_document` | `ImageField` / `FileField` | Comprovativo fiscal (NUIT/licença) |
| `address_proof` | `ImageField` / `FileField` | Comprovativo de morada |
| `additional_documents` | `FileField` (multiple) | Outros docs (contrato social, etc.) |

---

## 3. O que o Admin pode EDITAR

| Campo | Editável? | Notas |
|-------|:---:|-------|
| `name` | ✅ | Renomear loja |
| `slug` | ✅ | Mudar URL |
| `description` | ✅ | |
| `about` | ✅ | |
| `tagline` | ✅ | |
| `logo` | ✅ | Substituir imagem |
| `banner` | ✅ | Substituir imagem |
| `theme_color` | ✅ | |
| `category` | ✅ | |
| `product_type` | ❌ | **Imutável** — quebraria a lógica de negócio |
| `phone` | ✅ | |
| `email` | ✅ | |
| `location` | ✅ | |
| `website` | ✅ | |
| `shipping_policy` | ✅ | |
| `return_policy` | ✅ | |
| `default_affiliate_commission` | ✅ | |
| `low_stock_threshold` | ✅ | |
| `status` | ✅ | Via botões de acção (aprovar/rejeitar/suspender/reactivar) |
| `owner` | ❌ | Transferir dono requer ferramenta separada |
| Documentos | ✅ | Remover docs inválidos; upload de substituição |

---

## 4. O que o Admin pode ELIMINAR

| Item | Pode? | Notas |
|------|:---:|-------|
| Loja inteira | ✅ | Com modal de confirmação + notificação email ao dono |
| Produtos individuais | ✅ | Dentro da visão de produtos da loja |
| Imagens/banners | ✅ | Reset para placeholder default |
| Documentos de verificação | ✅ | Remover docs inválidos |

---

## 5. O que o Admin NÃO deve poder fazer

| Acção | Razão |
|-------|-------|
| Alterar `product_type` | Quebraria cursos/produtos digitais existentes |
| Criar loja manualmente | O fluxo é: vendedor regista → admin aprova |
| Alterar `owner` | Implicações legais — precisa de ferramenta dedicada |
| Ver passwords | Nunca |
| Alterar `rating` manualmente | Deve ser calculado pelas reviews |
| Criar produtos em nome da loja | Responsabilidade do vendedor |
| Ver mensagens privadas loja-cliente | Privacidade (excepção: disputa/arbitragem) |

---

## 6. Secções Adicionais no Painel de Detalhe

| Secção | Descrição |
|--------|-----------|
| **📦 Produtos da Loja** | Tabela paginada com todos os produtos (nome, preço, stock, status) com links para editar cada um via API admin |
| **🛒 Últimas Encomendas** | Últimas 10 encomendas da loja com estado e valor |
| **📈 Gráfico de Vendas** | Mini gráfico de vendas mensais dos últimos 6 meses (bar chart simples) |
| **📝 Histórico de Moderação** | Log: quem aprovou/rejeitou/suspendeu, quando, e notas |
| **💬 Notas Admin** | Campo `admin_notes` (TextField, visível só para admins) |

---

## 7. Workflow de Aprovação

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐
│ Vendedor │───>│ Loja pending │───>│ Admin revê   │
│ regista  │    │ (fila)       │    │ detalhes     │
└──────────┘    └──────────────┘    └──────┬───────┘
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                    ┌──────────┐    ┌──────────┐    ┌──────────┐
                    │ Aprovar  │    │ Rejeitar │    │ Pedir    │
                    │ → active │    │→ rejected│    │ + docs   │
                    │ + email  │    │ + motivo │    │          │
                    └──────────┘    └──────────┘    └──────────┘
```

- **Aprovar**: muda status → `active`, envia email de boas-vindas
- **Rejeitar**: muda status → `rejected`, pede motivo (textarea), envia email com razão
- **Suspender**: muda status → `suspended`, envia email de aviso
- **Reactivar**: muda status → `active`, envia email

---

## 8. Gaps Críticos (o que falta implementar)

| # | Gap | Impacto |
|---|-----|:---:|
| 1 | **Painel de detalhe** — Hoje só há tabela rasa. Modal de edição mostra apenas 6 campos. | 🔴 Alto |
| 2 | **Documentos de verificação** — Modelo `Store` não tem campos para documentos. Admin não consegue verificar identidade do vendedor. | 🔴 Alto |
| 3 | **Produtos da loja** — Admin não vê nem gere produtos de uma loja específica na aba stores. | 🟡 Médio |
| 4 | **Histórico de moderação** — Não há registo de quem fez cada acção administrativa. | 🟡 Médio |
| 5 | **Filtros e busca** — Tabela de lojas sem filtro por status, tipo, ou busca. | 🟡 Médio |
| 6 | **Notas admin** — Sem campo para notas internas sobre a loja. | 🟢 Baixo |
| 7 | **Motivo de rejeição** — Ao rejeitar, não há campo para o admin explicar o motivo. | 🟡 Médio |

---

## 9. Plano de Implementação (por prioridade)

### Fase 1 — Painel de Detalhe (2-3h)
- [ ] Criar componente `StoreDetailPanel` com todas as secções acima
- [ ] Backend: endpoint `GET /admin/stores/:id/` com todos os dados (incluindo owner, métricas)
- [ ] Backend: endpoint `PATCH /admin/stores/:id/` para edição completa
- [ ] Frontend: modal/página de detalhe com tabs (Info, Produtos, Encomendas, Documentos)

### Fase 2 — Documentos de Verificação (1-2h)
- [ ] Adicionar campos ao modelo `Store`: `identity_document`, `tax_document`, `address_proof`
- [ ] Migração
- [ ] Actualizar `StoreDetailSerializer`
- [ ] Frontend: upload no registo do vendedor + pré-visualização no admin

### Fase 3 — Qualidade de Vida (1-2h)
- [ ] Filtros e busca na tabela de lojas
- [ ] Campo `admin_notes` no modelo
- [ ] Motivo de rejeição (modal com textarea)
- [ ] Histórico de moderação (modelo `StoreModerationLog`)

---

*Julho 2026*
