'use client';

interface PasswordStrengthProps {
  password: string;
}

const RULES = [
  { test: (p: string) => p.length >= 10, label: '10+ caracteres' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Maiúscula' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Minúscula' },
  { test: (p: string) => /[0-9]/.test(p), label: 'Número' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Símbolo' },
];

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const passed = RULES.filter((r) => r.test(password)).length;
  const pct = (passed / RULES.length) * 100;
  const color = pct < 40 ? '#dc2626' : pct < 80 ? '#f59e0b' : '#16a34a';

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li
              key={r.label}
              className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-muted-foreground'}`}
            >
              {ok ? '✓' : '•'} {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
