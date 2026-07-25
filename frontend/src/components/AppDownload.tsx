"use client";

import { useState, useEffect } from 'react';
import { Smartphone, Monitor, Download, CheckCircle, ChevronRight, X, Wifi, Zap, Shield, Bell } from 'lucide-react';

export default function AppDownload() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Browser doesn't support direct install, show manual instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setShowIOSInstructions(true);
      } else {
        setShowAndroidInstructions(true);
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isInstalled) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-b from-accent/5 to-background">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-4">App Instalado com Sucesso!</h1>
            <p className="text-lg text-muted-foreground mb-8">
              O app E-Shopping Centre já está instalado no seu dispositivo. 
              Você pode encontrá-lo na tela inicial.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-muted/50 rounded-xl">
                <Zap className="w-8 h-8 text-accent mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Acesso Rápido</h3>
                <p className="text-sm text-muted-foreground">Abra o app diretamente da tela inicial</p>
              </div>
              <div className="p-6 bg-muted/50 rounded-xl">
                <Wifi className="w-8 h-8 text-accent mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Funciona Offline</h3>
                <p className="text-sm text-muted-foreground">Navegue mesmo sem conexão com a internet</p>
              </div>
              <div className="p-6 bg-muted/50 rounded-xl">
                <Bell className="w-8 h-8 text-accent mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Notificações</h3>
                <p className="text-sm text-muted-foreground">Receba ofertas exclusivas em tempo real</p>
              </div>
            </div>
            <a href="/" className="inline-block px-8 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors">
              Começar a Comprar
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-b from-accent/5 to-background">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/10 rounded-2xl mb-6">
            <Smartphone className="w-12 h-12 text-accent" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Baixe o App E-Shopping
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Tenha milhões de produtos na palma da sua mão
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold">
            <CheckCircle size={20} />
            <span>Ganhe 10% OFF na primeira compra pelo app!</span>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Acesso Instantâneo</h3>
                <p className="text-muted-foreground">
                  Abra o app diretamente da tela inicial sem precisar digitar o endereço
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Wifi className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Funciona Offline</h3>
                <p className="text-muted-foreground">
                  Navegue pelos produtos mesmo sem conexão com a internet
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Bell className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Notificações Push</h3>
                <p className="text-muted-foreground">
                  Receba ofertas exclusivas e acompanhe seus pedidos em tempo real
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">100% Seguro</h3>
                <p className="text-muted-foreground">
                  Mesma segurança do site com criptografia de ponta a ponta
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Install Buttons */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Como Instalar</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Android */}
            <div className="border-2 border-border rounded-xl p-6 hover:border-accent transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Monitor className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Android</h3>
                  <p className="text-sm text-muted-foreground">Chrome, Edge, Samsung Internet</p>
                </div>
              </div>
              <button
                onClick={() => isAndroid ? handleInstall() : setShowAndroidInstructions(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                <Download size={20} />
                {isAndroid ? 'Instalar App' : 'Ver Instruções'}
              </button>
            </div>

            {/* iOS */}
            <div className="border-2 border-border rounded-xl p-6 hover:border-accent transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">iPhone / iPad</h3>
                  <p className="text-sm text-muted-foreground">Safari</p>
                </div>
              </div>
              <button
                onClick={() => isIOS ? handleInstall() : setShowIOSInstructions(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                <Download size={20} />
                {isIOS ? 'Instalar App' : 'Ver Instruções'}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-accent/5 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              💡 <strong>Dica:</strong> O app ocupa menos de 1MB e não precisa de loja de aplicativos!
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Perguntas Frequentes</h2>
          <div className="space-y-4">
            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">O app é gratuito?</h3>
              <p className="text-muted-foreground">Sim! O app é completamente gratuito e não ocupa espaço na loja de aplicativos.</p>
            </div>
            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">Funciona em qualquer celular?</h3>
              <p className="text-muted-foreground">
                Sim! Funciona em qualquer smartphone moderno com Android 5.0+ ou iOS 11.0+.
              </p>
            </div>
            <div className="border-b border-border pb-4">
              <h3 className="font-semibold mb-2">Preciso de internet para usar?</h3>
              <p className="text-muted-foreground">
                O app funciona offline para navegação básica, mas você precisa de internet para fazer compras e ver preços atualizados.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Como atualizo o app?</h3>
              <p className="text-muted-foreground">
                O app atualiza automaticamente! Você sempre terá a versão mais recente sem precisar fazer nada.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Android Instructions Modal */}
      {showAndroidInstructions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Instalar no Android</h3>
              <button
                onClick={() => setShowAndroidInstructions(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold">Abra o menu do navegador</p>
                  <p className="text-sm text-muted-foreground">
                    Toque nos três pontos (⋮) no canto superior direito do Chrome
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold">Toque em "Instalar app"</p>
                  <p className="text-sm text-muted-foreground">
                    Ou "Adicionar à tela inicial" se não ver a opção de instalar
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    Toque em "Instalar" quando solicitado
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ Pronto! O app será adicionado à sua tela inicial e você poderá abri-lo como qualquer outro aplicativo.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidInstructions(false)}
              className="w-full mt-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Instalar no iPhone/iPad</h3>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">
                  ⚠️ Importante: Use o Safari para instalar o app. Outros navegadores não suportam esta funcionalidade no iOS.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold">Abra no Safari</p>
                  <p className="text-sm text-muted-foreground">
                    Certifique-se de estar usando o Safari, não o Chrome ou outro navegador
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold">Toque no botão Compartilhar</p>
                  <p className="text-sm text-muted-foreground">
                    É o ícone quadrado com seta para cima na parte inferior da tela
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold">Role e toque em "Adicionar à Tela de Início"</p>
                  <p className="text-sm text-muted-foreground">
                    Use a barra de rolagem para encontrar esta opção
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  4
                </div>
                <div>
                  <p className="font-semibold">Toque em "Adicionar"</p>
                  <p className="text-sm text-muted-foreground">
                    Confirme no canto superior direito
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ Pronto! O app aparecerá na sua tela inicial como um aplicativo normal.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full mt-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
