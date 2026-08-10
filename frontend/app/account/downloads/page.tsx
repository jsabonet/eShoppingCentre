'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download, FileText, File, Book, Video, Image, Music, Archive,
  AlertCircle, Loader2,
} from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ─── Tipos ───

interface DownloadItem {
  id: string;
  product_name: string;
  product_slug: string;
  digital_format: string;
  digital_file_size: string;
  download_count: number;
  download_limit: number;
  downloads_remaining: number;
  is_expired: boolean;
  is_exhausted: boolean;
  expires_at: string | null;
  order_number: string;
  purchased_at: string;
}

// ─── Helpers ───

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatExpiry(iso: string | null, isExpired: boolean): string {
  if (!iso) return 'Sem expiração';
  const d = new Date(iso);
  const prefix = isExpired ? 'Expirado em ' : 'Expira em ';
  return prefix + d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getFormatIcon(format: string) {
  const f = (format || '').toUpperCase();
  if (['PDF', 'EPUB', 'MOBI'].includes(f)) return Book;
  if (['DOCX', 'XLSX', 'PPTX', 'TXT', 'CSV'].includes(f)) return FileText;
  if (['MP4', 'MOV', 'AVI', 'WEBM', 'MKV'].includes(f)) return Video;
  if (['MP3', 'WAV', 'FLAC', 'AAC', 'OGG'].includes(f)) return Music;
  if (['PNG', 'JPG', 'JPEG', 'SVG', 'GIF', 'WEBP', 'PSD', 'AI'].includes(f)) return Image;
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(f)) return Archive;
  return File;
}

function getFormatLabel(format: string): string {
  const f = (format || '').toUpperCase();
  return f || 'Ficheiro';
}

// ─── Componente Principal ───

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const apiHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchDownloads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/products/downloads/`, { headers: apiHeaders() });
      if (!res.ok) throw new Error('Erro ao carregar downloads.');
      const data = await res.json();
      setDownloads(data.results || data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar.');
      setDownloads([]);
    } finally {
      setLoading(false);
    }
  }, [apiHeaders]);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  // ─── Handler de Download Seguro ───

  const handleDownload = useCallback(async (item: DownloadItem) => {
    if (item.is_expired || item.is_exhausted) return;

    setDownloadingId(item.id);
    setError('');
    let tokenRes: Response | null = null;

    try {
      // Passo 1: Obter token JWT
      tokenRes = await fetch(
        `${API_URL}/products/downloads/${item.id}/token/`,
        { headers: apiHeaders() }
      );

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        const detail = errData.detail || '';
        if (tokenRes.status === 429) {
          throw new Error('Muitas solicitações. Aguarde um momento.');
        }
        throw new Error(detail || 'Erro ao gerar token de download.');
      }

      const tokenData = await tokenRes.json();

      // Passo 2: Download com token
      const downloadUrl = `${API_URL}/products/downloads/${item.id}/file/?token=${encodeURIComponent(tokenData.token)}`;

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = tokenData.file_name || '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        fetchDownloads();
        setDownloadingId(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao descarregar.');
      setDownloadingId(null);
    }
  }, [apiHeaders, fetchDownloads]);

  // ─── Render ───

  if (loading) {
    return (
      <AccountLayout>
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} message="A carregar downloads..." />
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Meus Downloads</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            {error}
            <button onClick={fetchDownloads} className="ml-auto text-red-600 hover:text-red-800 underline text-xs">
              Tentar novamente
            </button>
          </div>
        )}

        {downloads.length > 0 ? (
          <div className="space-y-3">
            {downloads.map((item) => {
              const Icon = getFormatIcon(item.digital_format);
              const isDisabled = item.is_expired || item.is_exhausted;
              const isDownloading = downloadingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`bg-card border rounded-xl p-4 flex items-center gap-4 transition-all ${
                    item.is_expired ? 'border-red-200 bg-red-50/30' :
                    item.is_exhausted ? 'border-amber-200 bg-amber-50/30' :
                    'border-border'
                  }`}
                >
                  {/* Ícone do formato */}
                  <div className={`p-3 rounded-lg shrink-0 ${
                    item.is_expired ? 'bg-red-100' :
                    item.is_exhausted ? 'bg-amber-100' :
                    'bg-accent/10'
                  }`}>
                    <Icon size={24} className={
                      item.is_expired ? 'text-red-500' :
                      item.is_exhausted ? 'text-amber-500' :
                      'text-accent'
                    } />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.product_name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-medium">
                        {getFormatLabel(item.digital_format)}
                      </span>
                      {item.digital_file_size && <span>{item.digital_file_size}</span>}
                      <span>·</span>
                      <span>Comprado em {formatDate(item.purchased_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-1">
                      <span className={item.is_exhausted ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                        {item.download_count} de {item.download_limit} downloads
                      </span>
                      <span className={item.is_expired ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {formatExpiry(item.expires_at, item.is_expired)}
                      </span>
                    </div>
                  </div>

                  {/* Botão de download */}
                  <button
                    onClick={() => handleDownload(item)}
                    disabled={isDisabled || isDownloading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shrink-0 transition-colors ${
                      isDisabled
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-accent text-accent-foreground hover:bg-accent/90'
                    }`}
                    title={
                      item.is_expired ? 'Período de download expirou' :
                      item.is_exhausted ? 'Limite de downloads atingido' :
                      `Faltam ${item.downloads_remaining} download(s)`
                    }
                  >
                    {isDownloading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {isDisabled
                      ? (item.is_expired ? 'Expirado' : 'Esgotado')
                      : isDownloading ? 'A descarregar...' : 'Descarregar'
                    }
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Download size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-bold mb-2">Nenhum download disponível</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Os seus produtos digitais comprados aparecerão aqui.
            </p>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
