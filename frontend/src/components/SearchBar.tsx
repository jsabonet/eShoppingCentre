"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Clock, ArrowRight } from 'lucide-react';
import { productsAPI } from '../lib/api';

const RECENT_KEY = 'recent_searches';
const MAX_RECENT = 5;

interface Suggestion {
  slug: string;
  name: string;
  image: string | null;
  price: number;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent text-accent font-semibold">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function formatPrice(price: number) {
  return price.toFixed(2).replace('.', ',');
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Carregar pesquisas recentes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Sugestões com debounce (300 ms)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await productsAPI.search(q, { page_size: 5 });
        const mapped = (data.results || []).map((p: any) => ({
          slug: p.slug,
          name: p.name,
          image: p.primary_image,
          price: Number(p.price) || 0,
        }));
        setSuggestions(mapped);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fechar ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const saveRecent = (term: string) => {
    const updated = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const goToSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    saveRecent(t);
    setOpen(false);
    setQuery(t);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goToSearch(suggestions[activeIndex].name);
    } else {
      goToSearch(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % (suggestions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showSuggestions = query.trim().length >= 2;
  const showRecent = !showSuggestions && recent.length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
      <div ref={containerRef} className="relative">
        <div className="flex">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar produtos, marcas e muito mais..."
              role="combobox"
              aria-expanded={open}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-border rounded-l-md focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus(); }}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground rounded-r-md transition-colors"
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Dropdown de sugestões */}
        {open && (showSuggestions || showRecent) && (
          <div
            id="search-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg overflow-hidden"
          >
            {showSuggestions ? (
              loading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">A procurar…</div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">Sem resultados para “{query.trim()}”.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {suggestions.map((s, i) => (
                    <li key={s.slug} role="option" aria-selected={i === activeIndex}>
                      <button
                        type="button"
                        onClick={() => goToSearch(s.name)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors ${i === activeIndex ? 'bg-muted' : ''}`}
                      >
                        <span className="w-9 h-9 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {s.image ? (
                            <img src={s.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Search size={14} className="text-muted-foreground" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">
                            <Highlighted text={s.name} query={query.trim()} />
                          </span>
                          <span className="block text-xs text-muted-foreground">{formatPrice(s.price)} MZN</span>
                        </span>
                        <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : showRecent ? (
              <div className="py-2">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pesquisas recentes</p>
                <ul>
                  {recent.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => goToSearch(r)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                      >
                        <Clock size={14} className="text-muted-foreground shrink-0" />
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </form>
  );
}
