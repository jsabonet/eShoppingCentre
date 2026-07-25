import type { Metadata } from 'next';
import { Mail, Phone, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contactos | eShopping Centre',
  description:
    'Entre em contacto com o eShopping Centre. Dúvidas sobre produtos, encomendas, ou suporte — a nossa equipa está pronta para ajudar.',
};

export default function ContactPage() {
  return (
    <main>
      {/* Hero Section */}
      <section id="get-in-touch" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-6 font-heading">Entre em Contacto</h1>
          <p className="text-lg text-muted-foreground">
            Estamos aqui para ajudar. Seja qual for a sua dúvida — sobre um produto, uma encomenda, ou apenas para saber mais — a nossa equipa terá todo o gosto em responder.
          </p>
        </div>
      </section>

      {/* Contact Info Grid */}
      <section id="contact" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
            {/* Email */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                <Mail size={24} className="text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Email</h3>
              <p className="text-muted-foreground mb-2">
                Para dúvidas gerais e suporte ao cliente
              </p>
              <a href="mailto:support@eshoppingcentre.co.mz" className="text-accent font-semibold hover:underline">
                support@eshoppingcentre.co.mz
              </a>
            </div>

            {/* Phone */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                <Phone size={24} className="text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Telefone</h3>
              <p className="text-muted-foreground mb-2">
                Ligue-nos durante o horário comercial
              </p>
              <a href="tel:+258843000000" className="text-accent font-semibold hover:underline">
                +258 84 300 0000
              </a>
            </div>

            {/* Hours */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                <Clock size={24} className="text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Horário</h3>
              <p className="text-muted-foreground">
                Segunda – Sexta<br />
                08:00 – 17:00 (CAT)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 text-center font-heading">Envie-nos uma Mensagem</h2>

          <form data-form-id="cb957bd8-55a4-4884-a139-66f48925fc5d" className="space-y-6 bg-background p-8 rounded border border-border">
            <div>
              <label htmlFor="full_name" className="block text-sm font-semibold mb-2">
                Nome Completo <span className="text-accent">*</span>
              </label>
              <input
                id="full_name"
                type="text"
                name="full_name"
                required
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent bg-background"
                placeholder="O seu nome completo"
              />
            </div>

            <div>
              <label htmlFor="email_address" className="block text-sm font-semibold mb-2">
                Email <span className="text-accent">*</span>
              </label>
              <input
                id="email_address"
                type="email"
                name="email_address"
                required
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent bg-background"
                placeholder="seu.email@exemplo.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-semibold mb-2">
                Assunto <span className="text-accent">*</span>
              </label>
              <input
                id="subject"
                type="text"
                name="subject"
                required
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent bg-background"
                placeholder="Sobre o que se trata?"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold mb-2">
                Mensagem <span className="text-accent">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent bg-background resize-none"
                placeholder="Conte-nos como podemos ajudar..."
              />
            </div>

            <button
              type="submit"
              className="block mx-auto px-8 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
            >
              Enviar Mensagem
            </button>
          </form>

          <div id="b12-form-done-cb957bd8-55a4-4884-a139-66f48925fc5d" className="hidden mt-6 p-4 bg-green-50 border border-green-200 rounded text-green-800">
            <p className="font-semibold">Obrigado pela sua mensagem!</p>
            <p className="text-sm">Recebemos a sua mensagem e entraremos em contacto o mais breve possível.</p>
          </div>

          <div id="b12-form-error-cb957bd8-55a4-4884-a139-66f48925fc5d" className="hidden mt-6 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            <p className="font-semibold">Algo correu mal</p>
            <p className="text-sm">Por favor tente novamente ou contacte-nos diretamente em support@eshoppingcentre.co.mz</p>
          </div>
        </div>
      </section>

      {/* FAQ Quick Links */}
      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 text-center font-heading">Informações Úteis</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <a href="/faq" className="p-6 bg-background rounded border border-border hover:border-accent transition-colors group">
              <h3 className="font-semibold mb-2 group-hover:text-accent transition-colors">
                Perguntas Frequentes
              </h3>
              <p className="text-sm text-muted-foreground">
                Encontre respostas para as dúvidas mais comuns sobre compras, entregas e devoluções.
              </p>
            </a>

            <a href="/faq#shipping" className="p-6 bg-background rounded border border-border hover:border-accent transition-colors group">
              <h3 className="font-semibold mb-2 group-hover:text-accent transition-colors">
                Entregas & Devoluções
              </h3>
              <p className="text-sm text-muted-foreground">
                Saiba mais sobre as nossas opções de entrega e política de devolução gratuita.
              </p>
            </a>

            <a href="/about" className="p-6 bg-background rounded border border-border hover:border-accent transition-colors group">
              <h3 className="font-semibold mb-2 group-hover:text-accent transition-colors">
                Sobre o eShopping Centre
              </h3>
              <p className="text-sm text-muted-foreground">
                Conheça a nossa história, missão e compromisso com a qualidade.
              </p>
            </a>

            <a href="/" className="p-6 bg-background rounded border border-border hover:border-accent transition-colors group">
              <h3 className="font-semibold mb-2 group-hover:text-accent transition-colors">
                Explorar Produtos
              </h3>
              <p className="text-sm text-muted-foreground">
                Navegue por milhões de produtos nas mais variadas categorias.
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="explore-collection" className="py-20 md:py-24 px-4 sm:px-6 lg:px-8 text-primary-foreground banner-gradient">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-6 font-heading">Explore a Nossa Coleção</h2>
          <p className="text-lg mb-8 text-primary-foreground/90">
            Descubra produtos incríveis enquanto aguarda a nossa resposta.
          </p>
          <a
            href="/#categories"
            className="inline-block px-8 py-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
          >
            Ver Produtos
          </a>
        </div>
      </section>
    </main>
  );
}
