# Mapa do sistema de Blog — MOZ Solidária

> Documento de engenharia para entender e replicar o blog deste sistema noutro projeto. Descreve o código encontrado no repositório, não uma arquitetura idealizada. Onde o comportamento real diverge da intenção aparente, isso está assinalado em **Atenções e lacunas**.

## 1. Visão geral

O blog é uma funcionalidade distribuída por três áreas:

1. **Frontend React/TypeScript**: listagem e detalhe públicos, editor e gestão de posts no dashboard, comentários/interações, formulários de SEO e upload de imagens.
2. **API Django REST Framework**: CRUD, regras de acesso, filtros, serializers, upload, moderação e interações.
3. **Persistência/servidor web**: modelos Django, migrations, media files servidos pelo Nginx em produção, static files/admin e banco configurado via URL.

### Stack observada

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router 6, TanStack React Query, Tailwind CSS, componentes Radix/shadcn, React Quill, Axios/fetch |
| Backend | Python, Django 4.2.7, Django REST Framework 3.14, `django-filter`, Simple JWT, `python-slugify`, Pillow |
| Dados | Django ORM; PostgreSQL é o banco esperado em produção via `DATABASE_URL`; `dj-database-url` interpreta a configuração |
| Arquivos | Django `MEDIA_ROOT`/`MEDIA_URL`; Nginx serve `/media/` em produção; a interface tem provedores opcionais Cloudinary e ImgBB |
| Admin | Django Admin + dashboard administrativo próprio em React |
| SEO | Metadados client-side, Open Graph, Twitter Cards, Schema.org e páginas/sitemaps no backend/core |
| Testes | Vitest e Testing Library no frontend; o `backend/blog/tests.py` está apenas com o esqueleto padrão de `TestCase` |

Dependências e versões são declaradas em [package.json](./package.json) e [backend/requirements.txt](./backend/requirements.txt). O projeto usa idioma `pt-br`, timezone `Africa/Maputo`, paginação DRF por número de página com 20 itens e JWT com tokens de acesso/renovação (ver [backend/moz_solidaria_api/settings.py](./backend/moz_solidaria_api/settings.py)).

## 2. Organização dos arquivos

### Frontend

| Responsabilidade | Implementação |
|---|---|
| Rotas públicas e privadas | [src/App.tsx](./src/App.tsx) |
| Listagem pública | [src/pages/Blog.tsx](./src/pages/Blog.tsx) |
| Leitura do artigo | [src/pages/BlogDetailNew.tsx](./src/pages/BlogDetailNew.tsx) e [src/pages/BlogDetail.tsx](./src/pages/BlogDetail.tsx) |
| Dashboard: lista/gestão | [src/components/admin/BlogManagement.tsx](./src/components/admin/BlogManagement.tsx) |
| Criar/editar | [src/pages/CreatePost.tsx](./src/pages/CreatePost.tsx), [src/pages/EditPost.tsx](./src/pages/EditPost.tsx) |
| API client e tipos | [src/lib/api.ts](./src/lib/api.ts), [src/lib/config.ts](./src/lib/config.ts) |
| Upload alternativo | [src/lib/imageUpload.ts](./src/lib/imageUpload.ts), componente [src/components/ImageUpload.tsx](./src/components/ImageUpload.tsx) |
| SEO/head | [src/components/SEOHead.tsx](./src/components/SEOHead.tsx), [src/config/seo.ts](./src/config/seo.ts) |
| Comentários e reações | [src/components/Comments.tsx](./src/components/Comments.tsx), [src/components/SocialInteractions.tsx](./src/components/SocialInteractions.tsx) |
| Editor e campos auxiliares | `RichTextEditorAsync`, `SEOForm`, `HashtagManager`, `PostKeywords`, `PostHashtags` em `src/components/` |
| Proteção de rota | `ProtectedRoute` e `use-auth` em `src/components/` e `src/hooks/` |

### Backend

O app isolado do blog fica em [backend/blog/](./backend/blog/):

- `models.py`: entidades e regras no save.
- `serializers.py`: contratos de entrada/saída e processamento de imagem por URL.
- `views.py`: API pública, CRUD e interações.
- `admin_views.py`: moderação e estatísticas para API administrativa.
- `admin.py`: integração com o Django Admin.
- `filters.py`: filtros query-string.
- `permissions.py`: regras de escrita.
- `seo_utils.py`, `templates/`, `templatetags/`: análise e renderização auxiliares de SEO.
- `urls.py`: rotas do app.
- `migrations/`: evolução do esquema.

