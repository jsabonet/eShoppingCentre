# Plano — Afiliação por Produto (controlo do vendedor + regras globais)

> Data: 2026-08-13
> Âmbito: permitir que **todos os vendedores e todos os tipos de loja** (física, digital, cursos)
> definam **quais produtos** e **que percentagens** de afiliação estão disponíveis, bem como
> o **tempo (janela de cookie)** e **termos adicionais** por produto. As **regras e termos
> globais** do programa continuam a ser definidos **apenas pelo e-commerce (admin)**.

---

## 1. Objectivo

Padrão internacional (tipo Amazon Associates / Shopify Collabs / AliExpress Portal):
- Cada produto tem um **interruptor de afiliação** (`on/off`), uma **percentagem própria**
  e opcionalmente **janela de cookie** e **termos** específicos.
- Na **página de detalhe do produto**, produtos com afiliação habilitada exibem um
  **botão "Área de Afiliação"** que abre um painel com a comissão, o tempo do cookie,
  os termos e o botão "Promover" (gera o link do afiliado).
- O **admin** define as regras globais: percentagens mínima/máxima, estado geral do
  programa e termos de serviço.

---

## 2. Estado actual (o que já existe)

| Recurso | Estado |
|---|---|
| `Product.affiliate_commission` (percentagem por produto) | ✅ existe (default 10.00) |
| `Store.default_affiliate_commission` (padrão da loja) | ✅ existe (editável em Definições do vendedor) |
| Campo "Comissão Afiliados (%)" no formulário de produto | ✅ existe (new/edit) |
| `AffiliateSettings` global (cookie, comissão default, mínimo de saque, clawback, fee) | ✅ existe |
| Tracking de clique `/r/{code}/` + cookie `ref` | ✅ existe |
| Comissão na criação da encomenda (anti auto-referência, bloqueio dono de loja, tier) | ✅ existe |
| **Interruptor de afiliação por produto (`affiliate_enabled`)** | ❌ **em falta** |
| **Janela de cookie por produto (`affiliate_cookie_days`)** | ❌ **em falta** |
| **Termos por produto (`affiliate_terms`)** | ❌ **em falta** |
| **Regras globais: min/max %, master switch, termos globais** | ❌ **em falta** |
| **Botão "Área de Afiliação" na página de produto** | ❌ **em falta** |
| Filtro "só produtos afiliáveis" na área do afiliado | ❌ **em falta** |

---

## 3. Regras de negócio

### 3.1 Globais (admin — e-commerce)
- `affiliate_program_active`: interruptor geral do programa (se OFF, nada é afiliável).
- `min_commission_rate` (ex. 1%) e `max_commission_rate` (ex. 50%): limites que o
  vendedor **não pode ultrapassar** ao definir a % do produto.
- `cookie_window_days`: janela de atribuição por defeito (já existe).
- `terms_of_service`: termos globais exibidos na "Área de Afiliação" e na área do afiliado.

### 3.2 Por produto (vendedor)
- `affiliate_enabled`: só quando `true` o produto aparece na área do afiliado e gera comissão.
- `affiliate_commission`: % do produto, validada entre `[min_commission_rate, max_commission_rate]`.
  (Se o vendedor deixar vazio → usar `Store.default_affiliate_commission` → senão o global.)
- `affiliate_cookie_days` (opcional): se definido, substitui a janela global **para este produto**.
- `affiliate_terms` (opcional): termos adicionais do vendedor (ex. "não acumulável com cupões").

### 3.3 Precedência da comissão
1. `product.affiliate_commission` (se definido e dentro dos limites)
2. `store.default_affiliate_commission`
3. `AffiliateSettings.default_commission_rate`

> A percentagem é sempre **limitada** ao intervalo global `[min, max]` (regra do e-commerce).

### 3.4 Precedência da janela de cookie
1. `product.affiliate_cookie_days` (se definido)
2. `AffiliateSettings.cookie_window_days`

---

## 4. Alterações Backend

### 4.1 `backend/apps/products/models.py`
Adicionar ao `Product`:
```python
affiliate_enabled = models.BooleanField(default=True,
    help_text='Produto disponível para o programa de afiliados')
affiliate_cookie_days = models.PositiveIntegerField(null=True, blank=True,
    help_text='Janela de cookie específica (dias). Vazio = usa a global.')
affiliate_terms = models.TextField(blank=True,
    help_text='Termos adicionais de afiliação definidos pelo vendedor')
```
> `default=True` preserva o comportamento actual (produtos já existentes continuam afiliáveis).
> O vendedor passa a poder desligar produto a produto.

### 4.2 `backend/apps/affiliates/models.py`
Adicionar a `AffiliateSettings`:
```python
affiliate_program_active = models.BooleanField(default=True)
min_commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
max_commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=50.00)
terms_of_service = models.TextField(blank=True)
```

### 4.3 `backend/apps/products/filters.py`
Adicionar filtro para a área do afiliado:
```python
affiliate_enabled = django_filters.BooleanFilter()
# e incluir 'affiliate_enabled' em Meta.fields
```
→ `GET /products/?affiliate_enabled=true` devolve só produtos afiliáveis.

### 4.4 `backend/apps/products/serializers.py`
- `ProductDetailSerializer` usa `fields='__all__'` → os novos campos já ficam expostos.
- Adicionar validação em `validate_affiliate_commission`:
  - ler `AffiliateSettings.get_settings()`;
  - se `affiliate_commission < min` ou `> max` → erro de validação;
  - se vazio → usar o default da loja (no `perform_create`).
