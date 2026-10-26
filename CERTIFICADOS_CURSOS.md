# Sistema de certificados dos cursos

## Objectivo

Emitir certificados verificáveis para os cursos completos existentes no marketplace. Esta implementação não abrange a e-Shopping Academy nem as trilhas estáticas da Academy.

## Regras de elegibilidade

- O curso tem de permitir certificados (`certificate_enabled`).
- O aluno tem de estar matriculado e ter acesso ao curso.
- Todas as aulas reais do curso têm de estar concluídas.
- O aluno tem de ter aprovação em cada quiz obrigatório do curso. Quizzes opcionais não bloqueiam a emissão.
- Cursos sem aulas não emitem certificados.

## Emissão e validação

- A conclusão é calculada no backend; o navegador não é fonte de verdade.
- O aluno solicita a emissão a partir da sua matrícula. O servidor volta a verificar a elegibilidade antes de emitir.
- Existe no máximo um certificado por matrícula, com identificador público UUID, nome do aluno e título do curso guardados como fotografia dos dados na emissão.
- Um certificado pode ser marcado como revogado com data e motivo.
- Correcções, revogações e revalidações administrativas exigem motivo e geram histórico imutável com actor, data e campos alterados.
- A rota pública de validação confirma autenticidade e estado e apresenta apenas o nome de emissão, o curso e a data.

## Experiência do aluno

- A área “Meus Cursos” indica quando o curso está concluído e permite emitir/descarregar o certificado.
- O certificado é descarregado em PDF com aluno, curso, data, código, QR code e URL pública de validação.
- O aluno pode voltar a descarregar o mesmo certificado sem emitir duplicados.

## Implementação

- [x] Recalcular a conclusão da matrícula após conclusão de uma aula ou submissão de quiz, considerando os quizzes obrigatórios.
- [x] Criar o modelo persistente de certificado, migração e gestão administrativa, incluindo estado de revogação.
- [x] Criar emissão autenticada por matrícula e validação pública por código.
- [x] Integrar emissão e download PDF na área “Meus Cursos”, com QR code apontando à validação.
- [x] Permitir gestão de estado e correcção de dados na administração, com motivo e histórico de auditoria.
- [x] Adicionar testes de elegibilidade, emissão única e validação pública.
- [x] Validar migrações e verificações do Django.
- [x] Corrigir erros TypeScript existentes nas páginas e componentes verificados; a compilação de tipos está limpa.
- [x] Adicionar gestão administrativa com pesquisa, filtros, paginação e trilho de auditoria.

## Limites

O fluxo segue boas práticas de credenciais digitais (identificador único, dados mínimos de verificação, QR/link público, estado verificável, revogação e trilho de auditoria). Não declara conformidade formal com um padrão de assinatura digital nem acreditação ou qualificação profissional oficial; o código UUID não substitui assinatura digital qualificada.
