# 🎓 e-Shopping Academy — Proposta de Conceito

> Área de educação digital para vendedores, compradores e afiliados do e-Shopping Centre.
> Documento conceitual — sem detalhes técnicos. Baseado no padrão internacional de "seller education" e adaptado à realidade moçambicana.
  
---

## 1. Contexto e Justificativa

Em Moçambique, a venda online ainda é um processo rudimentar: muitos empreendedores entram no digital sem saber fotografar produtos, precificar, gerir stock, tratar de entregas ou cobrar clientes. Do lado do comprador, há desconfiança em relação a pagamentos online e receio de burlas.

O que as plataformas internacionais já provaram: **a educação é a alavanca mais barata e eficaz para aumentar a qualidade do marketplace** — melhora os anúncios, reduz devoluções, aumenta conversão e constrói confiança. A academia transforma conhecimento em retenção: quem aprende na plataforma, vende e compra mais nela.

## 2. Padrão Internacional (referências)

| Plataforma | Modelo |
|-----------|--------|
| **Amazon Seller University** | Cursos em vídeo gratuitos, trilhas por nível, certificação |
| **Mercado Livre — Impulso** | Cursos gratuitos em PT/ES, selo/certificado ligado à reputação do vendedor, gamificação |
| **Shopify Academy** | Trilhas com vídeo + quiz, certificado de conclusão, competências de negócio além da plataforma |
| **Etsy Seller Handbook** | Guias, webinars e comunidade de vendedores |
| **Daraz University / Jumia** | Cursos em línguas locais, certificados, ligados ao nível/desempenho do vendedor (mercados emergentes) |
| **Google Digital Skills for Africa** | Certificação gratuita, mobile-first, em línguas locais, reconhecida no continente |

**Padrão comum:** trilhas de aprendizagem por papel e nível → módulo → aula → quiz → certificado → benefícios tangíveis no marketplace + comunidade.

## 3. Nome e Posicionamento

**Nome proposto:** *e-Shopping Academy* (alternativas: *Academia e-Shopping*, *e-Shopping U*).

**Posicionamento:** "A escola do comércio digital moçambicano" — gratuita, em português, pensada para quem está a começar do zero, com certificação que vale dentro e fora da plataforma.

**Tom:** simples, prático, encorajador. Conteúdo que resolve problemas reais ("como tirar boas fotos com o telemóvel"), não teoria.

## 4. Públicos-Alvo

| Público | Necessidade principal |
|---------|----------------------|
| **Vendedor iniciante** | Criar a loja, primeiro produto, primeiras vendas |
| **Vendedor em crescimento** | Marketing, SEO, anúncios, atendimento, escalar |
| **Vendedor avançado** | Gestão financeira, afiliados, estratégia de marca |
| **Comprador** | Comprar em segurança, pagamentos, devoluções, evitar burlas |
| **Afiliado** | Gerar links, promover, construir audiência, ganhar comissões |
| **Jovens / recém-formados** | Empregabilidade digital (skills transferíveis) |

## 5. Estrutura de Conteúdos

### 5.1 Trilhas de Aprendizagem (Learning Paths)
Cada trilha agrupa cursos ordenados do simples ao avançado e termina com certificação:

1. **Trilha do Vendedor** — do zero à loja profissional
2. **Trilha do Crescimento** — marketing, conversão, fidelização
3. **Trilha do Afiliado** — promoção e rendimento por comissão
4. **Trilha do Comprador Consciente** — educação do consumidor digital
5. **Trilha de Literacia Digital** — noções básicas (internet, email, segurança) para quem nunca vendeu online

### 5.2 Níveis
- **Fundamentos** (iniciante) — sem pré-requisitos
- **Intermediário** — exige certificado do nível anterior
- **Avançado / Especialização** — cursos temáticos (cursos online, produtos digitais, moda, agro, artesanato)

### 5.3 Formatos de Conteúdo (multi-formato, pensado para dados limitados)
- **Videoaulas via YouTube** (embed do canal oficial) — ver secção 5.5
- Guias em texto e checklists descarregáveis
- Modelos prontos (descrição de produto, política de devolução, cálculo de preço)
- Quizzes de verificação (o "portão" real do progresso)
- Exercícios práticos ligados à própria loja do aluno
- Webinars ao vivo e sessões de perguntas e respostas

