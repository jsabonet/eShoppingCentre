# Guia de Implementacao -- Cloudflare Stream para Cursos

> Estrategia profissional de upload e streaming de videos para o eShoppingCentre.
> O vendedor faz upload directo. Nos gerimos tudo via API. O aluno ve com seguranca JWT.

---

## 1. Visao Geral

```
┌──────────────┐     Upload (TUS)      ┌──────────────────┐
│   Vendedor   │ ─────────────────────>│  Cloudflare       │
│   (Browser)  │ <── URL de upload ─── │  Stream           │
└──────────────┘     (nosso backend)   └────────┬─────────┘
                                                │
┌──────────────┐     Token JWT (2h)    ┌───────▼─────────┐
│    Aluno     │ <──────────────────── │  Nosso Backend   │
│   (Player)   │ ──── Stream ────────>│  (Django)        │
└──────────────┘                       └──────────────────┘
```

Principios:
- O video nunca passa pelo nosso servidor
- O vendedor nao sabe que o Cloudflare existe
- Apenas guardamos IDs na base de dados
- Seguranca via token JWT com tempo de expiracao

---

## 2. Pre-requisitos

### 2.1 Conta Cloudflare

1. Criar conta em https://dash.cloudflare.com
2. Activar o servico **Stream** (subscricao)
3. Obter as credenciais:
   - `ACCOUNT_ID` — no dashboard, URL: `dash.cloudflare.com/{ACCOUNT_ID}`
   - `API_TOKEN` — criar em Profile > API Tokens, com permissao `Stream:Edit`

### 2.2 Variaveis de Ambiente

Adicionar ao `.env` do backend:

```env
CLOUDFLARE_ACCOUNT_ID=abc123...
CLOUDFLARE_API_TOKEN=def456...
CLOUDFLARE_STREAM_DOMAIN=customer-xyz.cloudflarestream.com
CLOUDFLARE_JWT_SECRET=chave-secreta-para-assinar-tokens
```

---

## 3. Backend -- Django

### 3.1 Models

Ficheiro: `backend/apps/courses/models.py`

Adicionar ao modelo `CourseLesson`:

```python
class CourseLesson(BaseModel):
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_free_preview = models.BooleanField(default=False)

    # --- Cloudflare Stream ---
    video_provider = models.CharField(max_length=20, default='cloudflare',
                                      choices=[('cloudflare', 'Cloudflare Stream'), ('vimeo', 'Vimeo'), ('youtube', 'YouTube')])
    cloudflare_video_uid = models.CharField(max_length=100, blank=True,
                                            help_text='UID do video no Cloudflare Stream')
    cloudflare_video_status = models.CharField(max_length=20, default='pending',
                                               choices=[
                                                   ('pending', 'Aguardando Upload'),
                                                   ('uploading', 'A Enviar'),
                                                   ('processing', 'A Processar'),
                                                   ('ready', 'Pronto'),
                                                   ('error', 'Erro'),
                                               ])
    video_duration = models.PositiveIntegerField(default=0, help_text='Duracao em segundos')
    video_thumbnail = models.URLField(blank=True)
    video_url = models.URLField(blank=True, help_text='URL publica do video (legado: Vimeo/YouTube)')
    # --- Fim Cloudflare ---

    content = models.TextField(blank=True)
    watched_duration = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return self.title
```

Depois de alterar o modelo:

```bash
python manage.py makemigrations courses
python manage.py migrate courses
```

### 3.2 Servico Cloudflare Stream

Ficheiro: `backend/apps/courses/services/cloudflare_stream.py`