As rotas são montadas sob `/api/v1/blog/` por [backend/moz_solidaria_api/urls.py](./backend/moz_solidaria_api/urls.py). O admin Django está em `/admin/`.

## 3. Dados e regras de domínio

### 3.1 Post (`BlogPost`)

Campos principais:

- Conteúdo: `title` (até 200), `slug` (único), `excerpt` (até 500), `content`.
- Relações: `author` obrigatório para `User` (cascade), `category` opcional (SET_NULL), `tags` many-to-many.
- Mídia principal: `featured_image`, legenda, crédito e URL da fonte; imagem OG opcional.
- Estado: `draft`, `published`, `archived`; `is_featured`; `created_at`, `updated_at`, `published_at`.
- Métricas: `views_count`, `read_time`, `seo_score`, `readability_score`.
- SEO: meta title/description/keywords, canonical, focus keyword, Open Graph, Twitter card, tipo Schema.org, `noindex`, `nofollow`, `robots_txt` e hashtags.

Comportamentos no `save()`:

- Gera slug a partir do título quando não foi fornecido e acrescenta sufixo numérico para evitar colisões.
- Extrai hashtags `#palavra` do conteúdo e combina com as hashtags digitadas; normaliza hashtags digitadas para minúsculas e hífens.
- Preenche automaticamente title/description OG e Twitter e meta title/description quando estes estão vazios.
- Calcula leitura como `max(1, número_de_palavras // 200)` minutos.
- Calcula `seo_score` e `readability_score`; score de legibilidade é uma aproximação simples da fórmula Flesch.
- Redimensiona imagem destacada para no máximo 1200×800 e imagem OG para exatamente 1200×630. Erros de redimensionamento são impressos/logados, mas não bloqueiam o save.
- `increment_views()` incrementa e salva usando `update_fields`, evitando processamento de imagem nesse caminho.

Há índices para `(status, published_at)`, slug e categoria, e ordenação padrão por criação descendente. A análise SEO considera título ideal de 50–60 caracteres, descrição 150–160, keyword, conteúdo de pelo menos 300 palavras, imagens, categoria e tags. Os métodos e campos estão em [backend/blog/models.py](./backend/blog/models.py).

### 3.2 Outras entidades

| Modelo | Dados/regra |
|---|---|
| `Category` | nome e slug únicos, descrição, timestamp. Gera slug pelo nome. A exclusão é impedida se houver posts associados; API também responde 400 nesses casos. |
| `Tag` | nome/slug únicos e timestamp; no serializer a contagem considera posts publicados. |
| `Comment` | post, usuário opcional, nome/email, texto, aprovação, parent opcional para resposta e timestamps. Começa pendente (`is_approved=False`). |
| `Like` | relação post+usuário única; uma curtida por usuário/post. |
| `Share` | post, usuário opcional, tipo (Facebook, Twitter, LinkedIn, WhatsApp, email, copiar link/outro), IP, user-agent e data. |
| `Newsletter` | email único, nome opcional, ativo e data de inscrição. Reinscrição de email ativo é validada pelo serializer. |
| `ImageCredit` | ligação ao post e metadados de crédito, fonte, fotógrafo, licença, texto alternativo e URL/nome da imagem. |

Posts, likes, shares, comentários, categorias e tags têm seus vínculos e regras de exclusão declarados nos modelos. Comentários/respostas são eliminados em cascata com o post ou comentário pai.

## 4. API e contratos

Todas as rotas abaixo são relativas a `/api/v1/blog/`. A paginação global retorna `count`, `next`, `previous`, `results`, normalmente com 20 itens.

### 4.1 Posts

