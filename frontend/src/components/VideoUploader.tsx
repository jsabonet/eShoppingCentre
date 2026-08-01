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
      if (!res.ok) throw new Error('Erro ao obter URL de upload');
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
