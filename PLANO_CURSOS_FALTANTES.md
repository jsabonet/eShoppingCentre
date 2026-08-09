# Plano de Funcionalidades Faltantes — Sistema de Cursos

> Data: 2026-08-06
> Estado: Análise concluída. Nada implementado ainda.
> Referência: Comparação com plataformas internacionais (Udemy, Coursera, Teachable, Thinkific, Hotmart, Moodle)

---

## 🔴 CRÍTICO — Core de qualquer plataforma de cursos

### 1. Quizzes / Avaliações

**Não existe nada disto.** É a maior lacuna do sistema.

#### Modelos necessários:
- **`Quiz`** — vinculado a um `CourseModule` ou `CourseLesson`
  - `title`, `description`, `pass_percentage` (ex: 70%), `max_attempts`, `is_required`
- **`Question`** — vinculada a um `Quiz`
  - `text`, `question_type` (multiple_choice, true_false, open_text, multiple_select)
  - `sort_order`, `points`
- **`AnswerOption`** — vinculada a uma `Question`
  - `text`, `is_correct`, `sort_order`
- **`QuizAttempt`** — vinculado a `Enrollment` + `Quiz`
  - `score`, `passed`, `started_at`, `completed_at`, `attempt_number`
- **`QuizAnswer`** — resposta do aluno a cada questão
  - `attempt`, `question`, `selected_option` (FK ou texto livre)

#### Endpoints:
| Método | URL | Descrição |
|--------|-----|-----------|
| GET | `/courses/{id}/quizzes/` | Listar quizzes do curso |
| POST | `/courses/modules/{id}/quizzes/` | Criar quiz |
| GET | `/courses/quizzes/{id}/` | Detalhe do quiz |
| PUT | `/courses/quizzes/{id}/` | Editar quiz |
| DELETE | `/courses/quizzes/{id}/` | Remover quiz |
| POST | `/courses/quizzes/{id}/attempt/` | Iniciar tentativa |
| POST | `/courses/quizzes/{id}/submit/` | Submeter respostas |
| GET | `/courses/quizzes/{id}/results/` | Ver resultado |

#### Frontend:
- **Builder**: Editor de quiz (adicionar questões, definir respostas corretas)
- **Learn**: Interface de quiz (selecionar respostas, timer, submit)
- **Learn**: Tela de resultado (score, aprovado/reprovado, revisão de erros)

---

### 2. Certificados PDF

`certificate_enabled` existe como booleano mas **zero implementação real**.

#### Modelo necessário:
- **`Certificate`** — gerado ao concluir curso
  - `enrollment` (FK), `certificate_number` (único), `issued_at`
  - `template_id` (se houver templates personalizáveis)

#### Funcionalidades:
- Geração de PDF com:
  - Nome do aluno, nome do curso, nome do instrutor
  - Data de conclusão, carga horária (`course.duration`)
  - Número único de certificado
  - QR code → URL pública de verificação
- Template base com logo do eShoppingCentre
- Download automático ao concluir curso
- Página pública de verificação: `/certificates/{certificate_number}/`
- Botão "Baixar Certificado" em `/my-courses` (para cursos concluídos)

#### Dependência:
- Biblioteca Python: `reportlab` ou `weasyprint` para geração de PDF
- Biblioteca: `qrcode` para QR codes

---

### 3. Notificações de Curso

O módulo `notifications` existe mas **não está integrado** ao sistema de cursos.

#### Gatilhos necessários:

| Evento | Canal | Conteúdo |
|--------|-------|----------|
| Matrícula confirmada | Email + Push | "Bem-vindo ao curso X! Comece agora." |
| Aula concluída | In-app | "Aula Y concluída. Continue!" |
| Módulo concluído | Email | "Parabéns! Módulo Z concluído." |
| Curso concluído | Email + Push | "Parabéns! Baixe o seu certificado." |
| Certificado emitido | Email | PDF em anexo + link de verificação |
| Curso inacabado (7 dias) | Email | "Continue de onde parou!" |
| Acesso a expirar (3 dias) | Email + Push | "O seu acesso ao curso X expira em 3 dias." |
| Acesso expirado | Email | "O seu acesso expirou. Renove." |
| Novo anúncio do instrutor | Email + Push | Broadcast do instrutor |

