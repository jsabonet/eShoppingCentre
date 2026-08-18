import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página não encontrada | e-Shopping Centre',
};

export default function NotFoundPage() {
  return (
    <main className="min-h-[calc(100vh-300px)] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="text-8xl mb-6">🔍</div>
        <h1 className="text-6xl font-bold text-accent mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-4">Página não encontrada</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Desculpe, não conseguimos encontrar a página que procura. 
          Ela pode ter sido movida, removida ou o link pode estar incorrecto.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="px-8 py-3 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors font-medium"
          >
            Ir para a Página Inicial
          </Link>
          <Link
            href="/contact"
            className="px-8 py-3 border border-border rounded-md hover:bg-muted transition-colors font-medium"
          >
            Falar com Suporte
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-3 gap-4 text-sm">
          <Link href="/category/eletronicos" className="p-4 bg-card border border-border rounded-lg hover:border-accent transition-colors">
            <div className="text-2xl mb-2">💻</div>
            <div className="font-medium">Eletrônicos</div>
          </Link>
          <Link href="/category/moda" className="p-4 bg-card border border-border rounded-lg hover:border-accent transition-colors">
            <div className="text-2xl mb-2">👗</div>
            <div className="font-medium">Moda</div>
          </Link>
          <Link href="/category/casa-jardim" className="p-4 bg-card border border-border rounded-lg hover:border-accent transition-colors">
            <div className="text-2xl mb-2">🏠</div>
            <div className="font-medium">Casa</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
