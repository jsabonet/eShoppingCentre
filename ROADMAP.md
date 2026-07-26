# 🗺️ eShoppingCentre — Roadmap de Funcionalidades

> Guia completo de todas as funcionalidades a implementar, organizadas por módulo e prioridade.
> Legenda: 🔴 Alta | 🟡 Média | 🟢 Baixa | ✅ Implementado

---

## 📦 1. Produtos

### 1.1 Variantes de Produto 🔴
| # | Funcionalidade | Tipo | Descrição |
|---|---------------|------|-----------|
| 1.1.1 | Atributos de variante | Física | Tamanho, cor, material, capacidade — configuráveis por categoria |
| 1.1.2 | SKU por variante | Física | Cada variante com seu próprio SKU, preço, stock e imagem |
| 1.1.3 | Preço diferencial | Física | Variante pode ter preço diferente do produto base |
| 1.1.4 | Imagens por variante | Física | Cada variante mostra a sua imagem (ex: camisola azul vs vermelha) |
| 1.1.5 | Stock por variante | Física | Gestão de inventário individual por variante |
| 1.1.6 | Galeria de imagens | Todas | Múltiplas imagens por produto com zoom e slider |
| 1.1.7 | Vídeo do produto | Todas | Upload ou link YouTube/Vimeo embedado |

### 1.2 Tipos de Produto
| # | Funcionalidade | Tipo | Descrição |
|---|---------------|------|-----------|
| 1.2.1 | Produto Físico ✅ | Física | Nome, descrição, preço, stock, SKU, peso, dimensões, imagens |
| 1.2.2 | Produto Digital ✅ | Digital | Upload de ficheiro (PDF, ZIP, MP3, etc.), download após compra |
| 1.2.3 | Curso ✅ | Curso | Módulos, aulas, vídeos embebidos, recursos descarregáveis |
| 1.2.4 | Pré-venda / Backorder 🟢 | Física | Vender sem stock, com data prevista de chegada |
| 1.2.5 | Assinatura / Recorrente 🟢 | Digital | Pagamento mensal/anual com renovação automática |
| 1.2.6 | Serviço / Agendamento 🟢 | Curso | Marcação de consultoria, mentoria, serviço presencial |

### 1.3 Gestão de Inventário
| # | Funcionalidade | Tipo | Descrição |
|---|---------------|------|-----------|
| 1.3.1 | Alerta de stock baixo 🔴 | Física | Notificação no dashboard e email quando stock < X unidades |
| 1.3.2 | Histórico de stock 🟡 | Física | Log de alterações: quando, quem, quantidade anterior/nova |
| 1.3.3 | Importação em massa 🟡 | Todas | Upload CSV/Excel para criar/actualizar múltiplos produtos |
| 1.3.4 | Exportação 🟢 | Todas | Exportar catálogo para CSV/Excel |
| 1.3.5 | Produtos duplicados 🟢 | Todas | Clonar produto com um clique |

### 1.4 SEO & Conteúdo
| # | Funcionalidade | Tipo | Descrição |
|---|---------------|------|-----------|
| 1.4.1 | Meta title por produto 🟡 | Todas | Título SEO customizável |
| 1.4.2 | Meta description por produto 🟡 | Todas | Descrição SEO customizável |
| 1.4.3 | OG Image por produto 🟡 | Todas | Imagem para partilha em redes sociais |
| 1.4.4 | Slug customizável 🟡 | Todas | URL amigável editável pelo vendor |
| 1.4.5 | Especificações técnicas 🟡 | Física | Tabela de specs (marca, modelo, garantia, etc.) |

---

## 🏪 2. Lojas / Vendedores

### 2.1 Registo & Aprovação
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 2.1.1 | Formulário multi-passo ✅ | 3 passos: info loja → dados vendedor → políticas |
| 2.1.2 | Upload de documentos ✅ | BI frente/verso, NUIT |
| 2.1.3 | Aprovação manual pelo admin ✅ | Status: pending → active / rejected |
| 2.1.4 | Email de notificação 🔴 | Email ao vendor quando loja é aprovada/rejeitada |
| 2.1.5 | Motivo de rejeição 🔴 | Admin escreve razão para o vendor corrigir |

