# Plano de Implementação — Verificação de Contas e Recuperação de Password

**Serviço de email escolhido:** Brevo
**Prioridade:** Verificação de contas e recuperação de password (o sistema de notificações fica para depois)
**Documento sem código** — descreve a implementação completa por palavras.

---

## 1. Objetivo e âmbito

Implementar dois fluxos completos de email no eShopping Centre:

1. **Verificação de conta** — provar que o dono do email registado é o mesmo que está a criar/usar a conta. É o pré-requisito que destrava o login Google vinculado à conta do formulário (proteção anti pre-hijacking já aplicada).
2. **Recuperação de password** — permitir que o utilizador recupere o acesso de forma segura quando esquece a password.

Fora do âmbito (adiado): notificações transacionais (encomendas, pagamentos, afiliados), newsletters, push mobile. O que for construído aqui (Brevo + envio assíncrono) será a fundação para essas funcionalidades futuras.

---

## 2. Estado atual (diagnóstico)

O que já existe:

- Registo por formulário (`POST /api/v1/auth/register/`) cria a conta e emite tokens JWT, mas **não envia email de verificação** e deixa o campo `is_verified` a `false`.
- Login por email/password com throttle de 5/minuto no endpoint `/api/v1/auth/login/`.
- Login Google via Firebase (fluxo de redirect no frontend + troca de ID token no backend).
- Proteção anti pre-hijacking já aplicada: o backend só vincula a credencial Google a uma conta existente se essa conta tiver `is_verified` a `true`.
- Alteração de password para utilizador autenticado (`POST /api/v1/users/password/change/`).
- Celery + Redis configurados (para envio assíncrono de email).
- O frontend já referencia endpoints de reset de password que **não existem no backend** (são apenas stubs).

O que falta / está incorreto:

- **Não há verificação de email** para contas criadas por formulário.
- **Não há endpoints de recuperação de password** no backend (o frontend chama rotas inexistentes).
- **Rotas duplicadas sem proteção:** existe um `login/` e `register/` extra sob `/api/v1/users/` que **não usa o throttle de login** e aponta para o login simples. Isto permite contornar o limite anti brute-force. Deve ser corrigido neste trabalho.
- O campo `is_verified` não tem nenhum fluxo de utilizador que o ative (só admin/Firebase).

---

## 3. Decisões de arquitetura

1. **Django continua a ser a única fonte de verdade das contas.** O Firebase é usado apenas como provedor de identidade Google. Os emails de verificação e recuperação são geridos pelo Django.
2. **Brevo** como serviço de email transacional. Motivo: free tier generoso (300 emails/dia), SMTP + API, bom custo-benefício para o mercado moçambicano.
3. **Camada de abstração de email** no Django para trocar de fornecedor no futuro sem mexer no código (ex.: SendGrid, Amazon SES). Recomendação: `django-anymail`.
4. **Envio sempre assíncrono via Celery.** Nenhum envio de email bloqueia o pedido HTTP.
5. **OTP de 6 dígitos** como mecanismo único de verificação e de recuperação. Motivo: não depende de o utilizador abrir links, funciona bem em mobile e é simples de implementar uma única vez e reutilizar nos dois fluxos. (Alternativa considerada e rejeitada para já: magic link.)
6. **Emails fora do Firebase:** os templates de email do Firebase Auth não serão usados, porque as contas são do Django e o Firebase não serve como email transacional geral.

---

## 4. Fluxo 1 — Verificação de conta (OTP)

1. O utilizador preenche o formulário de registo (email, password, etc.).
2. A conta é criada com `is_verified` a `false` (comportamento atual mantido).
3. O backend gera um OTP de 6 dígitos e guarda-o de forma segura (hash + data de expiração + contador de tentativas), associado ao utilizador.
4. O backend agenda uma tarefa Celery que envia o email "Verifica o teu email" através da Brevo, com o OTP.
5. O frontend mostra um ecrã de "Introduz o código" logo após o registo.
6. O utilizador introduz o OTP no endpoint de verificação.
7. Se o OTP estiver correto e dentro do prazo, o backend marca `is_verified` a `true`.
8. A partir daí, o login Google com o mesmo email passa a conseguir vincular-se a esta conta.

Regras de segurança do OTP:

- Expiração de 10 minutos.
- Máximo de 3 tentativas erradas por OTP; ao esgotar, o OTP é invalidado.
- Reenvio limitado (ex.: 3 reenvios por hora por conta).
- O OTP nunca é devolvido na resposta HTTP; só via email.
- Throttle por IP e por conta nos endpoints de verificação e reenvio.

O que fica bloqueado até a conta estar verificada:

- Vincular a conta ao login Google.
- (Recomendado, fase posterior) ações sensíveis: criar loja, solicitar saques, etc. Nesta fase, o bloqueio mínimo é o link Google.