- `ProductListSerializer`: adicionar `affiliate_enabled` (e `affiliate_cookie_days`) para
  a listagem do afiliado poder mostrar o estado/comissão.
- `SellerProductSerializer`: adicionar `affiliate_enabled`, `affiliate_cookie_days`,
  `affiliate_terms` (gestão do vendedor).

### 4.5 `backend/apps/affiliates/serializers.py`
- `AffiliateSettingsSerializer`: adicionar `affiliate_program_active`, `min_commission_rate`,
  `max_commission_rate`, `terms_of_service`.

### 4.6 `backend/apps/affiliates/views.py`
- `affiliate_click` (`/r/{code}/`):
  - se `not link.product.affiliate_enabled` ou `not AffiliateSettings.get_settings().affiliate_program_active`
    → redireccionar para o produto **sem** definir cookie (e sem contar clique).
  - `max_age` do cookie = `product.affiliate_cookie_days` (se definido) senão `settings.cookie_window_days`.
- `CreateAffiliateLinkView`:
  - rejeitar (400) se o produto não estiver `affiliate_enabled` ou o programa global estiver OFF.

### 4.7 `backend/apps/orders/serializers.py` (cálculo de comissão)
Dentro do bloco de atribuição (onde hoje lê `affiliate_code`):
- Guard `affiliate_program_active` global — se OFF, `affiliate = None`.
- No loop dos itens, **saltar produtos com `affiliate_enabled=False`** (não geram comissão).
- Se o produto do link de origem (`affiliate_link.product`) tiver afiliação desligada, não atribuir.
- Continuar a usar `product.affiliate_commission` (já validado nos limites globais).

### 4.8 Migrações
- `products`: nova migração (3 campos).
- `affiliates`: nova migração (4 campos).
- `python manage.py makemigrations products affiliates && python manage.py migrate`

---

## 5. Páginas Frontend afectadas

### 5.1 Página de detalhe do produto ⭐ (pedido principal)
- `frontend/app/product/[slug]/page.tsx`
  - mapear `affiliate_enabled`, `affiliate_commission`, `affiliate_cookie_days`, `affiliate_terms`
    para o objecto passado ao componente.
- `frontend/src/components/ProductDetailShop.tsx`
  - Adicionar **botão "Área de Afiliação"** visível apenas quando `affiliate_enabled` é `true`
    (e o programa global está activo).
  - Modal/painel com:
    - Comissão (%) do produto;
    - Janela de cookie (produto ou global);
    - Termos (globais + específicos do produto);
    - Botão **"Promover este produto"** → chama `affiliatesAPI.createLink(product.id)` →
      mostra `short_url` + botão copiar.
  - Estados: não autenticado → pedir login; autenticado sem perfil de afiliado →
    "Tornar-se afiliado" (registo); afiliado activo → gerar link.

### 5.2 Gestão de produtos do vendedor
- `frontend/app/seller/products/new/page.tsx` e `frontend/app/seller/products/[id]/edit/page.tsx`
  - Nova secção **"Afiliação"**:
    - Toggle `affiliate_enabled`;
    - Campo % (já existe, passar a validar entre min/max);
    - Campo janela de cookie (opcional, dias);
    - Textarea termos (opcional).
- `frontend/app/seller/courses/new/page.tsx` e `frontend/app/seller/courses/[id]/edit/page.tsx`
  - Mesma secção (cursos também são `Product`).
- `frontend/app/seller/products/page.tsx` (lista)
  - Badge "Afiliável" + toggle rápido por linha (PATCH do `affiliate_enabled`).

### 5.3 Área do afiliado
- `frontend/app/affiliate/products/page.tsx`
  - Passar a buscar `GET /products/?affiliate_enabled=true`.
  - Mostrar a janela de cookie e os termos no card (ou tooltip).
  - O botão "Promover" já existe (`createLink`).

### 5.4 Admin
- `frontend/src/components/admin/AdminAffiliates.tsx` (tab "Afiliados")
  - Nova secção de **Definições globais**: master switch, min %, max %, termos globais.
  - Usa `affiliatesAPI.adminSettings()` / `adminUpdateSettings()` (já existem).

### 5.5 Cliente API
- `frontend/src/lib/api.ts`
  - `Product` interface: adicionar `affiliate_enabled`, `affiliate_cookie_days`, `affiliate_terms`.
  - (Opcional) `affiliatesAPI` já tem `createLink`, `adminSettings`, `adminUpdateSettings`.

---

## 6. Ordem de implementação

1. **Backend** (modelos + migrações + serializers + filters + views + lógica de comissão).
2. **Cliente API** (`Product` interface).
3. **Vendedor**: secção "Afiliação" nos formulários new/edit (físico + curso) + lista.
4. **Página de produto**: botão "Área de Afiliação" + modal.
5. **Área do afiliado**: filtrar produtos afiliáveis + mostrar cookie/termos.
6. **Admin**: definições globais (min/max/switch/termos).
7. **Verificação**: `manage.py check`, migrações, testes de ponta a ponta.

---

## 7. Verificação / Critérios de aceitação

- [ ] Vendedor consegue ligar/desligar afiliação por produto e definir % (limitada por min/max), cookie e termos.
- [ ] Produto com `affiliate_enabled=false` **não** aparece na área do afiliado e **não** gera comissão.
- [ ] Página de produto com afiliação habilitada mostra o botão "Área de Afiliação" e gera link.
- [ ] Janela de cookie respeita produto > global.
- [ ] Admin altera min/max/termos globais e isso reflecte-se em toda a plataforma.
- [ ] Clique em link de produto desabilitado não atribui comissão.
