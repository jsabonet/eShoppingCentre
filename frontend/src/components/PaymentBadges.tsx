'use client';

import { useState } from 'react';

// Logos oficiais (marcas registadas) — localizados na raiz de /public
const PAYMENT_METHODS = [
  { key: 'mpesa', name: 'M-Pesa', file: '/m-pesa.png' },
  { key: 'emola', name: 'e-Mola', file: '/e-mola.png' },
  { key: 'visa', name: 'Visa', file: '/visa.png' },
  { key: 'mastercard', name: 'Mastercard', file: '/mastercard.png' },
];

// Selos de segurança/confiança
const TRUST_BADGES = [
  { key: 'compra_segura', name: 'Compra Segura', file: '/compra_segura.png' },
  { key: 'site_100_seguro', name: 'Site 100% Seguro', file: '/site_100_seguro.png' },
];

function LogoBadge({ method, imgClass, containerClass }: {
  method: { key: string; name: string; file: string };
  imgClass: string;
  containerClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`${containerClass} bg-white border border-border rounded-md flex items-center justify-center`} title={method.name}>
        <span className="text-[11px] font-bold text-foreground/70 whitespace-nowrap">{method.name}</span>
      </span>
    );
  }

  return (
    <span className={`${containerClass} bg-white border border-border rounded-md flex items-center justify-center`} title={method.name}>
      <img
        src={method.file}
        alt={method.name}
        className={`${imgClass} w-auto object-contain`}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export default function PaymentBadges() {
  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center gap-2 flex-wrap">
        {PAYMENT_METHODS.map((m) => (
          <LogoBadge key={m.key} method={m} imgClass="h-8" containerClass="h-11 px-2.5" />
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {TRUST_BADGES.map((b) => (
          <LogoBadge key={b.key} method={b} imgClass="h-10" containerClass="h-12 px-3" />
        ))}
      </div>
    </div>
  );
}