```python
import requests
import jwt
import time
from django.conf import settings

ACCOUNT_ID = settings.CLOUDFLARE_ACCOUNT_ID
API_TOKEN = settings.CLOUDFLARE_API_TOKEN
BASE_URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/stream'
HEADERS = {'Authorization': f'Bearer {API_TOKEN}'}


def create_direct_upload(max_duration_seconds=3600):
    """
    Obtem um URL de upload directo do Cloudflare.
    O frontend usa este URL para enviar o video directamente (TUS protocol).
    """
    response = requests.post(
        BASE_URL,
        headers=HEADERS,
        json={
            'maxDurationSeconds': max_duration_seconds,
        }
    )
    response.raise_for_status()
    data = response.json()['result']
    return {
        'upload_url': data['uploadURL'],
        'video_uid': data['uid'],
    }


def get_video_status(video_uid):
    """Verifica o estado de um video (pending, processing, ready, error)."""
    response = requests.get(f'{BASE_URL}/{video_uid}', headers=HEADERS)
    response.raise_for_status()
    result = response.json()['result']
    return {
        'status': result['status']['state'],
        'ready_to_stream': result.get('readyToStream', False),
        'duration': result.get('duration', 0),
        'thumbnail': result.get('thumbnail', ''),
    }


def delete_video(video_uid):
    """Remove um video do Cloudflare Stream."""
    response = requests.delete(f'{BASE_URL}/{video_uid}', headers=HEADERS)
    response.raise_for_status()
    return True


def generate_stream_token(video_uid, max_duration_seconds=7200):
    """
    Gera um token JWT assinado para o player.
    O token expira apos max_duration_seconds (default: 2 horas).
    Sera gerado novamente se o aluno fizer refresh.
    """
    now = int(time.time())
    payload = {
        'sub': video_uid,
        'kid': settings.CLOUDFLARE_JWT_SECRET[:32],
        'exp': now + max_duration_seconds,
        'iat': now,
        'accessRules': [
            {
                'type': 'ip.src',
                'action': 'allow',
            }
        ]
    }
    token = jwt.encode(payload, settings.CLOUDFLARE_JWT_SECRET, algorithm='HS256')
    return token


def get_stream_url(video_uid):
    """Retorna a URL base do manifesto HLS/DASH para o video."""
    return f'https://{settings.CLOUDFLARE_STREAM_DOMAIN}/{video_uid}/manifest/video.m3u8'
```

### 3.3 Endpoints API

Ficheiro: `backend/apps/courses/views_cloudflare.py`

```python
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import CourseLesson, Enrollment
from .services.cloudflare_stream import (
    create_direct_upload,
    get_video_status,
    delete_video,
    generate_stream_token,
    get_stream_url,
)


class LessonUploadURLCreateView(APIView):
    """
    POST /api/v1/courses/lessons/{lesson_id}/upload-url/
    Obtem um URL de upload directo do Cloudflare Stream.
    So o dono do curso pode aceder.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)

        # Verificar que o request.user e o dono da loja do curso
        course = lesson.module.course
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        try:
            upload_data = create_direct_upload()

            # Actualizar a aula com o video_uid
            lesson.cloudflare_video_uid = upload_data['video_uid']
            lesson.cloudflare_video_status = 'uploading'
            lesson.video_provider = 'cloudflare'
            lesson.save()

            return Response({
                'upload_url': upload_data['upload_url'],
                'video_uid': upload_data['video_uid'],
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class LessonVideoStatusView(APIView):
    """
    GET /api/v1/courses/lessons/{lesson_id}/video-status/
    Verifica o estado do video (pending, processing, ready, error).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)

        course = lesson.module.course
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        if not lesson.cloudflare_video_uid:
            return Response({'status': 'pending', 'ready_to_stream': False})

        try:
            status_data = get_video_status(lesson.cloudflare_video_uid)

            # Actualizar estado local
            if status_data['ready_to_stream'] and lesson.cloudflare_video_status != 'ready':
                lesson.cloudflare_video_status = 'ready'
                lesson.video_duration = status_data.get('duration', 0)
                lesson.video_thumbnail = status_data.get('thumbnail', '')
                lesson.save()
            elif status_data['status'] == 'error':
                lesson.cloudflare_video_status = 'error'
                lesson.save()

            return Response(status_data)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class LessonStreamTokenView(APIView):
    """
    POST /api/v1/courses/lessons/{lesson_id}/stream-token/
    Gera token JWT para o player. So alunos matriculados podem aceder.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)

        course = lesson.module.course

        # Aulas gratis: qualquer pessoa autenticada pode ver
        if lesson.is_free_preview:
            pass
        else:
            # Verificar matricula
            has_access = Enrollment.objects.filter(
                user=request.user,
                course=course,
                completed=False,
            ).exists()
            if not has_access:
                return Response({'detail': 'Nao esta matriculado neste curso.'}, status=403)

        if not lesson.cloudflare_video_uid:
            return Response({'detail': 'Video ainda nao disponivel.'}, status=404)

        token = generate_stream_token(lesson.cloudflare_video_uid)
        stream_url = get_stream_url(lesson.cloudflare_video_uid)

        return Response({
            'token': token,
            'stream_url': stream_url,
            'video_uid': lesson.cloudflare_video_uid,
        })
```

