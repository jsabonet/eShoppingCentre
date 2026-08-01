import { useState } from 'react';
import { Menu, X, ChevronRight, Home, Store, BookOpen, ShoppingCart, User, LogIn, UserPlus, Headphones, Gift, DollarSign, Store as StoreIcon, Info, HelpCircle, FileText, Shield, LayoutDashboard, LogOut } from 'lucide-react';
import type { Category } from '../data/marketplace';
import { useAuth } from '@/src/hooks/useAuth';

interface MobileMenuProps {
  categories: Category[];
}

export default function MobileMenu({ categories }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const close = () => {
    setIsOpen(false);
    setShowCategories(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors md:hidden text-gray-900"
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={close}
          />
          <div className="fixed left-0 top-0 h-full w-80 bg-background z-50 shadow-xl overflow-y-auto animate-in slide-in-from-left">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground">
              <div className="flex items-center gap-3">
                <img src="/icon.png?v=1" alt="E-Shopping Centre" className="h-6 w-auto" />
                <p className="text-sm font-medium">e-Shopping Centre</p>

              </div>
              <button
                onClick={close}
                className="p-2 hover:bg-primary-foreground/10 rounded-md transition-colors"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Actions */}
            <div className="p-4 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <User size={20} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">{isAuthenticated ? `Olá, ${user?.first_name || user?.username || 'Utilizador'}` : 'Olá, Visitante'}</p>
                  <p className="text-xs text-muted-foreground">{isAuthenticated ? user?.email : 'Aceda à sua conta'}</p>
                </div>
              </div>
              {isAuthenticated ? (
                <div className="space-y-1">
                  {isAdmin && (
                    <a href="/admin" onClick={close}
                      className="flex items-center justify-center gap-2 px-3 py-2 border border-border text-gray-500 rounded-lg text-sm font-medium hover:bg-muted hover:text-gray-700 transition-colors">
                      <LayoutDashboard size={16} /> Admin
                    </a>
                  )}
                  <button onClick={() => { logout(); close(); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                    <LogOut size={16} /> Sair
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <a href="/login" onClick={close}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
                    <LogIn size={16} /> Entrar
                  </a>
                  <a href="/signup" onClick={close}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                    <UserPlus size={16} /> Criar Conta
                  </a>
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-1">
              {/* Main Pages */}
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 px-3">Navegar</p>

              <a href="/" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Home size={18} className="text-muted-foreground" /> Página Inicial
              </a>
              <a href="/stores" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Store size={18} className="text-muted-foreground" /> Lojas
              </a>
              <a href="/courses" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <BookOpen size={18} className="text-muted-foreground" /> Cursos Online
              </a>
              <a href="/blog" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Blog size={18} className="text-muted-foreground" /> Blog
              </a>

              {/* Categories */}
              <div className="border-t border-border my-3" />
              <button onClick={() => setShowCategories(!showCategories)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted rounded-lg transition-colors">
                <span className="flex items-center gap-3"><StoreIcon size={18} className="text-muted-foreground" /> Categorias</span>
                <ChevronRight size={16} className={`text-muted-foreground transition-transform ${showCategories ? 'rotate-90' : ''}`} />
              </button>

              {showCategories && (
                <div className="ml-4 pl-3 border-l-2 border-accent/30 space-y-0.5 mt-1 mb-2">
                  {categories.map((cat) => (
                    <a key={cat.id} href={`/category/${cat.slug}`} onClick={close}
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors">
                      <span>{cat.name}</span>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}

              {/* My Account */}
              <div className="border-t border-border my-3" />
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 px-3">Minha Conta</p>

              <a href="/account" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <User size={18} className="text-muted-foreground" /> Painel
              </a>
              <a href="/account/orders" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <ShoppingCart size={18} className="text-muted-foreground" /> Encomendas
              </a>
              <a href="/cart" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <ShoppingCart size={18} className="text-muted-foreground" /> Carrinho
              </a>
              <a href="/account/wishlist" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Heart size={18} className="text-muted-foreground" /> Lista de Desejos
              </a>

              {/* Earn */}
              <div className="border-t border-border my-3" />
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 px-3">Ganhe Dinheiro</p>

              <a href="/seller/register" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <StoreIcon size={18} className="text-muted-foreground" /> Vender na Plataforma
              </a>
              <a href="/seller/dashboard" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <DollarSign size={18} className="text-muted-foreground" /> Painel do Vendedor
              </a>
              <a href="/affiliate/register" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Gift size={18} className="text-muted-foreground" /> Programa de Afiliados
              </a>
              <a href="/affiliate/dashboard" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <DollarSign size={18} className="text-muted-foreground" /> Painel do Afiliado
              </a>

              {/* Support */}
              <div className="border-t border-border my-3" />
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 px-3">Ajuda</p>

              <a href="/contact" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Headphones size={18} className="text-muted-foreground" /> Atendimento
              </a>
              <a href="/faq" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <HelpCircle size={18} className="text-muted-foreground" /> FAQ
              </a>
              <a href="/about" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Info size={18} className="text-muted-foreground" /> Sobre Nós
              </a>
              <a href="/privacy" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <Shield size={18} className="text-muted-foreground" /> Privacidade
              </a>
              <a href="/terms" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted rounded-lg transition-colors">
                <FileText size={18} className="text-muted-foreground" /> Termos
              </a>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">
                &copy; 2026 eShoppingCentre. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* Inline Heart icon since it's not imported at top */
function Heart(props: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function Blog(props: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