### 2.2 Customização Visual
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 2.2.1 | Logótipo ✅ | Upload, preview, remover |
| 2.2.2 | Banner/Capa ✅ | Upload, preview, remover |
| 2.2.3 | Cor temática ✅ | 8 cores pré-definidas para identidade visual |
| 2.2.4 | Slogan/Tagline ✅ | Frase curta abaixo do nome |
| 2.2.5 | Descrição & Sobre ✅ | Texto institucional da loja |
| 2.2.6 | Layout de vitrine 🟡 | Grid vs lista, nº de colunas, ordem de produtos |
| 2.2.7 | Hero section configurável 🟢 | Banner com CTA, overlay de texto, link |
| 2.2.8 | Secções em destaque 🟢 | Escolher quais categorias/produtos aparecem primeiro |

### 2.3 Identidade & Confiança
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 2.3.1 | Selo "Verificado" ✅ | Aparece na página da loja |
| 2.3.2 | Níveis de vendedor 🔴 | Bronze, Prata, Ouro, Diamante — baseado em vendas e avaliações |
| 2.3.3 | Selo "Loja Oficial" 🟡 | Para marcas registadas |
| 2.3.4 | Selo "Top Seller" 🟡 | Destaque para melhores vendedores do mês |
| 2.3.5 | Tempo de resposta médio 🟡 | "Responde em < 2h" visível na página da loja |
| 2.3.6 | Políticas de loja ✅ | Envio, devolução visíveis na página |

### 2.4 Equipa / Múltiplos Admins
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 2.4.1 | Convidar membros 🟡 | Dono convida por email |
| 2.4.2 | Perfis de permissão 🟡 | Admin total, Gestor de Produtos, Gestor de Encomendas, Financeiro, Suporte |
| 2.4.3 | Log de acções 🟡 | Registo de quem fez o quê e quando |
| 2.4.4 | Remover membro 🟡 | Revogar acesso a qualquer momento |
| 2.4.5 | Login como membro 🟢 | Dono pode fazer "login as" para ver o que o membro vê |

---

## 🛒 3. Encomendas

### 3.1 Gestão de Encomendas
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 3.1.1 | Dashboard de encomendas ✅ | Lista, filtros, busca |
| 3.1.2 | Estados da encomenda ✅ | Pendente → Confirmado → Enviado → Entregue → Cancelado |
| 3.1.3 | Tracking code 🟡 | Número de rastreio + transportadora |
| 3.1.4 | Notas internas 🟡 | Vendor adiciona notas visíveis só para a equipa |
| 3.1.5 | Impressão de factura 🟡 | PDF com dados da encomenda para imprimir |
| 3.1.6 | Guia de remessa 🟢 | PDF para colar na embalagem |
| 3.1.7 | Encomendas em massa 🟢 | Processar múltiplas encomendas de uma vez |

### 3.2 After-Sales & Devoluções
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 3.2.1 | Pedido de devolução 🔴 | Cliente inicia pedido de devolução/reembolso |
| 3.2.2 | Aprovação pelo vendor 🔴 | Vendor aprova ou recusa com justificação |
| 3.2.3 | Estados da devolução 🔴 | Solicitado → Aprovado → Enviado → Recebido → Reembolsado |
| 3.2.4 | RMA number 🟡 | Número único de autorização de devolução |
| 3.2.5 | Política por produto 🟡 | Prazo de devolução diferente por categoria |
| 3.2.6 | Disputas 🟢 | Escalada para admin quando vendor e cliente não concordam |