---

### 4. Avaliações / Reviews de Curso

O `Product` tem `rating` mas não há **fluxo dedicado de review pós-curso**.

#### Modelo necessário:
- **`CourseReview`**
  - `enrollment` (FK, único), `rating` (1-5), `title`, `body`
  - `is_public`, `created_at`

#### Regras de negócio:
- Só pode avaliar após concluir o curso (ou após X% de progresso)
- Uma review por matrícula
- Atualiza `product.rating` e `product.review_count` automaticamente
- Instrutor pode responder (opcional)

#### Frontend:
- Popup "Avalie este curso" ao concluir
- Secção de reviews na página de detalhe do curso
- Estrelas + comentários como prova social

---

## 🟠 IMPORTANTE — Diferenciação competitiva

### 5. Pré-requisitos entre Cursos

#### Modelo:
- Campo `prerequisites = ManyToManyField('self', symmetrical=False)` em `Course`

#### Regras:
- Bloquear compra se não concluiu pré-requisito
- Mostrar "Requer: Curso X" na página de detalhe
- Sugerir caminho completo (básico → intermédio → avançado)

---

### 6. Drip Content / Libertação Programada

#### Modelo:
- Campo `drip_days = PositiveIntegerField(null=True)` em `CourseModule`
  - `null` = disponível imediatamente
  - `7` = disponível 7 dias após matrícula

#### Regras:
- `CourseLearnView` filtra módulos cujo `drip_days` ainda não passou
- Mostrar "Disponível em X dias" com contagem regressiva
- Pré-visualizações (`is_free_preview`) sempre visíveis

---

### 7. Discussões / Q&A por Aula

#### Modelo:
- **`LessonComment`**
  - `lesson` (FK), `user` (FK), `parent` (FK self, para replies)
  - `body`, `is_resolved`, `is_instructor_reply`
  - `created_at`, `updated_at`

#### Funcionalidades:
- Secção "Perguntas e Respostas" abaixo de cada aula
- Aluno pergunta → instrutor responde
- Threaded replies
- Marcar como "resolvido"
- Notificações: nova pergunta (instrutor), nova resposta (aluno)

---

### 8. Anúncios do Instrutor (Broadcast)

#### Modelo:
- **`CourseAnnouncement`**
  - `course` (FK), `title`, `body`, `created_at`

#### Funcionalidades:
- Instrutor publica → email para todos os alunos
- Lista de anúncios na página do curso (aprendizagem)
- Badge "Novo" na última semana

---

### 9. Perfil Público do Instrutor

#### Modelo (extensão de User ou Store):
- Campos: `bio`, `avatar`, `website`, `linkedin`, `youtube`, `expertise_areas` (tags)

#### Página pública:
- `/instructors/{slug}/` — bio, foto, cursos publicados, avaliação média, nº de alunos

---

## 🟡 DESEJÁVEL — Maturidade da plataforma

### 10. Trilhas de Aprendizagem / Learning Paths

#### Modelo:
- **`LearningPath`**
  - `title`, `description`, `image`, `courses` (ManyToMany com `sort_order`)
- **`PathEnrollment`**
  - `user`, `path`, `progress`, `completed`

#### Funcionalidades:
- "Desenvolvedor Full-Stack": 5 cursos em sequência
- Certificado de trilha ao concluir todos
- Preço com desconto vs cursos individuais

---

### 11. Wishlist de Cursos

O modelo `WishlistItem` já existe em `products`. Falta:
- UI dedicada em `/my-courses` ou `/account/wishlist`
- Botão "Guardar" no card/listagem de cursos
- Notificação quando curso em wishlist entra em promoção

---

### 12. Cupons Específicos para Cursos

O modelo `Coupon` existe. Falta:
- Cupom "primeiro curso grátis" (validação: `Enrollment.count == 0`)
- Bundle: "Compre 2 cursos, ganhe 30% de desconto"
- Cupom de instructor: "Alunos do curso X ganham 50% no curso Y"

---