### 5.4 Mapa Temático (áreas de conteúdo)
- **Fundamentos do comércio digital:** o que é marketplace, como funciona a venda online
- **Abertura e gestão da loja:** configuração, identidade visual, políticas, selo verificado
- **Catálogo e produto:** fotografia com telemóvel, títulos, descrições, preço, stock, variantes
- **Pagamentos e finanças:** M-Pesa, e-Mola, carteira, comissões, saques, impostos (NUIT), registo de contas
- **Logística e entregas:** zonas, frete, embalagem, prazos, transportadoras
- **Atendimento e confiança:** comunicação com o cliente, devoluções, avaliações, prevenção de burlas
- **Marketing e crescimento:** SEO básico, redes sociais, afiliados, promoções e cupões
- **Cursos e produtos digitais:** como criar e vender conhecimento
- **Cidadania digital:** segurança de conta, senhas, privacidade, reconhecimento de fraudes

### 5.5 Videoaulas e Rastreamento (modelo YouTube)
**Regra de ouro:** Academy (conteúdo gratuito) usa **YouTube**; cursos pagos continuam com proteção própria (Cloudflare Stream).

- **Entrega:** cada aula é um vídeo do canal oficial, embutido na plataforma (embed), organizado por playlists que espelham as trilhas.
- **Rastreamento na plataforma (o que importa):** abrir a aula regista "iniciada"; concluir a aula regista "concluída"; o **quiz** é quem garante a verificação real do progresso. Tudo isto vive no banco de dados da plataforma.
- **Conclusão da aula:** botão "Concluir aula" (fiável e simples) e, opcionalmente, marcação automática quando o vídeo chega ao fim (evento da API do YouTube).
- **Métricas de vídeo:** tempo de visualização e abandono ficam no YouTube Studio — não entram no dashboard da plataforma, o que é aceitável porque a certificação é validada pelos quizzes.
- **Bónus:** legendas automáticas em português, descoberta orgânica e comunidade (comentários) no canal oficial.

## 6. Funcionamento (Experiência do Utilizador)

1. **Acesso:** entrada pela navegação principal ("Academy"), sem barreiras; iniciar é gratuito.
2. **Diagnóstico de nível:** um questionário inicial sugere a trilha ideal.
3. **Aula:** vídeo do YouTube embutido, progresso automático, marcador de "última aula", retomar onde parou.
4. **Quiz e prática:** cada módulo exige aprovação no quiz para avançar; prática aplicada à loja real. O quiz é a verificação oficial — o vídeo é o meio, não a prova.
5. **Gamificação:** pontos, emblemas, sequências (streaks) e quadro de progresso.
6. **Certificado:** emitido ao concluir uma trilha (com nome do aluno e data).
7. **Benefício imediato:** o certificado desbloqueia vantagens no marketplace (ver abaixo).

## 7. Certificação e Benefícios no Marketplace

O diferencial do padrão internacional: **certificado não é só diploma, é vantagem real.**

- **Selo "Vendedor Formado"** visível na loja e nos produtos (gera confiança no comprador)
- **Prioridade em destaque/posicionamento** para lojas certificadas
- **Desconto de comissão** por nível de certificação atingido (progressivo)
- **Desbloqueio de funcionalidades** (ex.: afiliados, cupões, selo oficial) conforme o vendedor avança
- **Certificado reconhecido** como formação profissional para o currículo

## 8. Comunidade e Apoio

- Fórum por curso para dúvidas e troca de experiências
- Sessões ao vivo com vendedores experientes (mentoria "vendedor ensina vendedor")
- Histórias de sucesso de vendedores locais (prova social e inspiração)
- Central de ajuda ligada aos conteúdos (cada dúvida aponta para a aula correspondente)

## 9. Fases de Implementação (visão)

| Fase | Foco |
|------|------|
| **Fase 1 — Fundação** | Trilha do Vendedor iniciante + Trilha de Literacia Digital; certificado e selo básico |
| **Fase 2 — Crescimento** | Trilha do Crescimento + Afiliados; gamificação e benefícios de comissão |
| **Fase 3 — Ecossistema** | Trilha do Comprador; comunidade, webinars ao vivo, especializações por categoria |

## 10. Métricas de Sucesso

- % de novos vendedores que completam a trilha inicial
- Correlação entre certificação e: qualidade dos anúncios, vendas, devoluções, avaliações
- Tempo até à primeira venda de vendedores formados vs. não formados
- Taxa de conclusão de cursos e retenção (alunos que voltam)
- Número de certificados emitidos e selos exibidos

---

## Resumo em uma frase

**A e-Shopping Academy é a escola gratuita e prática do comércio digital moçambicano: ensina do zero, certifica com selo reconhecido e devolve valor imediato em vendas e confiança dentro da plataforma.**