---

## 5. Fluxo 2 — Recuperação de password (OTP)

1. O utilizador pede recuperação indicando o email.
2. O backend gera um OTP de 6 dígitos (com expiração) e envia por email via Brevo.
3. O backend responde sempre de forma genérica (não revela se o email existe — evita enumeração de contas).
4. O utilizador introduz o OTP no ecrã de recuperação e define uma nova password.
5. O backend valida o OTP, confirma a nova password e invalida o OTP (uso único).
6. Por segurança, após o reset, o backend revoga todos os refresh tokens existentes do utilizador (blacklist), obrigando a novo login nos outros dispositivos.
7. O utilizador é redirecionado para o login com a nova password.

Regras de segurança:

- Expiração de 10 minutos para o OTP de recuperação.
- OTP de uso único (invalidado após o reset).
- Tentativas limitadas (ex.: 5) e throttle no pedido de reset.
- Resposta genérica no pedido de reset para não permitir enumeração de emails.
- Revogação de sessões antigas após o reset.

---

## 6. Endpoints novos ou alterados (descrição)

Todos sob a família de autenticação `/api/v1/auth/`.

Verificação de conta:

- `POST /api/v1/auth/verify-email/` — recebe o OTP e marca a conta como verificada. Não exige estar autenticado por JWT se ainda não tem token; deve validar a conta pelo identificador associado ao OTP.
- `POST /api/v1/auth/resend-verification/` — reenvia o OTP de verificação (com throttle).
- `GET /api/v1/users/me/` (já existe) — deve passar a expor o estado de verificação, que já faz.

Recuperação de password:

- `POST /api/v1/auth/password/reset/` — recebe o email, gera OTP e envia email (resposta genérica).
- `POST /api/v1/auth/password/reset/confirm/` — recebe OTP + nova password, valida e aplica (uso único).

Correções de rotas:

- Remover ou neutralizar as rotas duplicadas de `register/` e `login/` sob `/api/v1/users/` para que o throttle de login e o fluxo canónico de `/api/v1/auth/` sejam os únicos pontos de entrada.

---

## 7. Dados a guardar (descrição, sem código)

Opção A — campos no utilizador:

- OTP de verificação (guardado como hash, nunca em claro).
- Data de expiração do OTP.
- Contador de tentativas do OTP.
- OTP de recuperação (hash) + expiração (ou reutilizar os mesmos campos, distinguindo o tipo).

Opção B — tabela própria de "tokens/OTP de uso único":

- Tipo (verificação / recuperação).
- Referência ao utilizador.
- Valor guardado como hash.
- Data de expiração.
- Número de tentativas.
- Estado (ativo / usado / expirado).

Recomendação: **Opção B**, uma tabela dedicada de códigos de uso único, porque permite ter vários tipos (verificação, recuperação e, no futuro, login por OTP) sem poluir o modelo de utilizador, e é fácil de auditar.

---

## 8. Configuração do Brevo (passos no painel)

1. Criar a conta Brevo (ou usar uma existente).
2. Gerar a chave de API (secção API Keys) — esta chave fica nas variáveis de ambiente, nunca no código.
3. Adicionar e verificar o domínio de envio (ex.: `eshopping.co.mz`).
4. Configurar os registos DNS do domínio:
   - SPF (autorizar os servidores da Brevo).
   - DKIM (assinatura dos emails).
   - DMARC (política de autenticação).
5. Criar dois templates transacionais:
   - "Verificação de email" com o placeholder do código de 6 dígitos.
   - "Recuperação de password" com o placeholder do código de 6 dígitos.
6. Definir o remetente oficial (ex.: `noreply@eshopping.co.mz`).
7. Testar o envio no painel e, em desenvolvimento, usar um backend de teste para não gastar quota.

---

## 9. Passos necessários no Firebase

Apesar de a prioridade ser verificação e recuperação, o Firebase continua a servir o login Google e precisa de alguns ajustes/confirmações:

1. **Confirmar o provedor Google ativo:** Firebase Console → Authentication → Sign-in method → "Google" ativado (já usado hoje).
2. **Configurar o OAuth consent screen** (Google Cloud Console):
   - Nome da aplicação.
   - Email de suporte.
   - Domínios autorizados (localhost para dev e o domínio de produção).
   - Scopes mínimos: email e perfil.
