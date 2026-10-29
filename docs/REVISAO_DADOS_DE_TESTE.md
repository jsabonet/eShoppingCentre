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
