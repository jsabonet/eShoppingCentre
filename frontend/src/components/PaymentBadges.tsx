'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';

// Logos oficiais (marcas registadas) — coloque os ficheiros em /public/images/payments/
const PAYMENT_METHODS = [
  { key: 'mpesa', name: 'M-Pesa', file: '/images/payments/mpesa.svg' },
  { key: 'emola', name: 'e-Mola', file: '/images/payments/emola.svg' },
  { key: 'visa', name: 'Visa', file: '/images/payments/visa.svg' },
  { key: 'mastercard', name: 'Mastercard', file: '/images/payments/mastercard.svg' },
];

function PaymentBadge({ method }: { method: { key: string; name: string; file: string } }) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className="h-7 px-2 bg-white border border-border rounded-md flex items-center justify-center"
      title={method.name}
    >
      {failed ? (
        <span className="text-[10px] font-bold text-foreground/70 whitespace-nowrap">{method.name}</span>
      ) : (
        <img
          src={method.file}
          alt={method.name}
          className="h-4 w-auto object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export default function PaymentBadges() {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PAYMENT_METHODS.map((m) => (
          <PaymentBadge key={m.key} method={m} />
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock size={11} /> Pagamento 100% seguro
      </p>
    </div>
  );
}
