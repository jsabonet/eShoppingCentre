# Especificação — Banners e campanhas da homepage

> Proposta funcional para gerir conteúdos promocionais da homepage pelo painel
> administrativo, sem necessidade de alterar código ou publicar uma nova versão
> do site. O foco inicial é a operação do e-commerce em Moçambique.

## 1. Objetivo

Permitir que administradores criem, revejam, agendem e acompanhem banners da
homepage. A publicação e a remoção devem acontecer automaticamente nas datas
configuradas, com uma experiência rápida e adaptada a telemóveis e a ligações
mais lentas.

## 2. Escopo recomendado

### Primeira versão (MVP)

- Criar, editar, pré-visualizar, agendar, publicar, pausar e arquivar banners.
- Definir imagem para computador e telemóvel, texto alternativo e conteúdo
  opcional (título, descrição e botão).
- Definir destino do clique, período de publicação, posição e prioridade.
- Mostrar apenas campanhas elegíveis e aprovadas.
- Registar visualizações e cliques para apresentar métricas básicas no admin.
- Manter histórico das alterações administrativas.

### Evoluções posteriores

- Aprovação por uma segunda pessoa antes da publicação.
- Testes A/B de criativos.
- Segmentação por província, idioma, dispositivo ou perfil de cliente.
- Mais posições promocionais na homepage, além do banner principal.
- Relatórios de conversão e integração com campanhas de marketing.

Segmentação e testes A/B não são necessários para o MVP: aumentam a
complexidade e devem ser priorizados quando houver volume de campanhas e dados.

## 3. Utilizadores e permissões

- **Administrador com permissão de campanhas:** cria e edita rascunhos, envia
  imagens, pré-visualiza e agenda/publica campanhas.
- **Administrador sem permissão de publicação (opcional):** prepara rascunhos
  para revisão por outro administrador.
- **Visitante da loja:** vê as campanhas publicadas e pode abrir o respetivo
  destino.

As permissões devem reutilizar o sistema de autenticação e autorização já
existente no painel administrativo. Alterações relevantes devem identificar o
utilizador responsável e a data/hora da ação.

## 4. Dados de uma campanha

| Campo | Obrigatório | Descrição |
|---|:---:|---|
| Nome interno | Sim | Identificação no admin; não precisa aparecer na loja. |
| Imagem para computador | Sim | Criativo principal para ecrãs maiores. |
| Imagem para telemóvel | Recomendado | Versão adaptada a ecrãs pequenos; pode usar a imagem principal como alternativa. |
| Texto alternativo | Sim | Descrição acessível da imagem. |
| Título e descrição | Não | Texto opcional apresentado sobre ou junto ao banner. |
| Texto do botão | Não | Por exemplo, “Ver campanha”; só aparece quando houver destino. |
| URL de destino | Sim | Página de campanha, categoria, produto ou endereço permitido. |
| Início da publicação | Sim | Data e hora a partir das quais a campanha pode ser exibida. |
| Fim da publicação | Sim | Data e hora até às quais a campanha pode ser exibida. |
| Prioridade | Sim | Número usado para ordenar os banners elegíveis; valores maiores aparecem primeiro no carrossel. |
| Posição | Sim | Inicialmente, banner principal da homepage. |
| Estado | Sim | Rascunho, agendada, publicada, pausada ou arquivada. |

O preço promocional e a validade de uma oferta devem ser apresentados apenas
quando corresponderem a uma promoção real e vigente. Quando forem exibidos
preços, usar meticais (MZN) e evitar texto que prometa condições diferentes das
definidas para o produto ou campanha.

## 5. Regras de publicação e agendamento

1. Uma campanha só pode ser agendada ou publicada se os campos obrigatórios
   estiverem válidos e a data/hora final for posterior à inicial.
2. O admin apresenta e recebe as datas no fuso `Africa/Maputo`; o sistema deve
   guardar e comparar os instantes de forma consistente, preferencialmente em
   UTC.
3. Uma campanha é elegível para exibição quando está aprovada, não está pausada
   nem arquivada, e o instante atual está dentro do período configurado.
4. A mudança entre “agendada”, “publicada” e “expirada” deve ocorrer
   automaticamente, mesmo sem alguém manter o painel aberto. A decisão de
   exibição deve também validar o período no servidor, para não depender apenas
   de uma tarefa agendada ou do estado visível no admin.
5. Se várias campanhas estiverem elegíveis para a mesma posição, exibi-las no
   carrossel por ordem de prioridade decrescente. Em caso de empate, prevalecem
   a data de início mais antiga e depois a data de criação.
6. Se não existir campanha elegível, apresentar o conteúdo padrão configurado
   para a homepage ou ocultar a área do banner sem deixar um espaço quebrado.
7. Uma campanha pausada deixa de ser exibida imediatamente, mas pode ser
   reativada se ainda estiver dentro do período válido.
8. Ao editar uma campanha já publicada, validar novamente os dados e refletir
   as alterações na homepage sem exigir uma nova versão do site.

## 6. Gestão no painel administrativo

### Lista de campanhas

