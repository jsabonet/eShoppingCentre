# Análise de Segurança — Sistema de Reprodução de Vídeos

> Data: 2026-08-09
> Sistema: eShoppingCentre — Cursos Online
> Componentes: `LessonStreamTokenView`, `CourseVideoPlayer`, `generate_stream_token`

---

## ✅ Medidas de Segurança Implementadas

### 1. Autenticação Obrigatória

```python
# backend/apps/courses/views_cloudflare.py — LessonStreamTokenView
permission_classes = [permissions.IsAuthenticated]
```

Apenas utilizadores autenticados (JWT válido) podem obter tokens de stream.

---

### 2. Verificação de Matrícula e Acesso

```python
# Para alunos:
enrollment = Enrollment.objects.filter(user=request.user, course=course).first()
if not enrollment:
    return Response({'detail': 'Nao esta matriculado neste curso.'}, status=403)
if not enrollment.has_access:
    return Response({'detail': 'O seu acesso a este curso expirou.'}, status=403)
```

- Só alunos **matriculados** podem ver aulas não-gratuitas
- Verifica `has_access` (data de expiração do acesso)
- Exceção: aulas `is_free_preview` são visíveis para qualquer autenticado

---

### 3. Rate Limiting por Utilizador

```python
class StreamTokenThrottle(UserRateThrottle):
    rate = '30/minute'
    scope = 'stream_token'
```

- Máximo: **30 tokens por minuto** por utilizador
- Previne abuso de geração de tokens

---

### 4. Token JWT Assinado com Expiração

```python
# backend/apps/courses/services/cloudflare_stream.py
def generate_stream_token(video_uid, max_duration_seconds=7200):
    now = int(time.time())
    payload = {
        'sub': video_uid,
        'kid': jwt_secret[:32],
        'exp': now + max_duration_seconds,  # 2 horas
        'iat': now,
        'accessRules': [{'type': 'ip.src', 'action': 'allow'}]
    }
    token = jwt.encode(payload, jwt_secret, algorithm='HS256')
    return token
```

- Token assinado com **HS256** usando `CLOUDFLARE_JWT_SECRET`
- Expira após **2 horas** (configurável)
- Cloudflare Stream rejeita tokens inválidos ou expirados

---

### 5. Player via Iframe (Cloudflare Stream)

```typescript
// frontend/src/components/CourseVideoPlayer.tsx
ifr.src = `https://iframe.cloudflarestream.com/${video_uid}?token=${token}&controls=true&preload=auto&autoplay=true`;
```

- Token embutido no iframe (não exposto em URL pública do browser)
- Cloudflare fornece proteção CDN (DDoS, hotlinking)

---

## ⚠️ Vulnerabilidades Identificadas

### 🔴 Alta — Token JWT sem restrição de IP

**Problema**: O `accessRules` atual permite **qualquer IP**:
```python
'accessRules': [{'type': 'ip.src', 'action': 'allow'}]
```

**Risco**: Um utilizador pode copiar o token JWT e partilhá-lo — funcionará em qualquer rede até expirar (2h).

**Correção proposta**:
```python
def generate_stream_token(video_uid, client_ip=None, max_duration_seconds=7200):
    access_rules = [{'type': 'any', 'action': 'allow'}]
    if client_ip:
        access_rules = [{'type': 'ip.src', 'ip': [client_ip], 'action': 'allow'}]
    
    payload = {
        'sub': video_uid,
        'kid': jwt_secret[:32],
        'exp': now + max_duration_seconds,
        'iat': now,
        'accessRules': access_rules,
    }
```

E na view:
```python
client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or \
            request.META.get('REMOTE_ADDR')
token = generate_stream_token(lesson.cloudflare_video_uid, client_ip=client_ip)
```

---

### 🟠 Média — Token exposto no DOM

**Problema**: O iframe src contém o token JWT. Com DevTools (F12), qualquer pessoa pode copiá-lo.

**Mitigação atual**: Token expira em 2h — janela limitada de abuso.

**Melhoria**: Reduzir expiração para **30 minutos** e renovar automaticamente via `postMessage` entre iframe e página.

---

### 🟠 Média — Sem `requireSignedURLs` no Cloudflare

**Problema**: Se o video_uid for conhecido, o manifesto HLS pode ser acedido sem token (dependendo da configuração Cloudflare).

**Correção**: Ativar `requireSignedURLs` no dashboard Cloudflare Stream → Settings → Security.

---

### 🟡 Baixa — Sem limite de streams simultâneos

**Problema**: Nada impede um utilizador de partilhar credenciais e múltiplas pessoas assistirem ao mesmo tempo.

**Correção proposta**:
- Adicionar campo `active_stream_token` ao `Enrollment`
- Ao gerar token, guardar timestamp + IP
- Se outro IP pedir token em < 5 min, revogar o anterior

---

### 🟡 Baixa — Token em localStorage

**Problema**: O `access_token` JWT do Django está em localStorage. Em caso de XSS, o atacante rouba o token e pode gerar tokens de stream.

**Mitigação**: Usar `httpOnly` cookies para o JWT principal (requer mudança no fluxo de auth).

---

## 📊 Resumo

| Camada | Estado |
|--------|--------|
| Autenticação | ✅ Implementada |
| Autorização (matrícula) | ✅ Implementada |
| Rate Limiting | ✅ Implementada |
| Token JWT assinado | ✅ Implementada |
| Expiração de token | ✅ 2 horas |
| Restrição de IP no JWT | ❌ Não implementada |
| Prevenção de download | ❌ Depende do Cloudflare |
| Limite de streams simultâneos | ❌ Não implementado |
| Watermarking | ❌ Não implementado |

---

## 🎯 Próximos Passos (por prioridade)

1. ~~Restringir JWT ao IP do cliente~~ ✅ Feito
2. ~~Ativar `requireSignedURLs` no Cloudflare~~ ✅ Feito (via API no `create_direct_upload`)
3. ~~Reduzir expiração do token~~ ✅ Ajustado para 6h (compatível com aulas longas)
4. Limitar streams simultâneos — esforço médio
5. Migrar auth para httpOnly cookies — esforço alto
