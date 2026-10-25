# Análise de faturação e relatórios

## Objetivo e âmbito

Esta análise considera faturação como documentos para compradores e vendedores, e relatórios como painéis operacionais e reconciliação financeira.

O projeto já regista encomendas, pagamentos, saldos, comissões e saques, mas esses registos ainda não formam um sistema completo de faturação e relatórios.

## Áreas que necessitam de atenção

| Área | Estado identificado | O que precisa ser tratado e porquê |
|---|---|---|
| **Dados fiscais de vendedores e compradores** | A loja permite carregar um documento fiscal, mas não foram encontrados dados estruturados como NUIT, nome fiscal ou endereço fiscal. O perfil do comprador também não apresenta esses campos. Referências: `backend/apps/stores/models.py` e `backend/apps/users/models.py`. | Definir que dados fiscais são necessários, de quem são recolhidos e como são validados. Sem esses dados, os documentos podem sair incompletos ou conter informação que não pode ser corrigida de forma adequada depois da emissão. |
| **Faturas e recibos de encomenda** | A encomenda guarda totais, desconto, frete e linhas com nome, quantidade e preço, mas não foi encontrado um modelo de fatura ou recibo, nem número ou cópia fiscal do documento. Referência: `backend/apps/orders/models.py`. | Definir quais documentos serão emitidos, quem os emite e em que momento. Um email de confirmação ou registo do gateway não substitui automaticamente uma fatura fiscal. |
| **Pagamentos, cancelamentos e reembolsos** | Existem registos de transações da VPay, confirmação idempotente de pagamentos, estados de encomenda, devoluções e movimentos da carteira. Referências: `backend/apps/payments/models.py`, `backend/apps/payments/services/completion.py` e `backend/apps/wallet/services.py`. | Os relatórios devem distinguir valor encomendado, efetivamente pago, reembolsado e ainda pendente. Se uma fatura já tiver sido emitida, o reembolso deve ter o tratamento documental correspondente; não basta alterar o estado da encomenda. |
| **Relatórios do vendedor** | A página de ganhos permite filtrar por período e descarregar um CSV detalhado de encomendas e itens. O relatório inclui vendas, reembolsos registados e uma estimativa da receita líquida do vendedor. Os valores por produto continuam brutos quando não há alocação de desconto/reembolso à linha. Referências: `backend/apps/stores/views_earnings.py` e `frontend/app/seller/earnings/page.tsx`. | Se for necessário um valor líquido rigoroso por produto, guardar a alocação de descontos e reembolsos às linhas. O relatório atual é operacional e não fiscal. |
| **Reconciliação financeira da plataforma** | A reconciliação filtra pagamentos concluídos, evita duplicar o saldo reservado e inclui saques de afiliados. Também apresenta separadamente os totais pagos via gateway, carteira e pagamento de teste simulado. Referências: `backend/apps/wallet/views.py` e `frontend/src/components/admin/AdminWallet.tsx`. | Continuar a tratar os totais como reconciliação operacional, não como contabilidade fiscal: pagamentos e reembolsos externos ainda exigem conciliação com os extratos do gateway. |
| **Checkout dividido entre lojas** | O checkout pode gerar encomendas separadas por loja, enquanto a confirmação do pagamento pode tratar várias encomendas associadas ao mesmo pagamento. Referências: `backend/apps/payments/views.py` e `backend/apps/orders/serializers.py`. | Definir se cada vendedor emite o documento da respetiva venda e como o pagamento agregado se liga às faturas. O relatório deve evitar contar o pagamento agregado mais de uma vez ou perder a associação a alguma encomenda. |
| **Pesquisa, exportação e auditoria** | O relatório financeiro do vendedor é exportável em CSV e cada geração guarda loja, utilizador, período, critérios e totais, com consulta no Django Admin. | Excel/PDF e outros relatórios ainda não estão implementados. A auditoria atual cobre a exportação do vendedor, não todas as consultas ou relatórios administrativos. |

## Sequência recomendada

### 1. Validar as regras fiscais e comerciais

Confirmar com um contabilista ou especialista local os dados necessários, os tipos de documentos, a numeração, o tratamento de impostos e as regras para devoluções. As regras fiscais não devem ser fixadas no código sem essa validação.

### 2. Criar um registo documental imutável

Guardar o número e a data de cada documento, a encomenda e o pagamento associados e uma cópia dos dados do comprador, vendedor, produtos e valores usados na emissão. Assim, alterações futuras no perfil ou no produto não modificam documentos já emitidos.

### 3. Separar documentos de venda dos documentos da plataforma

A responsabilidade pela fatura ao comprador e pela documentação das comissões cobradas ao vendedor depende do modelo comercial e da validação fiscal. O sistema deve suportar essa separação, em vez de tratar um email ou comprovativo do gateway como se cobrisse todos os documentos necessários.

### 4. Corrigir e padronizar os valores financeiros

