# Monitoria e auditoria administrativa

## Mapa do sistema administrativo

O painel Next.js vive em `frontend/app/admin/` e `frontend/src/components/admin/`. A autenticação visual é feita por `useAuth`; as páginas administrativas chamam APIs Django REST Framework com JWT. A autorização dos endpoints existentes é maioritariamente `IsAdminUser`.

| Área administrativa | Interfaces e rotas principais |
|---|---|
| Painel e indicadores | `GET /api/v1/admin/stats/` |
| Utilizadores | `GET/POST /api/v1/admin/users/`, `GET/PATCH/DELETE /api/v1/admin/users/{id}/` |
| Lojas e moderação | `/api/v1/admin/stores/` e respetivas rotas `pending/`, `all/`, `{id}/manage/`, `{id}/approve/`, `conversations/`, `followers/`, `reviews/` |
| Encomendas e devoluções | `/api/v1/admin/orders/all/`, `/api/v1/orders/admin/`, endpoints administrativos de devoluções e suporte em `apps.orders` |
| Carteira e pagamentos | `/api/v1/wallet/admin/` e `/api/v1/affiliates/admin/` para saques, reconciliação e pagamentos de afiliados |
| Catálogo | `/api/v1/admin/categories/` (categorias de produto); operações de cupões em `apps.products` |
| Conteúdo e formação | `/api/v1/admin/blog/`, `/api/v1/admin/courses/` |
| Conversas | `/api/v1/admin/chat/` |
| Administração Django | `/django-admin/` |

O painel agrega essas áreas em `frontend/src/components/AdminDashboard.tsx`, com navegação em `frontend/src/components/admin/AdminLayout.tsx`. A lista de endpoints e permissões concretas permanece nos `urls*.py` e `views*.py` de cada app.

## Proposta e implementação

O middleware central `apps.core.middleware.AdminAuditMiddleware` regista chamadas a caminhos administrativos, incluindo tentativas recusadas, APIs por módulo e o Django Admin. Também regista qualquer requisição autenticada por utilizador `is_staff`, para cobrir operações administrativas em rotas partilhadas com vendedores/utilizadores. O evento inclui actor (e snapshot do email), método, caminho sem query string, estado HTTP, resultado, endereço remoto, agente do browser e duração. Não armazena corpos de pedidos/respostas, tokens, palavras-passe ou parâmetros de query.

Os eventos são persistidos em `AdminAuditEvent`, com endpoint de consulta apenas de leitura em `GET /api/v1/admin/audit/events/`. A interface **Auditoria** no painel permite filtrar por texto, tipo, resultado, método e intervalo de datas, além de paginar os resultados. O registo do evento é uma escrita obrigatória no middleware: falha ao persistir é propagada, em vez de reportar silenciosamente uma operação administrativa como auditada.

## Limites e operação

- A cobertura é por requisição HTTP administrativa; tarefas de background e mutações disparadas fora dessas rotas não são atribuídas a um administrador por este mecanismo.
- O registo demonstra quem, quando, rota, método e resultado, mas não guarda diferenças antes/depois dos dados de negócio. Para trilho financeiro/forense, acrescentar eventos de domínio com diffs selectivos e sem dados sensíveis.
- O histórico é append-only através da API, mas não é inviolável contra operadores com acesso direto à base de dados. Para evidência regulatória, exportar para armazenamento externo append-only e definir retenção/alertas.
- Se a escrita do evento falhar, o erro é propagado; como ocorre depois do processamento da rota, a operação de negócio pode já ter sido confirmada. Verificar o estado antes de repetir a acção.
- Aplicar a migração `apps.core.0001_adminauditevent` antes de ativar a versão que inclui o middleware.
- O endpoint exige o mesmo `IsAdminUser` usado pelas APIs administrativas existentes.
