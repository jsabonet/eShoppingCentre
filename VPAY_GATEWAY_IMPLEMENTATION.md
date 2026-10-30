# Integração VPay

## Fluxo

1. O checkout cria as encomendas locais e solicita ao backend o início do pagamento.
2. O backend autentica com `POST /v1/auth/token`, cria um pedido com `POST /v1/orders` e redireciona para o checkout VPay usando o campo `checkout` (ou `orderId`) devolvido.
   Cada encomenda local é enviada como um item agregado pelo total final calculado no backend, para incluir descontos e portes sem confiar em valores enviados pelo browser. Cada item exige um `originProductId` único (a VPay cria o produto automaticamente na primeira vez).
3. A encomenda só é marcada como paga após confirmação do servidor: webhook `payment.confirmed` com assinatura válida ou polling em `GET /v1/orders/{order_id}/status` que confirme `status: "paid"`.
4. O webhook valida HMAC-SHA256 sobre o corpo HTTP bruto usando `X-Voidpay-Signature` no formato `sha256=<hex>`. `X-Voidpay-Delivery` é guardado para auditoria/idempotência.
5. Confirmações repetidas não repetem a liquidação do vendedor.

## Coesão do checkout (frente + painel VPay)

- O nosso checkout recolhe **contacto e entrega** (nome, telefone, email, morada) — necessários para criar a encomenda e calcular portes. O painel VPay trata **apenas do pagamento**.
- Os métodos online (`M-Pesa`, `e-Mola`, `Cartão`, `Carteira VPay`, `PayPal`, `QR Code`) estão reunidos numa única opção **"Pagamento Online (VPay)"** no nosso checkout. A escolha do método concreto é feita no painel VPay, para não repetir a seleção entre as duas páginas.
- O backend envia sempre `shippingAddressDisabled: true` e `deliveryInfoDisabled: true`, de modo que o painel VPay nunca volta a pedir morada/dados de entrega — mesmo em encomendas físicas (a morada continua a ser enviada no campo `shippingAddress` para registo).
- O cliente é informado, antes de ser redirecionado, do que vai acontecer no painel VPay (escolher método, introduzir número nas carteiras móveis e confirmar com PIN).

## Configuração

Defina estas variáveis no ambiente do backend. Não coloque credenciais em código, frontend, commits ou logs.

- `VPAY_BASE_URL` (padrão `https://api.vpay.co.mz`)
- `VPAY_CHECKOUT_BASE_URL` (padrão `https://checkout.vpay.co.mz`)
- `VPAY_CLIENT_ID`
- `VPAY_CLIENT_SECRET`
- `VPAY_WEBHOOK_SECRET`

Registe no dashboard VPay a URL pública HTTPS do webhook. O endpoint local é `POST /api/v1/payments/webhook/vpay/` (a VPay envia o webhook para a URL configurada no dashboard, não por pedido).

## Fontes da integração

- [Referência da API](https://vpay.co.mz/docs/api-reference)
- [Autenticação](https://vpay.co.mz/docs/authentication)
- [Polling do estado do pedido](https://vpay.co.mz/docs/api-reference/polling)
- [Webhooks](https://vpay.co.mz/docs/webhooks)
- [SDK de checkout](https://vpay.co.mz/docs/sdk-buttons)

## Contrato confirmado contra a API real

Validado em `2026-10-23` com credenciais reais (sem cobrança):

- Autenticação: `POST https://api.vpay.co.mz/v1/auth/token` → `{"success":true,"data":{"access_token":...,"refresh_token":...,"token_type":"Bearer","expires_in":3600,...}}`.
- Criar pedido: `POST https://api.vpay.co.mz/v1/orders` → `201` com `{"success":true,"orderId":...,"totalAmount":...,"currency":"MZN","checkout":"https://checkout.vpay.co.mz/{orderId}","data":{...,"status":"pending",...}}`.
- Cada item do pedido exige `productId` **ou** `originProductId`; caso contrário a API devolve `400` `VALIDATION_ERROR`.
- Consultar estado: `GET https://api.vpay.co.mz/v1/orders/{orderId}/status` → `{"success":true,"data":{"orderId":...,"status":"pending|paid|failed|cancelled","amount":...,"transactionId":...,"lastUpdated":...}}`. A resposta documentada não inclui `currency`; para `paid`, validamos o montante e a moeda MZN guardada na tentativa local. Se a VPay enviar `currency`, também confirmamos que corresponde à tentativa.

Nota: a página pública `/docs/api-reference/api-collection` lista caminhos `/api/...`, mas a API real responde em `/v1/...` (a `/api/...` devolve 404). A integração usa `/v1/...`, confirmado em produção.

As credenciais `client_id`, `client_secret` e o segredo de webhook são obtidos no dashboard VPay e ficam no `backend/.env` (não versionado).
