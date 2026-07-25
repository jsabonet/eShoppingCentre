"use client";

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if user previously dismissed or installed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const installed = localStorage.getItem('pwa-installed');
    
    if (dismissed || installed) {
      return;
    }

    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    const handleInstalled = () => {
      localStorage.setItem('pwa-installed', 'true');
      setShowInstallPrompt(false);
    };

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowInstructions(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-installed', 'true');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  // Don't render anything if already installed or dismissed
  if (!showInstallPrompt && !showInstructions) {
    return null;
  }

  return (
    <>
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-2xl border border-border p-6 z-50 animate-in slide-in-from-bottom">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Download className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Instalar E-Shopping</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Instale o app para uma experiência mais rápida e acesso offline
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
                >
                  Instalar App
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 border border-border hover:bg-muted rounded-md transition-colors"
                >
                  Depois
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Como Instalar o App</h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-2 hover:bg-muted rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-accent">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Toque no botão Compartilhar</p>
                      <p className="text-sm text-muted-foreground">
                        No Safari, toque no ícone de compartilhamento na parte inferior
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-accent">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Role para baixo e toque em "Adicionar à Tela de Início"</p>
                      <p className="text-sm text-muted-foreground">
                        Use a opção "Adicionar à Tela de Início" no menu
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-accent">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Confirme tocando em "Adicionar"</p>
                      <p className="text-sm text-muted-foreground">
                        O app será adicionado à sua tela inicial
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-accent">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Toque no menu do navegador</p>
                      <p className="text-sm text-muted-foreground">
                        Toque nos três pontos (⋮) no canto superior direito
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-accent">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Toque em "Instalar app" ou "Adicionar à tela inicial"</p>
                      <p className="text-sm text-muted-foreground">
                        Selecione esta opção no menu
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-accent">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Confirme a instalação</p>
                      <p className="text-sm text-muted-foreground">
                        Toque em "Instalar" quando solicitado
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Smartphone className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Vantagens do App:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>✓ Acesso mais rápido</li>
                    <li>✓ Funciona offline</li>
                    <li>✓ Notificações push</li>
                    <li>✓ Não ocupa espaço na loja</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full mt-4 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