Apresentar nome, posição, período, estado, prioridade e ações. Permitir busca
por nome e filtros por estado e período. Identificar campanhas agendadas,
publicadas, pausadas e expiradas com estados visuais distintos.

### Formulário e pré-visualização

- Separar dados internos, conteúdo visual, destino e agendamento.
- Pré-visualizar em formatos de telemóvel e computador antes de publicar.
- Mostrar avisos para datas inválidas, ausência de alternativa para telemóvel,
  destino inválido ou período sobreposto com outra campanha.
- Permitir guardar como rascunho sem publicar.
- Pedir confirmação antes de pausar ou arquivar uma campanha publicada.

### Como criar e publicar uma campanha

1. No painel, abra **Comércio > Campanhas** e escolha **Nova campanha**.
2. Preencha o nome interno, o destino do clique e o texto alternativo da imagem.
   O nome interno só é visto no admin; o texto alternativo descreve a imagem
   para leitores de ecrã.
3. Envie a imagem de computador e, idealmente, uma versão específica para
   telemóvel. Confira a pré-visualização antes de guardar.
4. Adicione título, descrição e texto do botão se forem necessários. Estes
   textos são sobrepostos à imagem; evite repeti-los dentro do ficheiro.
5. Escolha o início e o fim no horário de Moçambique (`Africa/Maputo`) e
   defina a prioridade. Uma prioridade maior coloca o banner antes dos outros
   banners ativos.
6. Para preparar com antecedência, guarde com estado **Ativa / agendar** e
   defina uma data inicial futura. O banner entra e sai do carrossel
   automaticamente dentro do período configurado.
7. Para publicar um rascunho ou antecipar uma campanha agendada, use **Ativar
   agora** na lista. A campanha começa imediatamente e conserva a data final;
   se a data final já passou, edite-a antes de ativar.
8. Use **Pausar** para retirar temporariamente um banner sem o eliminar. Reative
   com **Ativar agora**. Use **Editar** para alterar imagem, período, texto ou
   destino; use **Histórico** para consultar as alterações.
9. Os banners ativos aparecem em rotação no carrossel. Se não existir nenhum
   banner ativo, a homepage mostra os banners predefinidos do site.

As alterações da homepage podem levar até 30 segundos a aparecer por causa da
revalidação da página. Ativar uma campanha não apaga as restantes: todas as
campanhas elegíveis continuam a rodar conforme a prioridade.

## 7. Imagens, acessibilidade e desempenho

- Aceitar JPG/JPEG, PNG ou WebP, com no máximo 10 MB por ficheiro. O backend
  valida os dados reais da imagem, rejeita imagens com mais de 40 megapíxeis,
  redimensiona para caber em 1920 × 1600 píxeis e converte para WebP.
- As dimensões abaixo são recomendações para o enquadramento do slider atual;
  não são exigências rígidas. A imagem pode ser menor, mas pode perder nitidez.

| Uso | Tamanho recomendado | Proporção | Onde é usada |
|---|---:|---:|---|
| Computador / imagem principal | 1920 × 640 px | 3:1 | Ecrãs a partir de 768 px. |
| Telemóvel / imagem alternativa | 900 × 600 px | 3:2 | Ecrãs abaixo de 640 px; campo “Imagem para telemóvel”. |
| Tablet / largura intermédia | Usar a imagem principal (1920 × 640 px) | Exibida em 2:1 | Entre 640 e 767 px; não existe upload separado para tablet e as laterais podem ser cortadas. |

- O slider usa `object-fit: cover`: se a imagem tiver outra proporção, partes
  das margens podem ser cortadas. Mantenha rostos, produtos, logótipos e
  informação visual importante dentro da área central segura. Evite colocar
  conteúdo importante junto às bordas.
- A imagem para telemóvel substitui a imagem principal apenas em ecrãs com
  menos de 640 px. Se não for carregada, a imagem principal é usada e poderá
  ser cortada para caber.
- Em tablets, a imagem principal é exibida no formato 2:1. Como não existe
  imagem específica para tablet, mantenha os elementos principais na zona
  central para reduzir cortes laterais.
- Título, descrição e botão do admin são desenhados por cima da imagem. Deixe
  espaço/contraste para o texto e não o inclua também no ficheiro, evitando
  texto duplicado ou ilegível em diferentes ecrãs.
- Para ligações móveis, prefira ficheiros de até cerca de 300 KB antes do
  carregamento; ficheiros maiores são aceites até 10 MB, mas podem demorar mais
  a transferir. A aplicação redimensiona e converte para WebP; otimizar o
  original também reduz o tempo de envio ao admin.
- Guardar ficheiros no serviço de media já adotado pelo projeto, e não como
  conteúdo binário no registo da campanha.
- Usar a imagem adequada ao tamanho do ecrã e dimensões reservadas no layout
  para evitar mudanças bruscas na página.
- Fornecer texto alternativo e manter o destino do banner acessível por teclado.
- Exibir uma alternativa visual caso a imagem falhe e não bloquear o restante
  carregamento da homepage.