Usar pagamentos confirmados e movimentos de reembolso para distinguir valores brutos, líquidos, pendentes e pagos. Corrigir a reconciliação antes de a usar como fonte contabilística.

### 5. Adicionar relatórios por perfil e período

- **Comprador:** encomendas e documentos disponíveis.
- **Vendedor:** vendas, valores líquidos, comissões, reembolsos e liquidações.
- **Administração:** pagamentos, comissões, saques, escrow, reembolsos e passivos.

Os relatórios devem incluir filtros por período e estado e opções de exportação adequadas.

### 6. Validar cenários de fronteira

Testar checkout dividido entre lojas, pagamentos pendentes ou tardios, cancelamentos, reembolsos parciais e totais, descontos, comissões de afiliados e saques.

## Prioridade imediata

1. Corrigir a reconciliação administrativa e as métricas de vendas.
2. Definir os dados fiscais necessários e a responsabilidade pela emissão de documentos.
3. Implementar a emissão documental e expandir os relatórios sobre uma base financeira consistente.

## Implementação técnica da prioridade 1

Foi corrigida a reconciliação e a origem das métricas existentes:

- A reconciliação soma taxas apenas de encomendas com pagamento confirmado e apresenta separadamente pagamentos confirmados, reembolsos creditados na carteira e o valor após esses reembolsos.
- O passivo estimado inclui saldos de saque, escrow retido, saldos compráveis dos compradores e comissões aprovadas ainda não creditadas. O saldo reservado para saques é apresentado separadamente, mas não é somado novamente, porque já faz parte do saldo de saque.
- Saques e comissões de afiliados passaram a ser incluídos nos totais relevantes.
- A aprovação automática de comissões agora credita também a carteira do afiliado, de forma idempotente e na mesma transação da aprovação.
- As métricas da loja contam apenas encomendas pagas nas vendas do dia e na receita. A receita desconta reembolsos efetivamente creditados na carteira.
- Os produtos mais vendidos e a receita por produto são calculados a partir das quantidades e dos valores históricos das linhas de encomenda pagas, em vez de usar o preço atual e o contador acumulado do produto.
- A receita total e mensal apresentada no detalhe administrativo da loja usa a mesma regra de encomendas pagas menos reembolsos creditados.
- A página de ganhos permite descarregar CSV por data inicial/final (máximo 366 dias e 50.000 linhas), com resumo agregado e detalhe por encomenda/linha. A data do filtro é `Order.created_at`; apenas encomendas pagas e não canceladas são incluídas.
- O CSV distingue vendas brutas, reembolsos registados, vendas líquidas, comissão/taxa da plataforma e receita líquida estimada do vendedor. Os totais da encomenda são impressos uma única vez, na primeira linha de item, para não duplicar somas ao abrir no Excel.
- Cada exportação grava loja, identidade do utilizador, IP, agente do utilizador, período, critérios e totais em `StoreReportExport`; o registo é somente leitura no Django Admin. O CSV inclui a referência do registo de auditoria e neutraliza valores textuais que poderiam ser interpretados como fórmulas de folha de cálculo.

Os reembolsos considerados nestes cálculos são créditos registados na carteira do comprador, não devoluções externas processadas pelo gateway. As vendas por produto mostram os valores pagos das linhas; como o reembolso não regista a linha específica devolvida, não é possível atribuir com rigor um reembolso parcial a um produto específico.

## Fragilidades financeiras adicionais corrigidas

- **Devoluções e reembolsos:** a criação de devoluções valida titularidade da encomenda, pagamento concluído e estado elegível. Os reembolsos usam como valor predefinido apenas o saldo ainda reembolsável, rejeitam valores acima desse saldo e usam a devolução como chave de idempotência. Reembolsos parciais reduzem proporcionalmente o escrow e só marcam a encomenda como totalmente reembolsada quando o total é atingido.
- **Saldo insuficiente do vendedor:** se o vendedor já não tiver saldo suficiente para o reembolso, a operação é recusada para revisão administrativa; o reembolso não cria saldo negativo nem débito parcial inconsistente.
- **Comissões de afiliados:** a comissão do checkout dividido é calculada por encomenda/loja, considerando apenas produtos elegíveis e o desconto aplicado. A conversão só é contabilizada depois da confirmação de pagamento. Reembolsos revertem a comissão proporcionalmente; a parte que já não pode ser recuperada do saldo disponível fica registada como dívida e é compensada com comissões futuras, sem bloquear o reembolso do comprador.
- **Saques:** a carteira é bloqueada durante a reserva do saque. Os pedidos de saque de afiliados também descontam reservas pendentes e bloqueiam o perfil, evitando pedidos concorrentes acima do saldo.
- **Separação das fontes de pagamento:** a reconciliação não trata pagamentos com carteira ou testes simulados como recebimentos do gateway. O cartão do painel mostra essas categorias separadamente.

