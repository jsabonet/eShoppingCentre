'use client';

import { Clock, RefreshCw } from 'lucide-react';

interface SessionExpiryWarningProps {
  remaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export default function SessionExpiryWarning({ remaining, onExtend, onLogout }: SessionExpiryWarningProps) {
  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-amber-100 text-amber-700">
            <Clock size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Sessao a Expirar</h3>
            <p className="text-sm text-muted-foreground">
              A sua sessao ira expirar em <span className="font-bold text-amber-600">{formatTime(remaining)}</span>
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Por seguranca, sessoes inativas sao automaticamente encerradas. Clique em &ldquo;Continuar&rdquo; para manter a sessao ativa.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Sair
          </button>
          <button
            type="button"
            onClick={onExtend}
            className="flex-1 px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