### 13. Legendas / Closed Captions

Cloudflare Stream suporta WebVTT. Falta:
- Upload de ficheiro `.vtt` por aula
- Ativação no player (`captions` no iframe)
- Múltiplos idiomas (PT, EN)

---

### 14. Transcrição de Aulas

- Campo `transcript` (TextField) em `CourseLesson`
- Aba "Transcrição" no player de aula
- Pesquisa dentro da transcrição
- SEO: Google indexa transcrições

---

## 🔵 PADRÕES INTERNACIONAIS — Interoperabilidade

### 15. SCORM

Permite importar cursos criados em ferramentas como Articulate, Adobe Captivate, iSpring.

- Upload de pacote `.zip` SCORM 1.2 / 2004
- Parse do `imsmanifest.xml`
- Tracking: `cmi.core.lesson_status`, `cmi.core.score`, `cmi.core.session_time`
- Player SCORM em iframe

### 16. xAPI (Tin Can API)

Tracking granular de atividades de aprendizagem:

- Statements: `{actor, verb, object}` → `{"João", "completed", "Lesson 3"}`
- LRS (Learning Record Store) interno
- Dashboard de analytics para instrutores
- Export para LRS externos

### 17. LTI (Learning Tools Interoperability)

Padrão IMS Global para integração com LMS corporativos (Moodle, Blackboard, Canvas):

- LTI 1.3 (OAuth 2.0 + OIDC)
- eShoppingCentre como **Tool Provider**
- Universidades/empresas consomem cursos via LTI launch
- Single Sign-On, grade passback automático

---

## 📋 Ordem de Implementação Recomendada

| Fase | # | Funcionalidade | Esforço | Impacto |
|------|---|---------------|---------|---------|
| **Fase 1** | 1 | Quizzes/Avaliações | Alto | 🔴 Essencial |
| **Fase 1** | 2 | Certificados PDF | Médio | 🔴 Essencial |
| **Fase 1** | 3 | Notificações | Médio | 🔴 Essencial |
| **Fase 2** | 4 | Reviews de curso | Baixo | 🔴 Essencial |
| **Fase 2** | 9 | Perfil do instrutor | Baixo | 🟠 Importante |
| **Fase 3** | 5 | Pré-requisitos | Baixo | 🟠 Importante |
| **Fase 3** | 7 | Q&A por aula | Médio | 🟠 Importante |
| **Fase 3** | 6 | Drip content | Baixo | 🟠 Importante |
| **Fase 4** | 8 | Anúncios do instrutor | Baixo | 🟡 Desejável |
| **Fase 4** | 10 | Trilhas de aprendizagem | Médio | 🟡 Desejável |
| **Fase 5** | 11-14 | Wishlist, Cupons, Legendas, Transcrição | Baixo-Médio | 🟡 Desejável |
| **Fase 6** | 15-17 | SCORM, xAPI, LTI | Alto | 🔵 Enterprise |

---

## 📊 Estado Atual (Para Referência)

### O que já existe:
- ✅ Course, Module, Lesson CRUD
- ✅ Cloudflare Stream (upload direto, token JWT, rate limiting)
- ✅ Enrollment + LessonProgress
- ✅ Watch progress (timer-based com `Date.now()`)
- ✅ Auto-complete + auto-advance
- ✅ Access duration (`access_duration_days` + `access_expires_at`)
- ✅ Free preview lessons
- ✅ Lesson attachments (anexos)
- ✅ Lesson descriptions
- ✅ Course levels (beginner/intermediate/advanced)
- ✅ Student list (seller dashboard)
- ✅ Affiliate commission
- ✅ Test checkout mode
- ✅ **Quizzes / Avaliações** (models, API, admin, builder UI, taker UI, result UI)

### O que NÃO existe (este documento):
- ❌ Certificados reais (PDF)
- ❌ Notificações de curso
- ❌ Reviews de curso
- ❌ Pré-requisitos
- ❌ Drip content
- ❌ Q&A por aula
- ❌ Anúncios do instrutor
- ❌ Perfil do instrutor
- ❌ Trilhas de aprendizagem
- ❌ SCORM / xAPI / LTI