### 3.3 Carrinho & Checkout
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 3.3.1 | Carrinho multi-loja ✅ | Produtos de várias lojas no mesmo carrinho |
| 3.3.2 | Cálculo de frete 🔴 | Por peso, dimensões e localização |
| 3.3.3 | Cupão de desconto 🔴 | Aplicar código no checkout |
| 3.3.4 | Checkout como convidado 🟡 | Comprar sem criar conta |
| 3.3.5 | Recuperação de carrinho 🟡 | Email automático após abandono |
| 3.3.6 | Estimativa de entrega 🟡 | Data prevista baseada na transportadora e localização |
| 3.3.7 | Upsell/Cross-sell 🟢 | "Quem comprou X também comprou Y" |

---

## 💰 4. Pagamentos & Finanças

### 4.1 Métodos de Pagamento
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 4.1.1 | M-Pesa ✅ | Integração via API Vodacom |
| 4.1.2 | e-Mola ✅ | Integração via API Movitel |
| 4.1.3 | Cartão (Visa/MC) ✅ | Integração gateway de pagamento |
| 4.1.4 | Carteira interna ✅ | Saldo na plataforma, top-up |
| 4.1.5 | Referência bancária 🟡 | Pagamento por transferência com referência |
| 4.1.6 | Pagamento na entrega 🟡 | Cash on delivery (COD) |
| 4.1.7 | PIX (futuro) 🟢 | Integração com sistema brasileiro |

### 4.2 Carteira do Vendedor
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 4.2.1 | Saldo disponível ✅ | Quanto pode levantar |
| 4.2.2 | Histórico de transações ✅ | Entradas (vendas) e saídas (comissões, levantamentos) |
| 4.2.3 | Comissão da plataforma 🔴 | % automática deduzida de cada venda |
| 4.2.4 | Período de retenção 🔴 | Fundos só disponíveis após X dias (protecção comprador) |
| 4.2.5 | Levantamento 🔴 | Vendor solicita transferência para M-Pesa/e-Mola/conta bancária |
| 4.2.6 | Relatório fiscal 🟡 | Resumo mensal/anual para contabilidade |
| 4.2.7 | Facturação automática 🟡 | Emissão de factura por cada venda |

### 4.3 Taxas & Comissões
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 4.3.1 | Comissão por categoria 🟡 | % diferente por tipo de produto |
| 4.3.2 | Comissão por nível de vendedor 🟡 | Top sellers pagam menos |
| 4.3.3 | Taxa de levantamento 🟡 | Valor fixo ou % por cada levantamento |
| 4.3.4 | Plano premium 🟢 | Subscrição mensal com benefícios (menos comissão, destaque) |

---

## 🎫 5. Cupões & Promoções

### 5.1 Sistema de Cupões 🔴
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 5.1.1 | Criar cupão | Vendor define código, tipo (% ou valor fixo), desconto |
| 5.1.2 | Data de validade | Início e fim da campanha |
| 5.1.3 | Limite de uso | Máximo de utilizações total e por cliente |
| 5.1.4 | Valor mínimo de compra | Cupão só aplica acima de X MZN |
| 5.1.5 | Por produto/categoria | Restringir a produtos ou categorias específicas |
| 5.1.6 | Dashboard de cupões | Lista de cupões activos, expirados, uso |
| 5.1.7 | Métricas | Quantas vezes usado, receita gerada, desconto total concedido |

### 5.2 Flash Sales 🟡
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 5.2.1 | Criar flash sale | Vendor define produto, preço promocional, duração |
| 5.2.2 | Countdown visível | Temporizador na página do produto |
| 5.2.3 | Stock limitado | Quantidade disponível na promoção |
| 5.2.4 | Badge visual | "Flash Sale" no card do produto |
| 5.2.5 | Agendamento | Programar flash sale para data futura |

### 5.3 Descontos por Volume 🟢
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 5.3.1 | Preço por quantidade | "Leve 2, pague 1" ou desconto progressivo |
| 5.3.2 | Kits/Bundles | Vendor cria pacotes de produtos com desconto |
| 5.3.3 | Frete grátis | Acima de valor X, frete é oferecido |

---

## 💬 6. Comunicação

