# Revisão segura de dados de teste em produção

## Objetivo

Identificar candidatos a dados simulados e divergências em métricas agregadas
sem apagar ou modificar dados de produção. A marca usada para os pedidos
simulados é `payment_method=test`, confirmada para esta revisão.

## Execução

Depois de publicar o commit que inclui o comando, executar a partir da pasta que
contém o `docker-compose.yml` principal:

```bash
docker compose exec backend python manage.py review_test_data_cleanup
```

O comando imprime um relatório JSON no terminal. É estritamente de leitura:
não possui modo de exclusão ou atualização e não requer migrações.

Para listar as lojas e as dependências antes de escolher quais devem ser
removidas:

```bash
docker compose exec backend python manage.py inventory_stores_for_review
```

O relatório identifica cada loja pelo ID e nome, inclui o estado e apresenta
contagens de produtos, pedidos, avaliações, pagamentos e relações do
proprietário. Também indica encomendas do proprietário como comprador noutras
lojas, que poderiam ser afetadas pela eliminação da conta. Não inclui emails ou
outros dados pessoais.

Para fazer o inventário das métricas antes de definir o reset:

```bash
docker compose exec backend python manage.py inventory_metrics_for_reset
```

Este relatório resume eventos de views/pesquisas, contadores de vendas,
afiliados, ratings e campanhas. Não altera contadores nem remove eventos.

## Plano detalhado das lojas selecionadas

Depois de confirmar os IDs no inventário geral, gerar um relatório de
dependências somente de leitura para as quatro lojas escolhidas:

```bash
docker compose exec backend python manage.py plan_selected_store_cleanup \
  7595e91f-964c-44af-8479-9b3d368f3b7f \
  2f7b76a7-c89f-4bdd-815e-e925b753cb51 \
  4f8388f9-f9e0-4a38-8d6e-f41695a87bd7 \
  b5f693a9-e200-48eb-b545-03a3bbdb874d
```

O relatório detalha produtos, pedidos e itens, transações de pagamento,
movimentos de carteira e ledger, escrow, comissões, devoluções, tickets,
avaliações, matrículas, downloads, cupões, logs de stock e moderação. Também
apresenta pedidos dos proprietários como compradores fora das lojas
selecionadas e sinaliza transações associadas a mais de um pedido. Esses
pedidos, as contas dos proprietários e os respetivos dados de carteira são
explicitamente preservados.

Este comando não é uma operação de exclusão: não altera lojas, utilizadores,
pedidos, pagamentos, métricas ou outros registos. O relatório deve ser
revisto antes de se propor qualquer operação destrutiva. Em particular,
transações concluídas, encomendas com itens de outras lojas e dados de
compradores não devem ser eliminados com base apenas na associação à loja.
O reset de métricas permanece apenas em inventário até existir uma decisão
separada sobre o seu escopo.
Ficheiros em armazenamento externo e relações não incluídas no relatório
precisam de inventário e revisão separados.

### Inventário do impacto de encomendas ligadas

Para mapear encomendas e transações partilhadas, incluindo ligações em cadeia,
execute o inventário adicional:

```bash
docker compose exec backend python manage.py inventory_store_purge_impact \
  7595e91f-964c-44af-8479-9b3d368f3b7f \
  2f7b76a7-c89f-4bdd-815e-e925b753cb51 \
  4f8388f9-f9e0-4a38-8d6e-f41695a87bd7 \
  b5f693a9-e200-48eb-b545-03a3bbdb874d
```

O comando percorre recursivamente todas as encomendas ligadas por tentativas
de pagamento e apresenta IDs, lojas, estados, compradores (somente IDs),
transações e um hash do escopo. É somente de leitura. O hash não autoriza nem
executa uma eliminação; qualquer operação destrutiva exige uma ferramenta
separada, revisão do relatório completo e confirmação específica.

## O que o relatório mostra

- IDs e referências das encomendas com `payment_method=test`, estado, valor e
  quantidades de itens relacionados.
- Transações de pagamento associadas por provedor/estado/valor, indicando
  transações concluídas ou partilhadas com mais de uma encomenda.
- Contagens de movimentos de carteira e ledger, escrow, comissões de
  afiliados, downloads, matrículas, stock logs, avaliações, devoluções,
  tickets e histórico.
- Inconsistências entre avaliações visíveis e os ratings/contadores guardados
  para produtos, lojas e cache de ratings de vendedores.
- Avaliações públicas de cursos em separado: avaliações de cursos também
  podem atualizar o rating do produto associado.

O relatório não inclui emails, nomes, telefones, moradas, documentos ou dados
de pagamento identificáveis de clientes. IDs de encomenda e de entidades são
incluídos apenas para permitir uma revisão administrativa autorizada.