### 3.4 URLs

Ficheiro: `backend/apps/courses/urls.py`

```python
from django.urls import path
from .views_cloudflare import (
    LessonUploadURLCreateView,
    LessonVideoStatusView,
    LessonStreamTokenView,
)

urlpatterns = [
    # ... urls existentes ...
    path('lessons/<uuid:lesson_id>/upload-url/', LessonUploadURLCreateView.as_view(), name='lesson-upload-url'),
    path('lessons/<uuid:lesson_id>/video-status/', LessonVideoStatusView.as_view(), name='lesson-video-status'),
    path('lessons/<uuid:lesson_id>/stream-token/', LessonStreamTokenView.as_view(), name='lesson-stream-token'),
]
```

### 3.5 Webhook (Opcional)

Endpoint para o Cloudflare notificar quando o video termina de processar:

```python
class CloudflareWebhookView(APIView):
    """
    POST /api/v1/courses/webhooks/cloudflare/
    Cloudflare envia notificacao quando o video termina de processar.
    """
    permission_classes = []  # Validado por assinatura secreta

    def post(self, request):
        # Validar assinatura do webhook
        signature = request.headers.get('Webhook-Signature')
        if not self._verify_signature(request.body, signature):
            return Response({'detail': 'Assinatura invalida.'}, status=403)

        payload = request.data
        video_uid = payload.get('uid')
        status = payload.get('status', {}).get('state')

        if video_uid and status == 'ready':
            try:
                lesson = CourseLesson.objects.get(cloudflare_video_uid=video_uid)
                lesson.cloudflare_video_status = 'ready'
                lesson.video_duration = payload.get('duration', 0)
                lesson.video_thumbnail = payload.get('thumbnail', '')
                lesson.save()
            except CourseLesson.DoesNotExist:
                pass

        return Response({'ok': True})

    def _verify_signature(self, body, signature):
        # Implementar verificacao HMAC conforme documentacao Cloudflare
        import hmac
        import hashlib
        secret = settings.CLOUDFLARE_STREAM_SIGNING_SECRET.encode()
        expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or '')
```

---

## 4. Frontend -- Next.js

### 4.1 Biblioteca de Upload (TUS)

Instalar:

```bash
cd frontend
npm install tus-js-client
```

### 4.2 Componente VideoUploader

Ficheiro: `frontend/src/components/VideoUploader.tsx`

