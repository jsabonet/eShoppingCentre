'use client';

import { Info } from 'lucide-react';

interface FieldHintProps {
  text: string;
  className?: string;
}

/** Tooltip inline — ícone (?) que mostra dica ao hover/tap. */
export default function FieldHint({ text, className = '' }: FieldHintProps) {
  return (
    <span
      className={`inline-flex items-center cursor-help text-muted-foreground hover:text-foreground transition-colors ${className}`}
      title={text}
      aria-label={text}
    >
      <Info size={13} />
    </span>
  );
}