### 6.1 Chat Vendor-Cliente 🔴
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 6.1.1 | Chat em tempo real | WebSocket (Django Channels já instalado) |
| 6.1.2 | Conversa por produto | Chat inicia na página do produto |
| 6.1.3 | Conversa por encomenda | Chat vinculado a uma encomenda específica |
| 6.1.4 | Indicador online | "Vendedor online/offline" |
| 6.1.5 | Envio de imagens | Partilhar fotos no chat |
| 6.1.6 | Respostas rápidas | Templates de mensagens pré-definidas |
| 6.1.7 | Histórico | Todas as conversas guardadas e pesquisáveis |
| 6.1.8 | Notificações | Badge no ícone, email quando nova mensagem |

### 6.2 Notificações
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 6.2.1 | Notificações no site ✅ | Bell icon com dropdown de notificações |
| 6.2.2 | Email transacional 🔴 | Nova encomenda, pagamento confirmado, envio, entrega |
| 6.2.3 | Push notifications 🟡 | Browser push para eventos importantes |
| 6.2.4 | SMS 🟡 | Alertas por SMS (M-Pesa, e-Mola) |
| 6.2.5 | Centro de notificações 🟡 | Página dedicada com histórico e filtros |
| 6.2.6 | Preferências 🟡 | Vendor escolhe quais notificações recebe e por que canal |

### 6.3 Reviews & Perguntas
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 6.3.1 | Avaliação com estrelas ✅ | 1-5 estrelas por produto |
| 6.3.2 | Review com foto 🟡 | Cliente anexa foto ao review |
| 6.3.3 | Resposta do vendor 🟡 | Vendor responde publicamente a cada review |
| 6.3.4 | Q&A por produto 🟡 | Clientes fazem perguntas, vendor responde |
| 6.3.5 | Denunciar review 🟡 | Vendor reporta reviews abusivas ao admin |
| 6.3.6 | Review verificado 🟡 | Badge "Compra Verificada" em reviews de clientes reais |

---

## 📊 7. Analytics & Relatórios

### 7.1 Dashboard do Vendedor
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 7.1.1 | Estatísticas do dia ✅ | Vendas, receita, encomendas |
| 7.1.2 | Gráfico de vendas 🔴 | Receita diária/semanal/mensal (chart) |
| 7.1.3 | Top produtos 🔴 | Mais vendidos por período |
| 7.1.4 | Taxa de conversão 🔴 | Visitas → compras no período |
| 7.1.5 | Tráfego por origem 🟡 | Directo, pesquisa, redes sociais, afiliados |
| 7.1.6 | Mapa de vendas 🟡 | Distribuição geográfica das encomendas |
| 7.1.7 | Comparação período anterior 🟡 | "vs mês passado" com % de variação |
| 7.1.8 | Exportar relatórios 🟡 | Download CSV/PDF |

### 7.2 Dashboard Admin (Plataforma)
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 7.2.1 | GMV total ✅ | Gross Merchandise Volume da plataforma |
| 7.2.2 | Novos utilizadores 🔴 | Registos por período |
| 7.2.3 | Taxa de aprovação de lojas 🔴 | % de lojas aprovadas vs rejeitadas |
| 7.2.4 | Receita da plataforma 🟡 | Comissões totais cobradas |
| 7.2.5 | Top categorias 🟡 | Categorias com mais vendas |
| 7.2.6 | Top lojas 🟡 | Ranking de lojas por receita |
| 7.2.7 | Health dashboard 🟢 | Uptime, erros 500, tempo de resposta |

---

## 🤝 8. Afiliados

### 8.1 Programa de Afiliados
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 8.1.1 | Registo de afiliado ✅ | Qualquer pessoa pode tornar-se afiliado |
| 8.1.2 | Link de afiliado único 🔴 | Link rastreável com código |
| 8.1.3 | Cookie de atribuição 🔴 | X dias de cookie para crédito da venda |
| 8.1.4 | Dashboard de afiliado 🔴 | Cliques, conversões, comissões ganhas |
| 8.1.5 | Materiais de marketing 🟡 | Banners, links, imagens prontas para partilhar |
| 8.1.6 | Níveis de afiliado 🟡 | Comissão crescente por performance |
| 8.1.7 | Pagamento de comissões 🔴 | Via carteira interna, cálculo automático |
| 8.1.8 | Relatório do vendor 🟡 | Quais afiliados geraram mais vendas |