```typescript
'use client';

import { useState, useRef } from 'react';
import * as tus from 'tus-js-client';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';

interface VideoUploaderProps {
  lessonId: string;
  onUploadComplete: () => void;
  existingVideoStatus?: string;
}

export default function VideoUploader({ lessonId, onUploadComplete, existingVideoStatus }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>(existingVideoStatus || 'pending');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const handleFile = async (file: File) => {
    setUploading(true);
    setError('');
    setProgress(0);

    try {
      // 1. Obter URL de upload do backend
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/upload-url/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const { upload_url } = await res.json();

      // 2. Upload via TUS
      const upload = new tus.Upload(file, {
        uploadUrl: upload_url,
        onProgress(bytesUploaded, bytesTotal) {
          const pct = Math.round((bytesUploaded / (bytesTotal || 1)) * 100);
          setProgress(pct);
        },
        onSuccess() {
          setStatus('processing');
          setUploading(false);
          onUploadComplete();
        },
        onError(err) {
          setError('Erro no upload. Tente novamente.');
          setUploading(false);
        },
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        retryDelays: [0, 3000, 5000, 10000], // Retoma automatica
      });

      upload.start();
    } catch (err: any) {
      setError('Erro ao iniciar upload.');
      setUploading(false);
    }
  };

  const statusDisplay = {
    pending: { label: 'Sem video', icon: Upload, color: 'text-muted-foreground' },
    uploading: { label: 'A enviar...', icon: Loader2, color: 'text-blue-600' },
    processing: { label: 'A processar...', icon: Loader2, color: 'text-amber-600' },
    ready: { label: 'Pronto', icon: Check, color: 'text-green-600' },
    error: { label: 'Erro', icon: AlertCircle, color: 'text-red-600' },
  }[status] || { label: status, icon: AlertCircle, color: 'text-muted-foreground' };

  const StatusIcon = statusDisplay.icon;

  return (
    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {uploading ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 size={24} className="animate-spin" />
            <span className="font-medium">A enviar video...</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{progress}%</p>
        </div>
      ) : status === 'processing' ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-amber-500" />
          <p className="font-medium text-amber-600">Video enviado. A processar...</p>
          <p className="text-sm text-muted-foreground">
            Isto pode demorar alguns minutos. Pode continuar a editar o curso.
          </p>
        </div>
      ) : status === 'ready' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <Check size={24} />
            <span className="font-medium">Video pronto</span>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm text-accent hover:underline"
          >
            Substituir video
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-3 w-full py-8 hover:bg-muted/30 transition-colors rounded-lg"
        >
          <Upload size={40} className="text-muted-foreground" />
          <div>
            <p className="font-medium">Arraste o video ou clique aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              MP4, MOV, AVI, WebM — ate 4GB
            </p>
          </div>
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 flex items-center justify-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}
    </div>
  );
}
```

### 4.3 Componente VideoPlayer (Aluno)

Ficheiro: `frontend/src/components/CourseVideoPlayer.tsx`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface CourseVideoPlayerProps {
  lessonId: string;
  isFreePreview?: boolean;
}

export default function CourseVideoPlayer({ lessonId, isFreePreview }: CourseVideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/stream-token/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();

        if (!mounted) return;

        if (data.token && data.stream_url) {
          // Embed do Cloudflare Stream com token
          const iframe = document.createElement('iframe');
          iframe.src = `https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}`;
          iframe.className = 'w-full aspect-video rounded-lg';
          iframe.allowFullscreen = true;

          if (playerRef.current) {
            playerRef.current.innerHTML = '';
            playerRef.current.appendChild(iframe);
          }
          setLoading(false);
        } else {
          setError(data.detail || 'Video nao disponivel.');
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setError('Erro ao carregar o video.');
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [lessonId]);

  if (loading) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-white/60" />
          <p className="text-white/60 text-sm">A carregar video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <AlertCircle size={32} />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return <div ref={playerRef} className="rounded-lg overflow-hidden" />;
}
```

### 4.4 Pagina do Construtor de Curso

Ficheiro: `frontend/app/seller/courses/[id]/builder/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, GripVertical, Eye, EyeOff, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import VideoUploader from '@/src/components/VideoUploader';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface ModuleData {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: LessonData[];
}

interface LessonData {
  id: string;
  title: string;
  description: string;
  is_free_preview: boolean;
  sort_order: number;
  video_provider: string;
  cloudflare_video_status: string;
}

