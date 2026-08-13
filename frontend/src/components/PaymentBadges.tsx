'use client';

import { useState } from 'react';
import Image from 'next/image';

const MOBILE_WALLETS = [
  { key: 'mpesa', name: 'M-Pesa', file: '/m-pesa.png' },
  { key: 'emola', name: 'e-Mola', file: '/e-mola.png' },
];

const CARD_METHODS = [
  { key: 'visa', name: 'Visa', file: '/visa.png' },
  { key: 'mastercard', name: 'Mastercard', file: '/mastercard.png' },
];

const TRUST_BADGES = [
  { key: 'compra_segura', name: 'Compra Segura', file: '/compra_segura.png' },
  { key: 'site_100_seguro', name: 'Site 100% Seguro', file: '/site_100_seguro.png' },
];

function LogoBadge({ method, variant = 'card' }: { 
  method: { key: string; name: string; file: string }; 
  variant?: 'wallet' | 'card' | 'badge';
}) {
  const [failed, setFailed] = useState(false);

  // UX: Alturas adaptadas para cada tipo de conteúdo gráfico
  const containerStyle = 
    variant === 'wallet' ? "h-14 w-full px-3" : // Carteiras móveis (logos verticais/complexos)
    variant === 'card' ? "h-11 w-full px-4" :    // Cartões (logos horizontais e limpos)
    "h-14 w-full px-3";                          // Selos de segurança

  if (failed) {
    return (
      <div className={`${containerStyle} bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center`} title={method.name}>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center line-clamp-1">
          {method.name}
        </span>
      </div>
    );
  }

  return (
    <div className={`${containerStyle} bg-white border border-gray-200 rounded-lg flex items-center justify-center transition-all hover:border-gray-300 hover:shadow-sm`}>
      <div className="relative w-full h-full flex items-center justify-center">
        <Image
          src={method.file}
          alt={method.name}
          fill
          sizes="(max-width: 640px) 50vw, 150px"
          className="object-contain p-1"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}

export default function PaymentBadges() {
  return (
    <div className="w-full max-w-sm sm:max-w-md space-y-4 pt-2">
      
      {/* Bloco de Pagamentos: Carteiras em cima, Cartões abaixo */}
      <div className="space-y-2" aria-label="Métodos de pagamento">
        {/* Linha 1: Carteiras Móveis */}
        <div className="grid grid-cols-2 gap-2">
          {MOBILE_WALLETS.map((m) => (
            <LogoBadge key={m.key} method={m} variant="wallet" />
          ))}
        </div>

        {/* Linha 2: Cartões Internacionais */}
        <div className="grid grid-cols-2 gap-2">
          {CARD_METHODS.map((m) => (
            <LogoBadge key={m.key} method={m} variant="card" />
          ))}
        </div>
      </div>

      {/* Linha 3: Selos de Segurança */}
      <div className="grid grid-cols-2 gap-2 pt-1" aria-label="Selos de segurança">
        {TRUST_BADGES.map((b) => (
          <LogoBadge key={b.key} method={b} variant="badge" />
        ))}
      </div>

    </div>
  );
}