Os testes de regressão cobrem os valores financeiros por fonte, métricas da loja, reembolsos parciais/idempotentes e limitados ao valor reembolsável, escrow proporcional, dívidas de clawback, titularidade de devoluções, conversões após pagamento e comissão em checkout dividido.

## Limitações ainda existentes

- Não há emissão de faturas/recibos fiscais, identificação fiscal estruturada, numeração documental imutável nem validação de regras fiscais locais.
- A reconciliação não substitui a importação/conferência dos extratos do gateway, nem modela estornos externos como movimentos de gateway separados.
- A receita por produto é calculada com o valor bruto histórico das linhas pagas. Como o modelo não associa reembolsos parciais a linhas específicas, não se deve interpretar esse indicador como receita líquida fiscal por produto.
- Não há exportação financeira para Excel/PDF nem emissão de documentos fiscais. O CSV do vendedor é operacional, não fiscal.
- O relatório seleciona encomendas pela data de criação, mas deduz reembolsos já registados para essas encomendas até ao momento da exportação; um relatório de um período antigo pode, por isso, refletir reembolsos lançados posteriormente.
- O valor histórico da linha não aloca o desconto da encomenda. A parcela de estorno do vendedor é proporcional e arredondada por reembolso, mas o relatório não substitui um ledger contabilístico nem prova um estorno externo no gateway.

## Auditoria adicional: estados do gateway e encomendas pendentes

A revisão identificou riscos de corridas entre a VPay, o polling do cliente, os webhooks e a expiração da reserva. As correções implementadas agora são:

| Risco identificado | Tratamento implementado |
|---|---|
| Repetir uma iniciação podia criar cobranças e perder a referência anterior; encomendas canceladas ou expiradas também podiam iniciar pagamento. | Tentativas VPay são registadas antes da chamada externa, associadas a todas as encomendas do checkout e reutilizadas enquanto abertas. A iniciação valida estado e prazo da reserva; um resultado ambíguo permanece em processamento e bloqueia nova tentativa automática. |
| Uma resposta terminal `failed`/`cancelled` deixava a encomenda pendente e a reserva de stock retida. | O estado terminal é aplicado com lock, cancela a encomenda e restaura stock uma única vez. A expiração também consulta primeiro a VPay e volta a validar estado e prazo sob lock antes de cancelar. |
| Pagamentos recebidos após cancelamento ou numa tentativa substituída podiam não aparecer como passivo nem ser liquidados de forma segura. | São marcados `refund_pending`, associados à tentativa e apresentados na reconciliação administrativa. Não liquidam o vendedor nem libertam conteúdo; exigem revisão e reembolso. |
| Cancelar uma encomenda paga podia creditar o comprador sem debitar a carteira do vendedor e sem expirar os acessos digitais associados. | O cancelamento pago usa o fluxo de reembolso idempotente, considera apenas o saldo ainda reembolsável, reverte escrow/comissões e expira downloads/matrículas depois do reembolso integral. |
| Um polling antigo podia sobrescrever uma confirmação feita pelo webhook. | Confirmação e falha bloqueiam a tentativa e a encomenda; uma falha tardia não substitui uma tentativa concluída nem uma encomenda já paga. |
| O comprador podia sair antes da confirmação ou o webhook podia não chegar. | A tarefa `reconcile_vpay_pending_payments` consulta tentativas abertas no servidor, com intervalo mínimo de cinco minutos. A tarefa periódica está incluída no agendamento Celery. |
| O checkout dividido associava a tentativa apenas a uma encomenda e os identificadores externos não tinham unicidade por provedor. | A tentativa mantém relação com todas as encomendas; os IDs de pedido e transação VPay são campos distintos e únicos por provedor quando preenchidos. |

Os testes de regressão cobrem reutilização de tentativa, bloqueio de encomenda cancelada, resultado ambíguo sem repetição automática, falha terminal, pagamento tardio, corrida polling/webhook, checkout dividido e reembolso total após um reembolso parcial anterior.

### Limitações operacionais

- A aplicação regista pagamentos que requerem reembolso, mas não executa automaticamente um estorno externo na VPay. A equipa administrativa ainda precisa realizar o reembolso no gateway e confirmar essa operação; `refund_pending` é uma fila de exceções/passivos, não prova de estorno feito.
- Se a criação na VPay terminar com timeout sem devolver `orderId` e o gateway não ecoar `sourceId` no webhook, não há referência suficiente para consulta automática servidor-a-servidor. O caso fica em processamento, bloqueia nova cobrança e é registado para reconciliação manual.
- As constraints de unicidade das novas referências podem falhar durante a migração se existirem IDs duplicados nos dados históricos; deve-se verificar e resolver duplicados antes de aplicar em produção.
- A análise é estática e os testes usam respostas simuladas. Não foi feita consulta ao ambiente de produção nem comparação com extratos reais; não é possível afirmar que já não existem divergências históricas na VPay.

## Nota

Esta análise é um diagnóstico técnico e uma proposta de sequência. Não substitui validação contabilística ou jurídica das obrigações fiscais aplicáveis.