export default function CourseBuilderPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_URL}/courses/${courseId}/builder/`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        setModules(data.modules || []);
        // Expandir todos os modulos inicialmente
        setExpandedModules(new Set((data.modules || []).map((m: ModuleData) => m.id)));
      } catch {} finally { setLoading(false); }
    })();
  }, [courseId]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={32} message="A carregar curso..." />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Construtor de Curso</h1>
            <p className="text-sm text-muted-foreground">
              Organize modulos e aulas. Arraste para reordenar.
            </p>
          </div>
          <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium">
            <Plus size={16} className="inline mr-1" /> Novo Modulo
          </button>
        </div>

        {modules.map((mod) => (
          <div key={mod.id} className="mb-4 border border-border rounded-xl bg-card">
            {/* Cabecalho do modulo */}
            <button
              onClick={() => toggleModule(mod.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors rounded-xl"
            >
              <GripVertical size={16} className="text-muted-foreground" />
              {expandedModules.has(mod.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-bold flex-1 text-left">{mod.title}</span>
              <span className="text-xs text-muted-foreground">{mod.lessons.length} aulas</span>
            </button>

            {/* Aulas */}
            {expandedModules.has(mod.id) && (
              <div className="px-4 pb-4 space-y-2">
                {mod.lessons.map((lesson) => (
                  <div key={lesson.id} className="border border-border rounded-lg p-4 bg-background">
                    <div className="flex items-center gap-3 mb-3">
                      <GripVertical size={14} className="text-muted-foreground" />
                      <input
                        type="text"
                        defaultValue={lesson.title}
                        className="flex-1 px-2 py-1 border border-transparent hover:border-border rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-ring text-sm font-medium"
                        placeholder="Titulo da aula..."
                      />
                      <button title={lesson.is_free_preview ? 'Preview gratis' : 'Aula privada'}>
                        {lesson.is_free_preview ? <Eye size={16} className="text-green-500" /> : <EyeOff size={16} className="text-muted-foreground" />}
                      </button>
                      <button title="Remover aula">
                        <Trash2 size={16} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>

                    <VideoUploader
                      lessonId={lesson.id}
                      existingVideoStatus={lesson.cloudflare_video_status}
                      onUploadComplete={() => {
                        // Recarregar status
                      }}
                    />
                  </div>
                ))}

                <button className="w-full py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                  <Plus size={14} className="inline mr-1" /> Adicionar Aula
                </button>
              </div>
            )}
          </div>
        ))}

        {modules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            <p>Nenhum modulo ainda. Clique em "Novo Modulo" para comecar.</p>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
```

---

## 5. Checklist de Implementacao

### Fase 1 -- Setup (30 min)
- [ ] Criar conta Cloudflare e activar Stream
- [ ] Adicionar `CLOUDFLARE_*` ao `.env`
- [ ] Instalar `PyJWT` e `requests` no backend
- [ ] Instalar `tus-js-client` no frontend

### Fase 2 -- Backend (2-3 horas)
- [ ] Actualizar modelo `CourseLesson` com campos Cloudflare
- [ ] Criar e aplicar migracao
- [ ] Criar `services/cloudflare_stream.py`
- [ ] Criar `views_cloudflare.py` com 3 endpoints
- [ ] Adicionar URLs
- [ ] (Opcional) Configurar webhook

### Fase 3 -- Frontend (3-4 horas)
- [ ] Criar componente `VideoUploader`
- [ ] Criar componente `CourseVideoPlayer`
- [ ] Criar pagina `/seller/courses/[id]/builder`
- [ ] Conectar ao fluxo de criacao de curso

### Fase 4 -- Integracao (1 hora)
- [ ] Redireccionar apos criar produto curso → builder
- [ ] Adicionar link no menu SellerLayout
- [ ] Testar upload de video de 100MB+
- [ ] Testar visualizacao como aluno

---

*Julho 2026*