| Método/rota | Uso |
|---|---|
| `GET /posts/` | Lista com busca, filtros, ordenação e paginação. |
| `POST /posts/` | Cria post; atribui autor ao usuário autenticado. |
| `GET /posts/{slug}/` | Detalhe por slug; incrementa visualizações se status publicado. |
| `PUT/PATCH /posts/{slug}/` | Atualiza; permitido ao autor ou staff conforme permissão de objeto. |
| `DELETE /posts/{slug}/` | Remove com a mesma permissão de objeto. |
| `GET /posts/featured/` | Posts marcados em destaque, paginados. |
| `GET /posts/latest/` | Cinco itens ordenados por `published_at` descendente. |
| `GET /posts/popular/` | Dez itens ordenados por `views_count` descendente. |
| `GET /posts/{slug}/related/` | Até três posts publicados com categoria ou tags em comum. |
| `POST /posts/{slug}/duplicate/` | Duplica como rascunho, remove flag destaque, gera slug novo, copia tags e tenta copiar imagem principal. |
| `POST /posts/{slug}/like/` | Alterna curtida; requer autenticação. |
| `GET /posts/{slug}/likes/` | Lista usuários que curtiram. |
| `POST /posts/{slug}/share/` | Registra compartilhamento anônimo ou autenticado, tipo/IP/user-agent. |
| `GET /posts/{slug}/shares/` | Estatísticas por tipo e até dez compartilhamentos recentes. |
| `GET/POST /posts/{slug}/comments/` | Lista comentários aprovados ou cria comentário pendente. |

Serializers de post distintos:

- **Lista**: resumo, autor, categoria/tags, imagem, estado, datas, leitura, visualizações, interações.
- **Detalhe**: inclui conteúdo integral, campos SEO e créditos de imagem.
- **Create/update**: recebe conteúdo, relações e campos SEO; `author` vem do usuário atual e tags são IDs.

### 4.2 Categorias, tags e outras rotas

| Método/rota | Uso |
|---|---|
| `GET /categories/`, `GET /categories/{id}/` | Consultar categorias. |
| `POST/PUT/PATCH/DELETE /categories/...` | Gestão de categorias; escrita exige staff. Não permite excluir categoria ainda utilizada. |
| `GET /categories/{slug}/posts/` | Posts publicados da categoria (ver ressalva de binding de slug na seção 9). |
| `GET /tags/`, `GET /tags/{slug}/`, `GET /tags/{slug}/posts/` | Tags e posts publicados por tag. |
| `GET/POST /newsletter/` | Lista assinaturas ou cria inscrição. |
| `POST /newsletter/subscribe/` | Inscreve email. |
| `POST /newsletter/unsubscribe/` | Marca email como inativo. |
| `DELETE /newsletter/{id}/` | Apaga inscrição pela rota de router. |
| `GET/POST /upload/image/` | Upload multipart sob `image`; recebe também campos opcionais de crédito e devolve URL absoluta, nome, tamanho e `credit_info`. |
| `GET/POST /posts/{slug}/image-credits/` | Consulta/cria créditos de imagem. |
| `GET/PUT/PATCH/DELETE /posts/{slug}/image-credits/{id}/` | Ações de detalhe de crédito. |
| `GET/PUT/PATCH/DELETE /posts/{slug}/comments/{id}/` | Ações de detalhe de comentário, conforme roteamento configurado. |

### 4.3 Filtros e busca de posts

`BlogPostFilter` aceita `title` (contains, case-insensitive), `category`, `tags`, `author` (username parcial), `author_name` (nome/sobrenome), `status`, `is_featured`, `date_from`, `date_to` e `search` (título, resumo, conteúdo, tag ou categoria). DRF também declara `SearchFilter` em título/resumo/conteúdo e `OrderingFilter` nos campos criação/publicação/visualizações/título. A ordem padrão da API é `-created_at`.

### 4.4 API administrativa de comentários e interações

Sob `/api/v1/blog/admin/`, com `IsAdminUser`:

- `/comments/`: CRUD e filtragem opcional por `status=pending|approved` e `post=id`.
- `/comments/pending/`: pendentes.
- `/comments/stats/`: total, pendentes, aprovados, recentes (7 dias) e top 10 posts.
- `/comments/{id}/approve/`, `/reject/`: moderação individual.
- `/comments/bulk_approve/`, `/bulk_reject/`, `/bulk_delete/`: moderação em lote, exigindo lista `comment_ids`.
- `/comments/by_post/`: agregação por artigo.
- `/social-stats/overview/`: métricas gerais, posts populares, atividade recente e tipos de share.

