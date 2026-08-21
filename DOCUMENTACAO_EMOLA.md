# eShoppingCentre — Documentação para Integração e-Mola

> Destinatário: Equipa de Parcerias e-Mola (Moçambique)
> Data: 07 de Agosto de 2026
> Assunto: Solicitação de Integração do Método de Pagamento e-Mola

---

## 1. Sobre o eShoppingCentre

O **eShoppingCentre** é um marketplace digital moçambicano que conecta vendedores e compradores em todo o país. A plataforma permite:

- 🛍️ **Lojas físicas** — venda de produtos com stock e entrega
- 📥 **Lojas digitais** — venda de produtos para download imediato
- 🎓 **Cursos online** — venda de cursos com aulas em vídeo e certificados

**Website**: https://e-shoppingcentre.com
**Domínio**: e-shoppingcentre.com

---

## 2. Arquitectura de Pagamentos

### 2.1 Fluxo de Pagamento

```
Utilizador           eShoppingCentre           Provedor (e-Mola)
   │                      │                         │
   │ 1. Escolhe produto   │                         │
   │─────────────────────>│                         │
   │                      │ 2. Cria Order #PED-XXX  │
   │                      │ 3. Cria PaymentTransaction│
   │                      │    (provider='emola',    │
   │                      │     status='pending')    │
   │ 4. Redireciona para  │                         │
   │    pagamento e-Mola  │                         │
   │<─────────────────────│                         │
   │                      │                         │
   │ 5. Usuário paga      │                         │
   │──────────────────────────────────────────────>│
   │                      │                         │
   │                      │ 6. Callback/webhook     │
   │                      │<────────────────────────│
   │                      │    transaction_id +      │
   │                      │    status + amount       │
   │                      │                         │
   │                      │ 7. Confirma pagamento   │
   │                      │    status='completed'    │
   │                      │ 8. Activa produto/curso │
   │                      │                         │
   │ 9. Confirmação       │                         │
   │<─────────────────────│                         │
```

### 2.2 Modelo de Dados

```python
class PaymentTransaction(BaseModel):
    order = ForeignKey('Order')
    provider = 'emola'  # identificador do provedor
    provider_transaction_id = ''  # ID da transação no e-Mola
    amount = Decimal (MZN)
    currency = 'MZN'
    status = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
    provider_response = JSON  # resposta completa do callback
    error_message = ''
    completed_at = DateTime
```

### 2.3 Estados da Transação

| Estado | Descrição | Quando |
|--------|-----------|--------|
| `pending` | Aguardando pagamento | Criada ao iniciar checkout |
| `processing` | Em processamento | Callback recebido, a verificar |
| `completed` | Pago com sucesso | Pagamento confirmado pelo e-Mola |
| `failed` | Falhou | Pagamento recusado ou expirado |
| `refunded` | Reembolsado | Devolução processada |

### 2.4 Montantes

- **Moeda**: MZN (Metical Moçambicano)
- **Ticket médio estimado**: 200 - 500 MZN
- **Volume mensal projectado**: 1.000 - 5.000 transacções (crescendo)
- **Pico diário estimado**: 200 transacções

---

## 3. Endpoints de Integração

### 3.1 Endpoint de Callback / Webhook

O eShoppingCentre disponibiliza um endpoint REST para receber notificações de pagamento:

```
POST https://e-shoppingcentre.com/api/v1/payments/emola/callback/
Content-Type: application/json
Authorization: Bearer <api-key-configurável>
```

**Payload esperado** (a adaptar conforme especificação e-Mola):
```json
{
  "transaction_id": "EMOLA-123456789",
  "order_id": "PED-ABC12345",
  "amount": 250.00,
  "currency": "MZN",
  "status": "completed",
  "payer_phone": "258XXXXXXXXX",
  "timestamp": "2026-08-07T15:30:00Z"
}
```

**Resposta**:
```json
{
  "success": true,
  "order_status": "confirmed"
}
```

### 3.2 Redirecionamento de Pagamento