---

## 🚚 9. Logística & Entregas

### 9.1 Gestão de Envios
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 9.1.1 | Zonas de entrega 🔴 | Vendor define para onde envia (províncias/cidades) |
| 9.1.2 | Tabela de frete 🔴 | Preço por zona, peso, ou valor fixo |
| 9.1.3 | Frete grátis mínimo 🔴 | Acima de X MZN, frete oferecido |
| 9.1.4 | Transportadoras 🟡 | Integração com transportadoras moçambicanas |
| 9.1.5 | Tracking automático 🟡 | Webhook da transportadora actualiza estado |
| 9.1.6 | Pickup points 🟢 | Pontos de recolha (lojas físicas parceiras) |
| 9.1.7 | Cálculo em tempo real 🟢 | API de cálculo de frete no checkout |

---

## 🔐 10. Autenticação & Segurança

### 10.1 Conta de Utilizador
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 10.1.1 | Registo ✅ | Email + password |
| 10.1.2 | Login ✅ | JWT com refresh token |
| 10.1.3 | Login social 🟡 | Google, Facebook |
| 10.1.4 | 2FA 🟡 | Autenticação de dois factores |
| 10.1.5 | Verificação de email 🔴 | Email de confirmação após registo |
| 10.1.6 | Recuperação de senha 🔴 | "Esqueci minha senha" com email |
| 10.1.7 | Perfil do utilizador ✅ | Nome, foto, telefone, moradas |
| 10.1.8 | Histórico de encomendas ✅ | Cliente vê todas as suas compras |

### 10.2 Segurança
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 10.2.1 | Rate limiting 🟡 | Limitar tentativas de login/API |
| 10.2.2 | Bloqueio de conta 🟡 | Após X tentativas falhadas |
| 10.2.3 | Log de sessões 🟡 | Ver dispositivos e sessões activas |
| 10.2.4 | Verificação KYC 🔴 | Verificar identidade do vendedor (documentos) |
| 10.2.5 | Protecção anti-fraude 🟢 | Detectar compras suspeitas |

---

## 🎨 11. Conteúdo & SEO

### 11.1 Blog ✅
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 11.1.1 | Artigos | CRUD de posts com imagens |
| 11.1.2 | Categorias de blog | Organização por temas |
| 11.1.3 | SEO por artigo | Meta title, description, slug |

### 11.2 Páginas Institucionais
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 11.2.1 | Sobre ✅ | Página sobre a plataforma |
| 11.2.2 | Contacto ✅ | Formulário de contacto |
| 11.2.3 | FAQ ✅ | Perguntas frequentes |
| 11.2.4 | Termos & Privacidade ✅ | Páginas legais |
| 11.2.5 | Como vender 🟡 | Guia para novos vendedores |
| 11.2.6 | Como comprar 🟡 | Guia para compradores |

### 11.3 SEO Global
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 11.3.1 | Sitemap.xml automático 🔴 | Gerado dinamicamente com todas as URLs |
| 11.3.2 | Robots.txt 🔴 | Controlo de indexação |
| 11.3.3 | Schema.org markup 🟡 | Rich snippets para produtos, lojas, reviews |
| 11.3.4 | Breadcrumbs estruturados 🟡 | JSON-LD para Google |
| 11.3.5 | Canonical URLs 🟡 | Evitar conteúdo duplicado |

---

## 📱 12. Mobile & PWA

| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 12.1 | PWA ✅ | Service worker, manifest, instalável |
| 12.2 | Push notifications 🟡 | Web push para compradores e vendedores |
| 12.3 | Offline mode 🟢 | Cache de páginas visitadas |
| 12.4 | App nativa 🟢 | React Native ou wrapper PWA |
| 12.5 | Responsivo ✅ | Layout adaptável a todos os ecrãs |