O cadastro e moderação também estão no Django Admin em `/admin/`; [backend/blog/admin.py](./backend/blog/admin.py) define listagens, pesquisa, filtros, ações em lote e inlines de comentários/créditos dentro do post.

## 5. Fluxo público do frontend

### 5.1 Roteamento

- `/blog`: página de listagem, carregada sob demanda.
- `/blog/:slug`: detalhe do artigo, carregado sob demanda.
- `/dashboard/blog`: aba de gestão, exige autenticação e `is_staff`.
- `/dashboard/posts/new`: criação, exige autenticação e `is_staff`.
- `/dashboard/posts/edit/:slug`: edição, exige autenticação e `is_staff`.

As rotas administrativas envolvem `ProtectedRoute`; componentes são importados por carregamento lazy/Suspense em [src/App.tsx](./src/App.tsx).

### 5.2 Listagem pública

Em `Blog.tsx`:

1. Carrega todos os posts, seguindo `next` página por página, e categorias em paralelo.
2. Filtra no browser apenas status `published` ou `is_published`.
3. Pesquisa localmente por título, resumo e conteúdo, com debounce de 800 ms.
4. Filtra por categoria (inclui opção “Todos”).
5. Pagina localmente com nove posts por página; destaca o primeiro post carregado na primeira página.
6. Exibe cartões com imagem, categoria, autor, data e tempo de leitura, além de estados de carregamento/erro.

A estratégia de buscar todas as páginas transfere custo e filtragem para o frontend. Para uma nova implementação, preferir filtros/paginação no servidor e não descarregar conteúdo de rascunhos ao visitante.

### 5.3 Página do artigo

`BlogDetailNew.tsx`:

- Busca detalhe e lista de posts em paralelo; rejeita o artigo no frontend se não estiver publicado.
- Escolhe até seis relacionados localmente, pontuando categoria (+100), tags (+30 por tag), hashtags (+20), autor (+50), visualizações, engajamento, recência, palavras do título e destaque.
- Apresenta breadcrumb, autor, datas, categoria, resumo, hero image, conteúdo, leitura, palavras-chave/hashtags, interações e comentários.
- Atualiza o `document.title`, usa `SEOHead` e substitui imagem quebrada por fallback Unsplash.
- Formata datas na localidade `pt-BR`.

Existe também [src/pages/BlogDetail.tsx](./src/pages/BlogDetail.tsx); a rota atual carrega `LazyBlogDetail`, portanto deve-se confirmar em `src/components/LazyComponents.tsx` qual módulo é o destino efetivo antes de portar componentes duplicados/legados.

## 6. Fluxo administrativo

### 6.1 Lista e dashboard

`BlogManagement.tsx` busca todas as páginas de posts e categorias, monta métricas (total, publicados, rascunhos, destacados, visualizações totais/médias, likes e comentários), filtra e ordena localmente. Tem paginação de 20, pesquisa por título/resumo/username, filtro de status/categoria, ordenação por data/título/visualizações, exportação e ações para criar, editar, duplicar e apagar com confirmação.

### 6.2 Criar e editar

As páginas `CreatePost.tsx` e `EditPost.tsx` combinam:

- título, resumo, corpo com editor rich text, categoria e dados da imagem (legenda/crédito/fonte);
- estado rascunho/publicado;
- `SEOForm` com meta title/description, keyword, canonical, OG/Twitter e diretivas robots;
- gestão de hashtags e preview;
- salvamento pela API e feedback na interface.

Na criação, um rascunho do formulário é guardado em `localStorage` com a chave `draft_post` após 2 segundos sem alteração e restaurado na reabertura; após criar com sucesso, é removido. A categoria é exigida pelo formulário. A edição carrega post e categorias, guarda cópia local enquanto há alterações e detecta mudanças para confirmar saída. O API client transmite JWT obtido pelo contexto/auth helper.

**Divergência do contrato**: os formulários usam campos `is_published` no estado/entrada em alguns trechos, mas o modelo/serializer da API usa `status` e não declara `is_published` para escrita. Ao replicar, manter `status` como fonte de verdade (`draft|published|archived`) e testar publicação/edição de ponta a ponta.

### 6.3 Moderação

