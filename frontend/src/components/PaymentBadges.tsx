'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';

// Logos oficiais (marcas registadas) — localizados na raiz de /public
const PAYMENT_METHODS = [
  { key: 'mpesa', name: 'M-Pesa', file: '/m-pesa.png' },
  { key: 'emola', name: 'e-Mola', file: '/e-mola.png' },
  { key: 'visa', name: 'Visa', file: '/visa.png' },
  { key: 'mastercard', name: 'Mastercard', file: '/mastercard.png' },
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
          className="h-5 w-auto object-contain"
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
