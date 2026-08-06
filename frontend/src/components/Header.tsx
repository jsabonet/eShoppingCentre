"use client";

import Link from 'next/link';
import SearchBar from './SearchBar';
import CartHeaderStandalone from './CartHeaderStandalone';
import MobileMenu from './MobileMenu';
import CartDrawer from './CartDrawer';
import { categories } from '../data/marketplace';
import { useAuth } from '@/src/hooks/useAuth';

export default function Header() {
  const { isAuthenticated, isAdmin, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };
  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="bg-red-600 text-white overflow-hidden">
          <div className="py-2">
            <div className="marquee-container">
              <div className="marquee-content">
                <span className="marquee-item">🚚 Frete gratis para todo Mocambique em compras acima de 199 MZN</span>
                <span className="marquee-item">🎁Promocoes especiais - Ate 50% de desconto em eletronicos</span>
                <span className="marquee-item">📦 Rastreie sua encomenda em tempo real</span>
                <span className="marquee-item">💬 Atendimento 24h - Suporte dedicado ao cliente</span>
                <span className="marquee-item">🔒 Compra 100% segura - Protecao garantida</span>
                <span className="marquee-item">💳 Parcele em ate 12x sem juros</span>
                <span className="marquee-item">🚚 Frete gratis para todo Mocambique em compras acima de 199 MZN</span>
                <span className="marquee-item">🎁 Promocoes especiais - Ate 50% de desconto em eletronicos</span>
                <span className="marquee-item">📦 Rastreie sua encomenda em tempo real</span>
                <span className="marquee-item">💬 Atendimento 24h - Suporte dedicado ao cliente</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white">
          <div className="max-w-[1500px] mx-auto px-4">
            <div className="flex items-center gap-4 py-3">
              <Link href="/" className="flex-shrink-0 hover:bg-gray-100 px-1 py-1 rounded">
                <img src="/icon.png?v=1" alt="E-Shopping Centre" className="h-8 w-auto" />
              </Link>
              <div className="hidden md:flex flex-1 max-w-3xl">
                <SearchBar />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <nav className="hidden md:flex items-center gap-1">
                  <Link href="/stores" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Lojas</Link>
                  <Link href="/courses" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Cursos</Link>
                  <Link href="/blog" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Blog</Link>
                  {/* <Link href="/contact" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Atendimento</Link> */}
                  <span className="text-gray-300 mx-1">|</span>
                  {isAuthenticated ? (
                    <>
                      {isAdmin && (
                        <Link href="/admin" className="px-3 py-2 text-sm font-medium text-white hover:bg-[#155DFC]/90 rounded transition-colors" style={{ backgroundColor: '#155DFC' }}>Admin</Link>
                      )}
                      <Link href="/account" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Minha Conta</Link>
                      <button onClick={logout} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer">Sair</button>
                    </>
                  ) : (
                    <>
                      <Link href="/account" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Minha Conta</Link>
                      <Link href="/login" className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors">Entrar</Link>
                      <Link href="/signup" className="px-3 py-2 text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 rounded transition-colors">Criar Conta</Link>
                    </>
                  )}
                </nav>
                <CartHeaderStandalone />
                <MobileMenu categories={categories} />
              </div>
            </div>
            <div className="md:hidden pb-3">
              <SearchBar />
            </div>
          </div>
        </div>
        <div className="bg-blue-600 text-white">
          <div className="max-w-[1500px] mx-auto px-4">
            <nav className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide text-sm">
              <Link href="/#categories" className="flex items-center gap-1 font-bold hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">
                <span>☰</span> Todas as Categorias
              </Link>
              {categories.slice(0, 6).map((cat) => (
                <Link key={cat.slug} href={'/category/' + cat.slug} className="hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap transition-colors text-white">
                  {cat.name}
                </Link>
              ))}
              <Link href="/stores" className="hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">Lojas</Link>
              <Link href="/courses" className="hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">Cursos</Link>
              <Link href="/#ofertas" className="font-bold hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">Ofertas do Dia</Link>
              {isAdmin && (
                <Link href="/admin" className="hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap transition-colors text-white/70 text-xs">Admin</Link>
              )}
              <Link href="/affiliate/register" className="font-bold hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">Seja Afiliado</Link>
              <Link href="/blog" className="hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">Blog</Link>
              <Link href="/contact" className="hover:bg-blue-700 px-2 py-1 rounded whitespace-nowrap text-white">Atendimento</Link>
            </nav>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}