'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Store, Star, MapPin, Shield, Clock, Phone, Mail, ChevronDown, Grid3X3, List } from 'lucide-react';
import ProductCard from './ProductCard';
import type { Product } from '../data/marketplace';

interface StoreData {
  name: string;
  description: string;
  about: string;
  logo: string;
  banner: string;
  category: string;
  location: string;
  phone: string;
  email: string;
  memberSince: string;
  rating: number;
  totalProducts: number;
  totalSales: number;
}

interface StoreClientProps {
  store: StoreData;
  products: Product[];
}

export default function StoreClient({ store, products }: StoreClientProps) {
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const sortedProducts = [...products];
  switch (sortBy) {
    case 'price-asc': sortedProducts.sort((a, b) => a.price - b.price); break;
    case 'price-desc': sortedProducts.sort((a, b) => b.price - a.price); break;
    case 'rating': sortedProducts.sort((a, b) => b.rating - a.rating); break;
    case 'name': sortedProducts.sort((a, b) => a.name.localeCompare(b.name)); break;
  }

  return (
    <>
      {/* Store Banner */}
      <div className="relative h-48 md:h-72 overflow-hidden">
        <img src={store.banner} alt={store.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      </div>

      {/* Store Info */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4">
          <div className="relative -mt-16 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white flex-shrink-0">
                <img src={store.logo} alt={store.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 pt-4 md:pt-0">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold">{store.name}</h1>
                    <p className="text-muted-foreground mt-1">{store.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1"><Star size={16} className="text-accent fill-accent" /> <strong>{store.rating}</strong></span>
                      <span className="flex items-center gap-1 text-muted-foreground"><MapPin size={14} /> {store.location}</span>
                      <span className="flex items-center gap-1 text-muted-foreground"><Shield size={14} /> Membro desde {store.memberSince}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
                      <Store size={16} /> Seguir Loja
                    </button>
                    <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                      <Share2 size={16} /> Partilhar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-muted/50 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-4">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-accent">{store.totalProducts}</p>
              <p className="text-xs text-muted-foreground">Produtos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{store.totalSales}</p>
              <p className="text-xs text-muted-foreground">Vendas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{store.rating}</p>
              <p className="text-xs text-muted-foreground">Avaliação</p>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2"><Phone size={14} /> {store.phone}</p>
              <p className="text-xs text-muted-foreground mt-1">Contacto</p>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2"><Mail size={14} /> {store.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Email</p>
            </div>
          </div>
        </div>
      </div>

      {/* About + Products */}
      <div className="max-w-[1500px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* About Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold mb-2">Sobre a Loja</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{store.about}</p>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold mb-3">Informações</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Localização</p>
                      <p className="text-muted-foreground">{store.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Telefone</p>
                      <p className="text-muted-foreground">{store.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-muted-foreground">{store.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Membro desde</p>
                      <p className="text-muted-foreground">{store.memberSince}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield size={16} className="text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Vendas Totais</p>
                      <p className="text-muted-foreground">{store.totalSales} vendas realizadas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Products */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Produtos da Loja</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none px-3 py-2 pr-8 border border-border rounded-md text-sm bg-background cursor-pointer"
                  >
                    <option value="relevance">Mais relevantes</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                    <option value="rating">Melhor avaliados</option>
                    <option value="name">Nome A-Z</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
                <div className="flex items-center border border-border rounded-md">
                  <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-accent/10 text-accent' : 'text-muted-foreground'}`}>
                    <Grid3X3 size={16} />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-accent/10 text-accent' : 'text-muted-foreground'}`}>
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {sortedProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <Store size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold mb-2">Nenhum produto disponível</h3>
                <p className="text-muted-foreground">Esta loja ainda não publicou produtos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Share2(props: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
