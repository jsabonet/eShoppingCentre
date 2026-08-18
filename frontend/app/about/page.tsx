import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre Nós | e-Shopping Centre',
  description:
    'Conheça a história, missão e filosofia do e-Shopping Centre — o seu marketplace de confiança com milhões de produtos e frete grátis.',
};

export default function AboutPage() {
  return (
    <main>
      {/* Hero Section */}
      <section id="our-story" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-6 font-heading">Nossa História</h1>
          <p className="text-lg text-muted-foreground">
            O e-Shopping Centre nasceu da convicção de que fazer compras online deve ser simples, seguro e acessível para todos. Cada produto na nossa plataforma representa o nosso compromisso com qualidade e confiança.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section id="our-mission" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl mb-8 font-heading">A Nossa Missão</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Acreditamos que o comércio eletrónico deve ser significativo. A nossa missão é conectar milhões de compradores aos melhores produtos, oferecendo uma experiência de compra que prima pela transparência, variedade e praticidade.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Trabalhamos com vendedores e marcas que partilham o nosso compromisso com a excelência. Cada compra no e-Shopping Centre é um investimento em qualidade, conveniência e satisfação garantida.
            </p>
          </div>

          <div className="border-t border-b border-border py-12 my-16 space-y-12">
            <div>
              <h3 className="text-2xl mb-4 font-heading">Variedade sem Igual</h3>
              <p className="text-muted-foreground leading-relaxed">
                Com milhares de produtos em categorias como eletrónicos, moda, casa, beleza e muito mais, o e-Shopping Centre é o destino único para todas as suas necessidades. Trabalhamos com fornecedores certificados para garantir a autenticidade de cada item.
              </p>
            </div>
            <div>
              <h3 className="text-2xl mb-4 font-heading">Confiança e Segurança</h3>
              <p className="text-muted-foreground leading-relaxed">
                A sua segurança é a nossa prioridade. Utilizamos tecnologia de ponta para proteger os seus dados e transações. Todas as compras são protegidas pela nossa política de devolução gratuita em até 30 dias.
              </p>
            </div>
            <div>
              <h3 className="text-2xl mb-4 font-heading">Entrega Rápida e Confiável</h3>
              <p className="text-muted-foreground leading-relaxed">
                Com frete grátis em compras acima de 199 MZN e entregas em todo Moçambique, garantimos que os seus produtos chegam até si com rapidez e segurança. Acompanhe o seu pedido em tempo real através da nossa plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section id="our-philosophy" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">A Nossa Filosofia</h2>

          <blockquote className="text-2xl md:text-3xl font-light text-foreground mb-8 italic border-l-4 border-accent pl-6">
            &ldquo;Comprar online não é apenas uma transação — é uma experiência. Criamos uma plataforma que inspira confiança e torna cada compra especial.&rdquo;
          </blockquote>

          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            No e-Shopping Centre, acreditamos que a melhor tecnologia é aquela que simplifica a sua vida. Por isso, investimos continuamente em inovação para tornar a sua experiência de compra cada vez mais intuitiva, rápida e personalizada.
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed">
            A nossa plataforma foi desenhada para si — desde a navegação fluida até às recomendações inteligentes baseadas em IA, cada detalhe foi pensado para que encontre exatamente o que procura, quando precisa.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="discover-collection"
        className="py-20 md:py-24 px-4 sm:px-6 lg:px-8 text-primary-foreground banner-gradient"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-6 font-heading">Descubra a Nossa Coleção</h2>
          <p className="text-lg mb-8 text-primary-foreground/90">
            Milhões de produtos à distância de um clique. Comece a explorar agora.
          </p>
          <a
            href="/"
            className="inline-block px-8 py-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
          >
            Ver Produtos
          </a>
        </div>
      </section>
    </main>
  );
}