---

## 🧩 13. Funcionalidades Específicas por Tipo

### 13.1 Cursos
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 13.1.1 | Módulos e aulas 🔴 | Estrutura hierárquica: curso → módulo → aula |
| 13.1.2 | Progresso do aluno 🔴 | % concluído, aulas completadas |
| 13.1.3 | Certificado de conclusão 🔴 | PDF gerado automaticamente |
| 13.1.4 | Quiz / Avaliação 🟡 | Testes entre módulos |
| 13.1.5 | Aulas ao vivo 🟡 | Integração Zoom/Google Meet |
| 13.1.6 | Fórum do curso 🟡 | Alunos interagem, instrutor responde |
| 13.1.7 | Drip content 🟡 | Libertar conteúdo gradualmente |
| 13.1.8 | Pré-visualização grátis 🟡 | Aula introdutória gratuita |

### 13.2 Produtos Digitais
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 13.2.1 | Download seguro 🔴 | Link único, expira após X downloads ou dias |
| 13.2.2 | Watermark 🟡 | Marca d'água com nome/email do comprador |
| 13.2.3 | Preview 🟡 | Amostra antes de comprar |
| 13.2.4 | Licença 🟡 | Tipo de licença (pessoal, comercial, etc.) |
| 13.2.5 | Actualizações 🟢 | Comprador recebe versões futuras |

### 13.3 Produtos Físicos
| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 13.3.1 | Variantes 🔴 | Tamanho, cor, material |
| 13.3.2 | Dimensões e peso 🔴 | Para cálculo de frete |
| 13.3.3 | Garantia 🟡 | Período de garantia, termos |
| 13.3.4 | Guia de tamanhos 🟡 | Tabela de medidas para roupa/calçado |
| 13.3.5 | Stock em múltiplos armazéns 🟢 | Gestão multi-localização |

---

## ⚙️ 14. Infraestrutura & DevOps

| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 14.1 | Docker ✅ | Dockerfile + docker-compose |
| 14.2 | CI/CD 🟡 | GitHub Actions para teste e deploy |
| 14.3 | CDN para media 🟡 | Cloudflare R2, AWS S3 ou BunnyCDN |
| 14.4 | Backup automático 🟡 | DB + media files diários |
| 14.5 | Monitorização 🟡 | Sentry para erros, health checks |
| 14.6 | Logs centralizados 🟢 | ELK stack ou alternativa |
| 14.7 | Load testing 🟢 | Testes de carga antes de campanhas |
| 14.8 | Staging environment 🟡 | Ambiente de testes separado |

---

## 📈 Resumo por Prioridade

### 🔴 Alta Prioridade (8 funcionalidades-chave)
```
1. Variantes de produto (físico)
2. Cupões & Sistema de descontos
3. Chat vendor-cliente (WebSocket)
4. Sistema de devoluções (after-sales)
5. Cálculo de frete por zona/peso
6. Relatórios analíticos (gráficos)
7. Levantamento de saldo (carteira)
8. Notificações email transacionais
```

### 🟡 Média Prioridade (14 funcionalidades)
```
9.  Níveis de vendedor (Bronze → Diamante)
10. Múltiplos admins por loja
11. Flash sales
12. SEO (sitemap, schema, meta tags)
13. Certificados de cursos
14. Afiliados — links rastreáveis e dashboard
15. Download seguro para digitais
16. Login social (Google)
17. 2FA
18. Tracking de encomendas
19. Q&A por produto
20. Marketing de afiliados — materiais
21. Facturação automática
22. PWA push notifications
```

### 🟢 Baixa Prioridade / Futuro
```
23. Temas de layout para lojas
24. Live streaming
25. Marketplace ads
26. App nativa mobile
27. Pré-venda / Backorder
28. Assinaturas recorrentes
29. Drip content para cursos
30. Watermark dinâmico
31. Pickup points
```

---

*Última actualização: 26 de Julho de 2026*
