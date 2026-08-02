'use client';

import { useState, useRef, useEffect } from 'react';
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

  // Sincroniza estado interno com props (ex: após fetchBuilder recarregar dados)
  useEffect(() => {
    if (existingVideoStatus) {
      setStatus(existingVideoStatus);
    }
  }, [existingVideoStatus]);

  // Carrega o stream token quando o video esta pronto
  useEffect(() => {
    if (status === 'ready' && lessonId) {
      const fetchStream = async () => {
        try {
          const token = localStorage.getItem('access_token');
          const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/stream-token/`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            setStreamUrl(`https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}`);
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
          setStatus('ready');
          onUploadComplete(); // refresh o builder
          return;
        }
        if (data.status === 'error') {
          setStatus('error');
          setError('Falha no processamento do video.');
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
  }, [status, lessonId, onUploadComplete]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const handleFile = async (file: File) => {
    setUploading(true);
    setError('');
    setProgress(0);
    setStreamUrl('');

    try {
      if (file.size > 200 * 1024 * 1024) {
        throw new Error('Upload directo suporta apenas videos ate 200MB.');
      }

      // 1. Obter URL de upload do backend
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/upload-url/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Erro ao obter URL de upload');
      }
      const { upload_url } = await res.json();
      setProgress(5);

      // 2. Upload com progresso real (XMLHttpRequest)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', upload_url);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            // 5% a 95% proporcional ao upload real
            const pct = Math.round(5 + (e.loaded / e.total) * 90);
            setProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve();
          } else {
            reject(new Error('Falha no upload do video para o Cloudflare Stream.'));
          }
        };

        xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
        xhr.ontimeout = () => reject(new Error('Timeout do upload.'));

        const body = new FormData();
        body.append('file', file);
        xhr.send(body);
      });

      setStatus('processing');
      setUploading(false);
      onUploadComplete();
    } catch (err: any) {
      setError(err?.message || 'Erro ao iniciar upload.');
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
            <span className="text-amber-700 text-sm font-medium">A processar video no Cloudflare</span>
          </div>
          <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-amber-400 rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">
            O video esta a ser codificado. Pode continuar a editar o curso — <button onClick={onUploadComplete} className="text-accent hover:underline font-medium">verificar estado</button>
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
