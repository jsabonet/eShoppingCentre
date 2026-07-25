import { useState } from 'react';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
      <div className="relative flex">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produtos, marcas e muito mais..."
          className="w-full px-4 py-2.5 text-sm border border-border rounded-l-md focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground rounded-r-md transition-colors"
          aria-label="Buscar"
        >
          <Search size={18} />
        </button>
      </div>
    </form>
  );
}