O Django Admin permite filtrar por aprovação/data/categoria, pesquisar nome/email/texto/post, aprovar/rejeitar, marcar como spam (na prática também rejeita), excluir em lote e ver respostas. A API de comentários administrativos permite as mesmas operações e estatísticas. O frontend inclui ainda [src/pages/CommentsPage.tsx](./src/pages/CommentsPage.tsx); a gestão de comentário deve ser ligada à API staff em vez de confiar apenas na guarda da rota.

## 7. Upload e ciclo de vida das imagens

### Fluxo observado

1. O editor usa o componente `ImageUpload`; `src/lib/imageUpload.ts` contém provedores Backend Django → Cloudinary → ImgBB → URL temporária local.
2. O caminho central `uploadImage()` em `src/lib/api.ts` envia `multipart/form-data` para `/blog/upload/image/`.
3. A API salva em `MEDIA_ROOT/uploads/` através de `default_storage` e retorna URL completa.
4. O serializer também aceita URL HTTP para `featured_image`, baixa a imagem para o servidor e grava no storage do modelo; para URLs `/media/` do domínio local tenta ler do disco diretamente.
5. `BlogPost.featured_image` grava em `blog_images/`; `og_image`, em `blog_images/og/`.
6. O Django Admin e o backend geram URLs via `MEDIA_URL`; o Nginx deve servir a mesma árvore de `MEDIA_ROOT`.

O limite de 10 MB existe no serviço de upload frontend alternativo; a configuração do Nginx documenta limite de 50 MB. O endpoint backend não aplica validação explícita de formato/tamanho no código lido. O redimensionamento usa Pillow.

### Produção e mídia

`MEDIA_URL=/media/`, `MEDIA_ROOT=BASE_DIR/media` em settings, enquanto o Nginx precisa usar `alias` para o diretório media efetivo do deploy. [nginx.conf](./nginx.conf) contém a estrutura de proxy, `/media/`, `/static/`, limite de upload, cache e rate limit. Documentos de operações existentes ([CORRECAO_IMAGENS_BLOG.md](./CORRECAO_IMAGENS_BLOG.md), [DEBUG_MANIFEST_MIXED_CONTENT_404.md](./DEBUG_MANIFEST_MIXED_CONTENT_404.md)) relatam incidentes de caminho divergente e imagens ausentes. A configuração em disco e os caminhos daqueles relatórios não são totalmente consistentes; validar o ambiente de destino, não copiar os caminhos literalmente.

## 8. SEO e publicação

- `SEOHead` atualiza `document.title`, description, keywords, canonical, robots, Open Graph, metadados de artigo e Twitter Card.
- Prioridade geral combina campos específicos do artigo com fallback de excerpt/configuração global.
- `noindex` e `nofollow` alimentam `robots`; `robots_txt` é anexado como diretiva adicional.
- Dados Schema.org são gerados pelo modelo; há utilitário [backend/blog/seo_utils.py](./backend/blog/seo_utils.py) para análise e breadcrumbs, e templates/tags Django relacionados.
- Sitemap/robots fazem parte de `core` (no frontend, `public/robots.txt` e `public/sitemap.xml` têm entradas fixas e datas estáticas).
- `published_at` é preenchido na criação quando status é publicado; ao editar, se publicar pela primeira vez, é preenchido; ao salvar outro status, o serializer limpa `published_at`.
- O detalhe público aplica SEO no navegador. Como é uma SPA Vite sem renderização server-side aparente, crawlers que não executam JavaScript podem não ver metadados específicos do artigo; usar SSR/prerender ou geração de HTML por artigo é uma escolha de replicação a avaliar.

## 9. Atenções e lacunas do código atual

Estas observações são importantes para replicar intencionalmente, não necessariamente para copiar sem alterações:

