'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [streamUrl, setStreamUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Estabiliza o callback para nao disparar re-renders do efeito de polling
  const onUploadCompleteRef = useRef(onUploadComplete);
  onUploadCompleteRef.current = onUploadComplete;

  // Sincroniza estado interno com props, mas só avança (nunca regride)
  // Ordem: pending → uploading → processing → ready → error
  const STATUS_ORDER: Record<string, number> = { pending: 0, uploading: 1, processing: 2, ready: 3, error: 999 };
  useEffect(() => {
    if (existingVideoStatus && (STATUS_ORDER[existingVideoStatus] || 0) > (STATUS_ORDER[status] || 0)) {
      setStatus(existingVideoStatus);
    }
  }, [existingVideoStatus]);

  // Carrega o stream token quando o video esta pronto (so uma vez)
  useEffect(() => {
    if (status === 'ready' && lessonId && !streamUrl) {
      console.log('[VideoUploader] Video pronto, a carregar preview...', { lessonId });
      const fetchStream = async () => {
        try {
          const token = localStorage.getItem('access_token');
          const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/stream-token/`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            setStreamUrl(`https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}`);
            console.log('[VideoUploader] Preview carregada com sucesso', { lessonId });
          }
        } catch { /* ignora erro de rede */ }
      };
      fetchStream();
    }
  }, [status, lessonId]);

  // Polling: verifica periodicamente se o video ficou pronto apos upload
  useEffect(() => {
    if ((status !== 'uploading' && status !== 'processing') || !lessonId) return;

    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (5s * 60)
    const authToken = localStorage.getItem('access_token');

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/video-status/`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.ready_to_stream || data.status === 'ready') {
          console.log('[VideoUploader] Video ficou pronto!', { lessonId });
          setStatus('ready');
          // refreshSilent sera chamado pelo onUploadComplete inicial — nao precisa repetir
          return;
        }
        if (data.status === 'error') {
          setStatus('error');
          setError('Falha no processamento do video.');
          return;
        }
        if (data.status === 'pendingupload') {
          // Upload nunca completou — permite re-upload
          setStatus('pending');
          setError('O upload nao foi concluido. Tente enviar o video novamente.');
          return;
          return;
        }
        // Actualiza status intermedio (pending -> processing, etc.)
        if (data.status && data.status !== status) {
          setStatus(data.status);
        }
      } catch { /* ignora */ }
    };

    const interval = setInterval(() => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }
      poll();
    }, 5000);

    // Primeira poll imediata
    poll();

    return () => clearInterval(interval);
  }, [status, lessonId]); // onUploadComplete via ref — nao dispara re-render

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const handleFile = async (file: File, retryCount = 0) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 3000;
    const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

    setUploading(true);
    setError('');
    setProgress(0);
    setStreamUrl('');

    try {
      if (file.size > 200 * 1024 * 1024) {
        throw new Error('Ficheiro excede 200MB. Comprima ou divida o video.');
      }

      // 1. Obter URL de upload do backend
      const token = localStorage.getItem('access_token');
      let res: Response;
      try {
        res = await fetch(`${API_URL}/courses/lessons/${lessonId}/upload-url/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {
        throw new Error('Falha de rede ao preparar o upload. Verifique a sua ligacao.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Erro do servidor (${res.status}). Tente novamente.`);
      }
      const { upload_url } = await res.json();
      setProgress(3);

      // 2. Upload com progresso real e timeout
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', upload_url);
        xhr.timeout = UPLOAD_TIMEOUT_MS;

        let lastProgress = 0;
        let stallCount = 0;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round(3 + (e.loaded / e.total) * 92);
            setProgress(pct);
            // Detecta estagnacao: sem progresso por 15s = conexao lenta/caiu
            if (pct === lastProgress) {
              stallCount++;
            } else {
              stallCount = 0;
              lastProgress = pct;
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve();
          } else {
            reject(new Error(`Erro do servidor Cloudflare (${xhr.status}).`));
          }
        };

        xhr.onerror = () => reject(new Error('Falha de rede durante o upload. Verifique a ligacao.'));
        xhr.ontimeout = () => reject(new Error('Upload excedeu o tempo limite (5 min). O ficheiro pode ser muito grande ou a ligacao estar lenta.'));
        xhr.onabort = () => reject(new Error('Upload cancelado.'));

        const body = new FormData();
        body.append('file', file);
        xhr.send(body);
      });

      setProgress(100);
      setStatus('processing');
      setUploading(false);
      console.log('[VideoUploader] Upload concluido, a aguardar processamento...', { lessonId });
      onUploadCompleteRef.current();
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido.';

      // Auto-retry para falhas de rede (nao para erros do servidor)
      if (retryCount < MAX_RETRIES && (
        msg.includes('rede') || msg.includes('ligacao') || msg.includes('timeout') || msg.includes('Tempo limite')
      )) {
        setError(`Tentativa ${retryCount + 1} falhou. A repetir em ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        return handleFile(file, retryCount + 1);
      }

      const prefix = retryCount > 0 ? `[${retryCount + 1}ª tentativa] ` : '';
      setError(prefix + msg);
      setUploading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-center gap-2">
          <AlertCircle size={16} /> {error}
          <button onClick={() => { setError(''); setStatus('pending'); }}
            className="ml-2 text-xs text-red-500 hover:underline">Tentar novamente</button>
        </div>
      )}

      {uploading ? (
        /* ─── Upload em progresso ─── */
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            <Loader2 size={16} className="animate-spin" /> A enviar video
          </span>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground font-mono tabular-nums">{progress}%</p>
        </div>
      ) : status === 'processing' ? (
        /* ─── Cloudflare a processar ─── */
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-50">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
            <span className="text-amber-700 text-sm font-medium">A processar video</span>
          </div>
          <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-amber-400 rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">
            O video esta a ser processado. A pagina atualizara automaticamente quando estiver pronto.
          </p>
        </div>
      ) : status === 'ready' ? (
        /* ─── Video pronto ─── */
        <div className="space-y-3">
          {streamUrl ? (
            <div className="relative rounded-lg overflow-hidden bg-black shadow-md">
              <iframe
                src={streamUrl}
                className="w-full aspect-video"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="Preview do video"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={28} className="text-green-600" />
              </div>
              <span className="font-medium text-green-700">Video pronto</span>
            </div>
          )}
          <button
            onClick={() => { setStreamUrl(''); setStatus('pending'); fileRef.current?.click(); }}
            className="text-sm text-accent hover:underline font-medium"
          >
            Substituir video
          </button>
        </div>
      ) : (
        /* ─── Estado inicial: upload area ─── */
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-3 w-full py-8 hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Upload size={28} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Arraste o video ou clique aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              MP4, MOV, AVI, WebM — ate 200MB
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