- Evitar que imagens grandes atrasem o conteúdo principal, especialmente em
  ligações móveis.

## 8. Métricas

No MVP, apresentar por campanha:

- número de visualizações;
- número de cliques;
- taxa de cliques (CTR), calculada como cliques divididos por visualizações;
- período analisado.

Definir uma regra consistente para contar visualizações (por exemplo, quando o
banner entra efetivamente na área visível) e evitar incrementos repetidos por
renderizações sucessivas. As métricas devem ser agregadas e não precisam guardar
dados pessoais do visitante.

## 9. Critérios de aceitação

- Um administrador autorizado consegue criar uma campanha sem alterar código.
- Não é possível agendar campanhas com campos obrigatórios inválidos ou com
  período invertido.
- Campanhas agendadas começam a aparecer no início configurado e deixam de
  aparecer ao terminar, no fuso de Moçambique.
- Campanhas pausadas ou fora do período não são exibidas.
- Se houver mais de uma campanha elegível para a posição principal, a prioridade
  determina qual aparece e o admin consegue identificar o resultado.
- Sem campanha elegível, a homepage mantém uma apresentação válida, sem imagem
  quebrada ou espaço vazio inesperado.
- A homepage funciona em telemóvel e computador e não depende da disponibilidade
  do painel administrativo para apresentar uma campanha já publicada.
- O admin consegue consultar visualizações, cliques e o histórico de alterações.

## 10. Sequência de implementação sugerida

1. Confirmar o layout da homepage, o serviço atual de media, o mecanismo de
   cache e as permissões administrativas existentes.
2. Implementar o modelo e as validações de campanhas, incluindo estados e
   datas.
3. Implementar operações administrativas, upload de imagens e pré-visualização.
4. Integrar a homepage com a campanha elegível e a regra de fallback.
5. Adicionar métricas básicas, histórico e testes de datas, sobreposição,
   permissões e apresentação responsiva.
6. Considerar aprovação, segmentação e testes A/B numa fase posterior.

## 11. Implementação no projeto

O MVP foi integrado na aplicação existente:

- **Admin:** `Painel Admin > Comércio > Campanhas` (`/admin?tab=campaigns`).
- **API administrativa:** `/api/v1/campaigns/admin/` para listar/criar,
  `/api/v1/campaigns/admin/<id>/` para consultar/editar/eliminar e
  `/api/v1/campaigns/admin/<id>/history/` para o histórico. As operações de
  gestão requerem um utilizador staff autenticado.
- **Homepage pública:** `/api/v1/campaigns/active/` devolve a campanha ativa
  elegível de maior prioridade para a posição principal, seguida por todas as
  restantes campanhas elegíveis. A homepage apresenta-as no carrossel. Em caso
  de empate, prevalecem a data de início mais antiga e, depois, a data de criação.
  A homepage usa o cache de revalidação existente de 30 segundos, pelo que uma
  nova campanha ou transição de horário pode levar até 30 segundos a refletir-se
  na página.
- **Métricas públicas:** `POST /api/v1/campaigns/metrics/<id>/view/` e
  `POST /api/v1/campaigns/metrics/<id>/click/` incrementam contadores apenas
  enquanto a campanha estiver ativa e dentro do período.
- **Conteúdo visual:** o painel aceita JPG, PNG e WebP, com limite de 10 MB por
  imagem; o backend valida o conteúdo da imagem, limita dimensões excessivas,
  redimensiona e converte o ficheiro para WebP. A imagem de telemóvel é opcional.
  O banner ativo é atualizado sem
  publicar novamente o frontend. Se não existir campanha ativa ou a API estiver
  indisponível, a homepage mantém os banners predefinidos atuais.
- **Auditoria:** alterações, pausa, ativação e eliminação registam o
  administrador, data/hora e valores alterados.
- **Agendamento:** datas são introduzidas no horário `Africa/Maputo`; a API
  compara os instantes no servidor. A ativação e expiração dependem da janela
  temporal na consulta, não de uma tarefa periódica.
- **Ativação imediata:** a ação “Ativar agora” inicia a campanha no instante
  atual, mantém a data de fim configurada e regista a ação no histórico. Não é
  permitido ativar uma campanha cuja data final já passou.

### Publicação da migração

Aplicar a migração de campanhas com o procedimento normal de deploy do
backend, por exemplo:

```powershell
docker compose exec backend python manage.py migrate --noinput
```

Depois, verificar `/admin?tab=campaigns`, criar um rascunho de teste e
pré-visualizar as imagens em computador e telemóvel antes de o ativar.

### Limites da versão entregue

- A posição implementada é apenas o banner principal da homepage.
- Todas as campanhas elegíveis aparecem no carrossel, ordenadas por prioridade;
  não existe teste A/B.
- Métricas são contadores agregados; visualizações são deduplicadas por
  campanha e sessão do navegador. Não há atribuição de conversões.
- Os ficheiros usam o armazenamento de media configurado para a aplicação; a
  infraestrutura de deploy deve persistir/servir `MEDIA_ROOT` como já faz para
  as imagens de outros recursos.