1. **Visibilidade de posts na API**: `BlogPostViewSet.get_queryset()` filtra por `status` somente se o cliente enviar o parâmetro. Sem filtro, a listagem/detalhe não restringe explicitamente a `published`; o frontend faz o filtro na listagem e detalhe, tarde demais para proteger conteúdo de rascunho. Separar querysets públicos e administrativos no sistema novo.
2. **Autorização por superfície**: a rota do dashboard exige staff; a permissão da API de posts é `IsAuthorOrReadOnly`, que permite escrita ao autor autenticado ou staff. A API é a fronteira real e deve ser testada independentemente da interface.
3. **Upload**: `ImageUploadView` declara `authentication_classes=[]` e `permission_classes=[]`; o código verifica se existe campo de arquivo, mas não mostra validação backend de MIME, conteúdo, dimensões, tamanho ou quota. Não adotar essa configuração sem controles server-side.
4. **Créditos de imagem**: `ImageCreditViewSet` também declara autenticação/permissões vazias e oferece operações de `ModelViewSet`, inclusive escrita/remoção, na rota aninhada.
5. **Newsletter**: o `NewsletterViewSet` não aplica permissões e habilita GET/POST/DELETE. Assim, não é um CRUD limitado ao subscribe; revisar exposição de emails e remoção em sistema replicado.
6. **Comentários**: o comentário público inicia não aprovado, mas a rota aninhada permite leitura/criação sem exigir login (`permission_classes=[]` na action). Há um `CommentViewSet` separado com `IsAuthenticatedOrReadOnly`, porém as rotas aninhadas são ligadas diretamente à action pública de `BlogPostViewSet`. Definir autenticação, rate limiting, validação e moderação como requisito.
7. **Status no contrato frontend**: a UI consulta `is_published` além de `status`; o backend serializa `is_published` como campo de leitura em alguns serializers, não como campo gravável. Usar estado único e explícito.
8. **Categoria por slug**: a rota manual `categories/<slug:slug>/posts/` liga ação de viewset que chama `get_object()` e declara argumento `pk`; confirmar binding/lookup, pois o viewset de categoria usa PK padrão. Testar ou corrigir para `lookup_field='slug'`/rota consistente.
9. **Tratamento de erro**: alguns componentes convertem falha de carregar categorias/posts em array vazio ou exibem alert/toast genérico. A integração deve distinguir erro de rede, autorização, validação e estado vazio.
10. **Contagem/comentários**: list/detail têm campos `comments_count`/`total_comments_count` com significados diferentes; o frontend atualiza contador de comentários visíveis principais, enquanto as métricas podem incluir respostas. Documentar a métrica canônica.
11. **Related posts duplicado**: existe recomendação simples no backend e algoritmo de relevância mais rico no frontend. Decidir por uma só implementação para evitar resultados diferentes entre clientes.
12. **Testes do domínio**: `backend/blog/tests.py` não contém testes efetivos. Os testes frontend podem existir em `src/test`, mas não há cobertura de integração do fluxo CRUD, acesso, publicação, imagens, paginação ou comentários observada nesta inspeção.
13. **Download por URL**: `BlogPostCreateUpdateSerializer.to_internal_value()` baixa URLs externas e tenta normalizá-las. Em uma replicação, validar esquema/domínio/tamanho/tipo e proteger chamadas de saída; não assumir que qualquer URL remota é segura.
14. **Backend de imagens remoto/local**: a lista de providers tem providers externos e fallback `blob:` temporário; URL temporária não é persistente após recarregar. O formulário de criação já tenta impedir envio de `blob:` como imagem principal.

## 10. Guia de replicação recomendado

### Fase A — domínio e banco de dados

1. Criar entidades `Post`, `Category`, `Tag`, `Comment`, `Like`, `Share`, `NewsletterSubscription` e `ImageCredit`.
2. Definir estados e transições de publicação, autoria, exclusões e índices.
3. Fazer migrações e escrever testes de validação/constraints antes das telas.
4. Tratar datas em UTC no banco e converter para timezone/localidade só na apresentação.

### Fase B — API

1. Separar endpoints públicos (somente posts publicados) de endpoints de gestão (staff/editor).
2. Implementar listagem paginada/filtrada e serializers de resumo/detalhe/escrita.
3. Implementar validação do slug, autor, categoria/tags, uploads e campos SEO no servidor.
4. Exigir autorização staff/editor para upload, gestão de imagens/categorias, newsletter administrativa e moderação.
5. Expor comentários aprovados para leitura, exigir antispam/rate limit no envio e manter todos os novos comentários pendentes.
6. Somente permitir curtir autenticado; registrar compartilhamentos sem armazenar dados pessoais excessivos.
7. Adicionar testes de autorização para anônimo, usuário autenticado, autor, editor/staff e superuser.

### Fase C — administração

