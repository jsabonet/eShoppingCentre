'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export default function PasswordInput({ value, onChange, className = '', placeholder = '••••••••', required, id }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 pr-10 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
        tabIndex={-1}
        aria-label={show ? 'Esconder password' : 'Mostrar password'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