O utilizador é redirecionado para a página de pagamento e-Mola com:
- URL de retorno: `https://e-shoppingcentre.com/checkout/return/?order=PED-XXX`
- URL de cancelamento: `https://e-shoppingcentre.com/checkout/cancel/?order=PED-XXX`

---

## 4. Requisitos Técnicos da Nossa Parte

### 4.1 Já Implementado
- ✅ Modelo `PaymentTransaction` com suporte a múltiplos provedores
- ✅ `provider='emola'` já registado como opção
- ✅ Sistema de encomendas (`Order`) com ciclo de vida completo
- ✅ Callback endpoint preparado para receber notificações
- ✅ HTTPS/TLS em produção (certificado SSL via Let's Encrypt)
- ✅ Servidor em Digital Ocean (Ubuntu, Frankfurt)
- ✅ Base de dados PostgreSQL com backups diários

### 4.2 A Implementar (após acesso à API e-Mola)
- ⏳ Handler específico para o callback e-Mola
- ⏳ Integração com o SDK/API REST do e-Mola
- ⏳ Interface de pagamento no frontend (redirecionamento ou modal)
- ⏳ Reconciliação automática de transações

---

## 5. Documentação Necessária (Para Submeter ao e-Mola)

### 5.1 Documentos da Empresa

| Documento | Arquivo |
|-----------|---------|
| NUIT (Número Único de Identificação Tributária) | `NUIT.pdf` |
| Certidão de Registo Comercial | `registo_comercial.pdf` |
| Licença de Actividade Comercial | `licenca_comercial.pdf` |
| Alvará (se aplicável) | `alvara.pdf` |

### 5.2 Documentos do Representante

| Documento | Arquivo |
|-----------|---------|
| Bilhete de Identidade (BI) ou Passaporte | `BI_representante.pdf` |
| Comprovativo de Morada | `comprovativo_morada.pdf` |
| Declaração de Titularidade da Conta | `declaracao_titularidade.pdf` |

### 5.3 Documentos Técnicos

| Documento | Arquivo |
|-----------|---------|
| Descrição do modelo de negócio | Este documento |
| Diagrama de fluxo de pagamento | Ver secção 2.1 |
| URL de callback para notificações | `https://e-shoppingcentre.com/api/v1/payments/emola/callback/` |
| Certificado SSL | Emitido via Let's Encrypt (renovação automática) |
| Política de Privacidade | `https://e-shoppingcentre.com/privacy` |
| Termos de Uso | `https://e-shoppingcentre.com/terms` |

### 5.4 Dados Bancários (Para Liquidação)

| Dado | Valor |
|------|-------|
| Banco | [Nome do Banco] |
| Número de Conta | [IBAN / Nº Conta] |
| Titular da Conta | [Nome do Titular] |
| NIB | [NIB] |

---

## 6. Informações de Contacto

| Campo | Valor |
|-------|-------|
| **Nome da Empresa** | eShoppingCentre |
| **Website** | https://e-shoppingcentre.com |
| **Email de Contacto** | [admin@e-shoppingcentre.com](mailto:admin@e-shoppingcentre.com) |
| **Telefone** | [+258 84 742 3900](tel:+258847423900) |
| **Endereço Físico** | [Endereço da sede em Moçambique] |
| **Responsável Técnico** | Joel Sabonet |
| **Email Técnico** | [dev@e-shoppingcentre.com](mailto:dev@e-shoppingcentre.com) |

---

## 7. Volumes e Projecções

| Métrica | Valor Actual | Projecção 6 meses |
|---------|-------------|-------------------|
| Lojas activas | 5+ | 50+ |
| Produtos listados | 10+ | 500+ |
| Utilizadores registados | 50+ | 1.000+ |
| Transacções/mês | Em fase inicial | 1.000 - 5.000 |
| Volume financeiro/mês | Em fase inicial | 50.000 - 250.000 MZN |

---

## 8. Próximos Passos (Após Aprovação)

1. Receber credenciais de sandbox/teste do e-Mola
2. Implementar integração com a API/SDK do e-Mola
3. Testar fluxo completo em ambiente de testes
4. Submeter para revisão e aprovação final
5. Activar em produção

---

**eShoppingCentre** — O Marketplace de Moçambique 🇲🇿