1. Criar lista de posts com busca/filtros e ações de criar/editar/duplicar/apagar.
2. Criar editor rich text com preview e upload persistente; salvar como rascunho por padrão.
3. Separar publicação de salvar rascunho; validar transição e timestamp no backend.
4. Criar seção de SEO e acessibilidade, incluindo alt text/créditos e visualização de score informativo.
5. Criar fila de comentários pendentes com aprovação, rejeição e ações em lote auditáveis.

### Fase D — público, SEO e infraestrutura

1. Implementar índice público, filtros e páginas de artigo com conteúdo acessível e layout responsivo.
2. Usar URLs estáveis por slug; redirecionar slug antigo se o título mudar.
3. Gerar meta tags, canonical, Open Graph/Twitter e dados estruturados no HTML entregue ao crawler (SSR/prerender se necessário).
4. Gerar sitemap dinâmico apenas com URLs publicadas; atualizar `lastmod`.
5. Armazenar mídia em storage persistente/object storage; servir com cache e garantir que a URL do serializer resolve no navegador.
6. Configurar limites de upload, validação do conteúdo, nomes não previsíveis, logs e retenção/backups.

### Fase E — testes mínimos para considerar reproduzido

- Público só consulta post publicado; rascunho/arquivado não vaza por detalhe, busca ou endpoint auxiliar.
- Autor não pode editar post de outro autor; staff/editor pode conforme regra definida.
- `published_at`, slug, tags, categoria e imagens continuam coerentes após create/update/duplicate.
- Paginação combina corretamente com filtros e ordenação no backend.
- Comentários novos não aparecem antes da aprovação; respostas respeitam autorização e hierarquia.
- Like é idempotente/único por usuário; share registra tipos suportados.
- Upload inválido, oversized, imagem corrompida ou falha de storage retorna erro explícito.

## 11. Adaptação aplicada ao e-Shopping Centre

Este guia descreve um sistema React/Vite e Django com domínio de blog mais amplo; a implementação no e-Shopping Centre foi adaptada à stack e ao domínio existentes, sem importar aquelas dependências.

- O frontend usa Next.js App Router, React e TypeScript. `/blog` e `/blog/[slug]` consomem a API Django e mantêm os componentes, cores e layouts já usados no site; os metadados do artigo são gerados no servidor.
- A API mantém o modelo existente `BlogPost`, com `is_published` como estado simples de publicação, slug, categoria textual e imagem armazenada pelo Django. Os endpoints estão em `/api/v1/blog/` e `/api/v1/admin/blog/`.
- A listagem pública filtra busca/categoria e paginação na API; artigos não publicados ficam inacessíveis pela lista e pelo detalhe públicos. No painel `/admin?tab=blog`, a criação inicia como rascunho e a publicação é uma ação explícita.
- O tempo de leitura e a data de publicação são gerados no backend. O administrador mantém o CRUD e upload multipart já existentes; não foi introduzida uma nova biblioteca de editor ou upload.
- Newsletter, comentários, likes, moderação, tags e categorias relacionais foram omitidos: o backend atual não oferece esses contratos. Os controles de newsletter que eram apenas visuais também foram removidos para não sugerir uma inscrição que não era persistida. Os campos SEO configuráveis foram implementados (ver 11.2); a pontuação SEO persistida no backend foi substituída por análise orientativa no formulário.
- A gestão administrativa usa lista responsiva com métricas disponíveis (artigos, publicados, rascunhos e categorias utilizadas), pesquisa, filtros, ordenação, paginação, exportação CSV e ações de editar, duplicar como rascunho, pré-visualizar e eliminar com confirmação. A duplicação copia texto e categoria, mas não a imagem de capa. O editor dedicado em `/admin/blog/editor` suporta rascunho local automático, pré-visualização isolada, upload de capa e alternância de publicação; a mesma interface adapta tabela/cartões e ações para mobile.
- Meta/canonical/Schema e sitemap refletem apenas o artigo publicado solicitado.
- Dashboard funciona sem depender de `is_published` não gravável nem de dados pessoais expostos.

### 11.1 Editor enriquecido e imagens locais