3. **Domínios autorizados do Firebase Auth:** Firebase Console → Authentication → Settings → Authorized domains. Adicionar `localhost` (dev) e o domínio de produção, porque o fluxo de redirect só funciona em domínios autorizados.
4. **Conta de serviço (Admin SDK):** confirmar que o ficheiro de credenciais em `credentials/firebase-adminsdk.json` continua válido e com permissão para verificar ID tokens (é o que o backend usa). Se tiver sido regenerado, atualizar o ficheiro.
5. **Não usar os templates de email do Firebase Auth:** os emails de verificação/reset do Firebase Auth ficam desativados ou ignorados, porque a fonte de verdade é o Django e os emails saem pela Brevo. Não ativar os fluxos de email do Firebase.
6. **(Opcional) Verificar o domínio de produção** no Firebase para remover avisos de "domínio não verificado" no OAuth consent screen.
7. **(Atenção) Claims de verificação:** não confiar em nenhuma claim de "email verificado" do Firebase para a lógica de negócio da plataforma — a verificação oficial continua a ser o `is_verified` do Django, ativado pelo nosso fluxo de OTP.

---

## 10. Integração no backend (descrição, sem código)

Configuração:

- Backend de email apontado para a Brevo (via camada de abstração).
- Variáveis de ambiente: chave da Brevo, email do remetente, URL base do frontend (para eventuais links futuros).
- Em desenvolvimento, backend de email de consola ou caixa de teste.

Tarefas Celery:

- Enviar email de verificação (OTP).
- Enviar email de recuperação (OTP).
- (Futuro) qualquer notificação transacional reutiliza este padrão.

Views/serializers:

- Novas views para verificação, reenvio e recuperação, com validação de OTP e throttles dedicados.
- Registo continua a criar a conta, mas passa a disparar a tarefa de envio do OTP.
- Alteração de password autenticada não muda.

Segurança transversal:

- Throttles dedicados para verificação, reenvio e reset.
- OTPs guardados apenas como hash.
- Revogação de refresh tokens após reset de password.

---

## 11. Integração no frontend (descrição, sem código)

Páginas/ecrãs novos ou ajustados:

- **Ecrã de verificação de email** após o registo: campo para o código de 6 dígitos, botão de reenviar, contagem regressiva e mensagens de erro claras.
- **Ecrã "Esqueci a password"**: campo de email → pedido de reset.
- **Ecrã de redefinição de password**: campo de OTP + nova password + confirmação.
- **Ajustes no login Google:** quando o backend devolver erro de "email não verificado", mostrar mensagem a orientar o utilizador a entrar com email/password e verificar o email.
- **Ajustes no estado de sessão:** refletir `is_verified` e, se necessário, um aviso persistente "verifica o teu email" enquanto a conta não estiver verificada.
- **Remover os stubs** de reset que apontam para endpoints inexistentes e ligar aos novos endpoints reais.

---

## 12. Segurança (resumo das proteções)

- OTPs com expiração curta, tentativas limitadas e guardados como hash.
- Respostas genéricas no pedido de reset (sem enumeração de emails).
- Throttle por IP e por conta em todos os endpoints sensíveis.
- OTP nunca devolvido em resposta HTTP nem registado em logs.
- Revogação de sessões após reset de password.
- Link Google continua condicionado a `is_verified` a `true` (proteção já implementada e a manter).
- Fecho da brecha das rotas duplicadas de login sem throttle.

---

## 13. Plano de implementação faseado

Fase 1 — Fundação:

1. Corrigir as rotas duplicadas de `register/login` sem throttle.
2. Configurar a camada de email (Brevo + abstração + variáveis de ambiente).
3. Criar o modelo de OTP de uso único e as tarefas Celery de envio.

Fase 2 — Verificação de conta:

4. Implementar endpoints de verificação e reenvio de OTP.
5. Ligar o registo ao envio do OTP.
6. Frontend: ecrã de verificação após registo + aviso de email não verificado.

Fase 3 — Recuperação de password:

7. Implementar endpoints de reset e confirmação.
8. Ligar ao envio do OTP de recuperação.
9. Frontend: ecrãs de "esqueci a password" e redefinição.

Fase 4 — Configuração externa e validação:

10. Configurar Brevo (chave, domínio, SPF/DKIM/DMARC, templates).
11. Configurar/confirmar Firebase (domínios autorizados, consent screen).
12. Testes ponta-a-ponta e deploy.

---

## 14. Critérios de aceitação

- Um utilizador registado por formulário recebe o email de verificação, insere o OTP e fica com `is_verified` a `true`.
- Depois de verificado, o login Google com o mesmo email acede à mesma conta (link bem-sucedido).
- Um email não verificado não consegue vincular-se ao Google (mensagem clara de orientação).
- O pedido de reset envia email, e o OTP permite definir nova password.
- Após o reset, os refresh tokens anteriores ficam inválidos (novo login obrigatório).
- Os endpoints de verificação/reset têm throttle e não permitem enumeração de emails.
- Nenhum envio de email bloqueia o pedido HTTP (tudo via Celery).
- A brecha das rotas duplicadas de login sem throttle está fechada.