## Regras de segurança

1. Preservar todas as contas de utilizadores, incluindo contas não verificadas
   ou eliminadas logicamente.
2. Preservar as encomendas e transações M-Pesa/e-Mola/VPay até reconciliar os
   identificadores e valores com os registos do provedor.
3. Uma encomenda `test` com pagamento concluído pode ter efeitos colaterais.
   Verificar cada dependência e confirmar que não representa liquidação
   financeira real antes de propor qualquer intervenção.
4. Não apagar linhas do ledger. É um histórico financeiro e não uma métrica
   descartável.
5. Ratings e contadores divergentes são apenas reportados. Não atualizá-los
   automaticamente até confirmar a origem de verdade, especialmente para
   produtos associados a cursos.
6. Antes de qualquer limpeza futura, obter backup verificável, produzir um
   plano com contagens/IDs, rever o plano e definir uma estratégia reversível
   ou compensatória. Este comando não executa essa limpeza.
7. Eliminar uma conta proprietária pode afetar compras e dados dessa pessoa
   noutras lojas. Obter uma decisão explícita depois de revisar as dependências
   por loja; não assumir que “dados relacionados à loja” são exclusivos dela.

## Eliminação aprovada das quatro lojas

Foi criado um comando separado para executar a eliminação aprovada. Esta
operação é irreversível na aplicação: remove as quatro lojas fixas, os dados
em cascata, as carteiras e pedidos de saque dos proprietários, e todas as
encomendas ligadas recursivamente por transações de pagamento partilhadas.
Consequentemente, encomendas de outras lojas e os respetivos registos
financeiros podem também ser eliminados. Todas as contas de utilizador são
preservadas. O comando não redefine métricas globais.

O comando não aceita `--force`: a execução exige um novo hash do plano e a
confirmação explícita de que existe um backup. Não execute se o inventário
apresentar encomendas, pagamentos ou valores que não estejam abrangidos pela
decisão aprovada.

### 1. Gerar e rever o plano atual

Após publicar o comando, executar no servidor a partir da pasta que contém o
`docker-compose.yml` de produção:

```bash
docker compose exec backend python manage.py purge_selected_store_data \
  7595e91f-964c-44af-8479-9b3d368f3b7f \
  2f7b76a7-c89f-4bdd-815e-e925b753cb51 \
  4f8388f9-f9e0-4a38-8d6e-f41695a87bd7 \
  b5f693a9-e200-48eb-b545-03a3bbdb874d
```

Sem `--execute`, o comando é somente de leitura. Reveja o manifesto completo,
as encomendas afetadas e o valor `impact_sha256`. O hash é calculado sobre os
IDs de todos os registos, dependências por pagamento, proprietários e ativos
externos planeados; um plano diferente exige um novo hash.

### 2. Criar e verificar um backup

Use os valores de `DB_NAME` e `DB_USER` configurados para produção no ficheiro
`.env`. No servidor Linux, um backup PostgreSQL em formato customizado pode
ser criado assim:

```bash
BACKUP_FILE="backup-before-store-purge-$(date +%F-%H%M%S).dump"
docker compose exec -T db sh -c \
  'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_FILE"
test -s "$BACKUP_FILE"
docker compose exec -T db pg_restore --list < "$BACKUP_FILE" > /dev/null
```

Confirme também que o ficheiro foi guardado fora do volume/servidor que será
alterado e, conforme o procedimento operacional, que pode ser restaurado num
ambiente isolado. Não marque o backup como verificado apenas porque o comando
de criação terminou.

### 3. Executar a eliminação (`--execute`)

Este é o comando destrutivo. Não o execute antes de rever o dry-run e
confirmar que o backup foi criado e verificado. Use o hash exato do dry-run
atual; não reutilize hashes anteriores.

Defina `IMPACT_HASH` com o valor acabado de rever:

```bash
IMPACT_HASH='cole_aqui_o_hash_sha256_do_dry_run'
docker compose exec backend python manage.py purge_selected_store_data \
  7595e91f-964c-44af-8479-9b3d368f3b7f \
  2f7b76a7-c89f-4bdd-815e-e925b753cb51 \
  4f8388f9-f9e0-4a38-8d6e-f41695a87bd7 \
  b5f693a9-e200-48eb-b545-03a3bbdb874d \
  --execute \
  --backup-verified \
  --confirm-impact "$IMPACT_HASH"
```

Se algum registo tiver mudado desde o dry-run, o comando recusa a operação e
não elimina os dados. Guarde o JSON final e verifique
`external_asset_cleanup.results`: falhas de remoção de ficheiros ou vídeos
externos são reportadas depois da transação da base de dados, com a referência
do ativo que falhou, e exigem intervenção operacional.