- `src/components/admin/BlogRichTextEditor.tsx` oferece formatação (negrito, itálico, sublinhado, riscado, código), títulos, alinhamento, listas, citações, blocos de código, tabelas, cores, ligações, desfazer/refazer e edição de HTML, com tela cheia e modo de foco.
- A imagem de capa aceita tanto upload local como URL pública HTTP/HTTPS. O backend guarda URLs em `BlogPost.image_url`, e os serializers públicos expõem a imagem selecionada na listagem e no detalhe; uma imagem carregada localmente tem prioridade sobre a URL.
- As imagens do corpo podem ser carregadas do computador: `POST /api/v1/admin/blog/images/` (`IsAdminUser`, multipart, 5 MB, JPG/PNG/WebP/GIF) devolve URL absoluta e o editor insere `<figure><img><figcaption>`.
- O HTML é sanitizado no cliente (antes de enviar) e novamente no servidor em `src/lib/blog-content.ts`; a página do artigo aplica estilos tipográficos próprios (`blog-article-content`).

### 11.2 SEO, partilha e créditos de imagem

Campos acrescentados ao `BlogPost` (migration `0004`), editáveis no painel `BlogSeoPanel` dentro do editor:

| Campo | Uso |
| --- | --- |
| `meta_title` | título nos resultados de busca; fallback para `title` |
| `meta_description` | descrição nos resultados; fallback para `excerpt` |
| `canonical_url` | URL canónica quando o artigo também existe noutro endereço |
| `focus_keyword` | palavra-chave usada na análise de conteúdo do formulário |
| `og_title`, `og_description` | texto nas prévias de partilha |
| `twitter_card` | `summary_large_image` (padrão) ou `summary` |
| `noindex`, `nofollow` | controlo real de indexação |
| `image_caption` | legenda e texto alternativo da capa |
| `image_credit` | autoria exibida sob a imagem |
| `image_source_url` | ligação para a fonte/licença |

- O modelo expõe `seo_title`, `seo_description`, `seo_og_title`, `seo_og_description` e `seo_robots`; o serializer devolve um objeto `seo` para o frontend.
- `generateMetadata` em `app/blog/[slug]/page.tsx` produz `<title>`, `description`, `robots`, `link rel=canonical`, Open Graph e Twitter a partir desses campos. O título SEO tem prioridade sobre o título do artigo e `noindex`/`nofollow` são respeitados.
- A página injeta JSON-LD `BlogPosting` (headline, descrição, datas, autor, publisher, `mainEntityOfPage`) e exibe legenda/crédito sob a capa, com `rel="nofollow"` na ligação à fonte.
- Tudo é gerado no servidor: os metadados e o JSON-LD aparecem no HTML entregue, sem depender de JavaScript.
- A análise de palavra-chave no painel é orientativa (presença em título, meta descrição, subtítulos e corpo, além de densidade); não garante posicionamento.
- O crédito documenta autoria, mas não substitui uma licença ou autorização de uso da imagem.

## 11. Referências principais

- Frontend: [src/App.tsx](./src/App.tsx), [src/pages/Blog.tsx](./src/pages/Blog.tsx), [src/pages/BlogDetailNew.tsx](./src/pages/BlogDetailNew.tsx), [src/components/admin/BlogManagement.tsx](./src/components/admin/BlogManagement.tsx), [src/pages/CreatePost.tsx](./src/pages/CreatePost.tsx), [src/pages/EditPost.tsx](./src/pages/EditPost.tsx), [src/lib/api.ts](./src/lib/api.ts), [src/lib/imageUpload.ts](./src/lib/imageUpload.ts), [src/components/SEOHead.tsx](./src/components/SEOHead.tsx).
- Backend: [backend/blog/models.py](./backend/blog/models.py), [backend/blog/serializers.py](./backend/blog/serializers.py), [backend/blog/views.py](./backend/blog/views.py), [backend/blog/admin_views.py](./backend/blog/admin_views.py), [backend/blog/admin.py](./backend/blog/admin.py), [backend/blog/filters.py](./backend/blog/filters.py), [backend/blog/permissions.py](./backend/blog/permissions.py), [backend/blog/urls.py](./backend/blog/urls.py).
- Integração/infra: [backend/moz_solidaria_api/settings.py](./backend/moz_solidaria_api/settings.py), [backend/moz_solidaria_api/urls.py](./backend/moz_solidaria_api/urls.py), [nginx.conf](./nginx.conf), [backend/requirements.txt](./backend/requirements.txt), [package.json](./package.json).
