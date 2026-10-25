# Mensagem para o Suporte VPay — Redirecionamento pós-pagamento

> Copiar e enviar para o suporte da VPay (email/chat do dashboard). Ajustar apenas os campos marcados com `<...>`.

---

**Assunto:** Falta de redirecionamento automático de volta ao comerciante após o pagamento no checkout hospedado

Olá, equipa VPay,

Estamos a integrar a VPay via API (`POST /v1/orders`) e a usar o checkout hospedado em `https://checkout.vpay.co.mz/{orderId}`. O fluxo de pagamento em si funciona, mas temos um problema de UX que impede o fecho correcto do pedido.

## Problema

Após o cliente introduzir o PIN e concluir o pagamento com sucesso, **permanece preso na página de checkout da VPay**. Ele não é redirecionado automaticamente de volta para a nossa loja, o que obriga o cliente a voltar manualmente — e muitos assumem que a compra falhou.

## O que observamos

1. O webhook (`payment.confirmed`) chega correctamente e actualizamos a encomenda para "paga" — esse lado está OK.
2. O checkout da VPay, ao concluir, navega para a própria página interna `checkout.vpay.co.mz/{orderId}/success`, e **não** para uma URL nossa.
3. Consultámos a documentação (`/docs/api-reference`, `/docs/webhooks`, `/docs/sdk-buttons`) e não encontrámos nenhum campo de *return URL* / *redirect URL* no payload de criação de pedido nem nas configurações do dashboard.

## O que precisamos

Uma forma oficial de o checkout redirecionar o cliente automaticamente de volta à nossa loja após o pagamento, por uma destas vias:

- **Opção A (preferida):** um campo no payload de criação do pedido, por exemplo `returnUrl` (ou equivalente), que a VPay use para redirecionar após sucesso — idealmente incluindo o `orderId` (ex.: `https://<nosso-dominio>/checkout/success?reference={orderId}`).
- **Opção B:** uma configuração global de *return URL* no dashboard do comerciante, com suporte a um placeholder para o `{orderId}`.

## Dados de contexto para facilitar a análise

- **Ambiente:** produção (`api.vpay.co.mz`, `checkout.vpay.co.mz`).
- **ID de uma encomenda de teste:** `<colar aqui o orderId do gateway, ex.: fbc4fb08-...>`.
- **URL de retorno desejada:** `https://<nosso-dominio>/checkout/success?reference={orderId}`.
- **Comportamento desejado:** no sucesso, redirecionar via `302`/`window.location` para a nossa URL de retorno (com o `orderId`); em caso de falha/cancelamento, mantemos a página actual e o cliente pode recarregar as encomendas no nosso site.

Agradecemos desde já. Se existir alguma documentação ou endpoint adicional para configurar o retorno, agradecemos que partilhem.

Obrigado,
Zawadi Digital