import type { Metadata } from 'next';
import { Zap, Droplets, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Qualidade & Cuidados | eShopping Centre',
  description:
    'Conheça os nossos padrões de qualidade, política de garantia e dicas para cuidar dos seus produtos comprados no eShopping Centre.',
};

export default function MaterialsCarePage() {
  return (
    <main>
      {/* Hero Section */}
      <section id="materials-care" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-6 font-heading">Qualidade & Cuidados</h1>
          <p className="text-lg text-muted-foreground">
            Compreender a qualidade dos produtos e saber como cuidar deles garante que as suas compras no eShopping Centre durem muito mais tempo.
          </p>
        </div>
      </section>

      {/* Product Quality Section */}
      <section id="quality" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 border-elegant">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Padrões de Qualidade</h2>

          <div className="space-y-12">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Eletrónicos & Tecnologia</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Todos os produtos eletrónicos no eShopping Centre são provenientes de distribuidores oficiais e passam por rigorosos controlos de autenticidade. Trabalhamos apenas com marcas certificadas para garantir o melhor desempenho.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Garantia mínima de 12 meses em todos os eletrónicos</li>
                <li>Produtos selados de fábrica com número de série verificável</li>
                <li>Suporte técnico dedicado para configuração inicial</li>
                <li>Compatibilidade garantida com a rede elétrica local (220V)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Moda & Acessórios</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Trabalhamos com marcas que seguem padrões internacionais de qualidade têxtil. Cada peça é inspecionada quanto ao acabamento, costura e materiais antes de ser listada na plataforma.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Tabela de tamanhos detalhada em cada produto</li>
                <li>Informação clara sobre composição dos tecidos</li>
                <li>Instruções de lavagem e conservação incluídas</li>
                <li>Política de troca gratuita em até 30 dias</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Casa & Decoração</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Os produtos para casa e decoração são selecionados pela sua durabilidade e design. Valorizamos materiais sustentáveis e acabamentos de alta qualidade.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Móveis com especificações detalhadas de materiais</li>
                <li>Eletrodomésticos com selo de eficiência energética</li>
                <li>Produtos de decoração com descrição fiel de cores e dimensões</li>
                <li>Embalagem reforçada para itens frágeis</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="trust" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-t border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Compromisso de Confiança</h2>

          <div className="space-y-8 mb-12">
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <Shield size={24} className="text-foreground" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Vendedores Verificados</h3>
                <p className="text-muted-foreground">
                  Todos os vendedores na nossa plataforma passam por um rigoroso processo de verificação. Exigimos documentação legal, histórico comercial e referências antes de autorizar qualquer loja a vender no eShopping Centre.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <Zap size={24} className="text-foreground" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Autenticidade Garantida</h3>
                <p className="text-muted-foreground">
                  Temos uma política de tolerância zero para produtos contrafeitos. Caso receba um produto que não corresponda ao anunciado, garantimos o reembolso total e tomamos medidas contra o vendedor.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <Droplets size={24} className="text-foreground" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Compromisso Ambiental</h3>
                <p className="text-muted-foreground">
                  Incentivamos os nossos parceiros a adotar práticas sustentáveis. As nossas embalagens são recicláveis e minimizamos o uso de plástico. Acreditamos que o comércio eletrónico pode ser responsável com o planeta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Care Tips Section */}
      <section id="care" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Dicas de Conservação</h2>

          <div className="space-y-12">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Eletrónicos</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Para prolongar a vida útil dos seus dispositivos eletrónicos:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Evite exposição direta ao sol e humidade excessiva</li>
                <li>Utilize protetores contra picos de tensão</li>
                <li>Limpe regularmente com panos de microfibra (nunca use álcool diretamente no ecrã)</li>
                <li>Mantenha o software atualizado para segurança e desempenho</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Roupas & Têxteis</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Siga sempre as etiquetas de conservação. Dicas gerais:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Lave roupas do avesso para preservar cores e estampas</li>
                <li>Use água fria para tecidos delicados e escuros</li>
                <li>Seque à sombra para evitar desbotamento</li>
                <li>Guarde peças de lã e malha dobradas, nunca penduradas</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Móveis & Decoração</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Mantenha os seus móveis com aspeto de novos:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Evite exposição direta ao sol para não desbotar</li>
                <li>Use bases para copos em superfícies de madeira</li>
                <li>Limpe móveis com produtos específicos para cada material</li>
                <li>Verifique e aperte parafusos e conexões periodicamente</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">O Que Evitar</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Cuidados gerais para todos os produtos:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Não use produtos de limpeza abrasivos em nenhum material</li>
                <li>Evite mudanças bruscas de temperatura</li>
                <li>Guarde produtos nas embalagens originais quando não estiverem em uso</li>
                <li>Não ignore sinais de desgaste — atue preventivamente</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Garantia & Assistência</h3>
              <p className="text-muted-foreground leading-relaxed">
                Todos os produtos do eShopping Centre têm garantia mínima de 12 meses contra defeitos de fabrico. Para eletrónicos, a garantia cobre componentes e mão de obra. Guarde sempre a fatura de compra — é o seu comprovativo para acionar a garantia. Em caso de dúvidas, a nossa equipa de suporte está disponível para orientar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sustainability Section */}
      <section id="sustainability" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-t border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Sustentabilidade</h2>

          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Qualidade e sustentabilidade andam de mãos dadas. Estamos comprometidos em reduzir a nossa pegada ecológica em cada etapa — da seleção de produtos à entrega final.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-background p-6 rounded">
              <h4 className="font-semibold mb-3">Embalagens Eco-Friendly</h4>
              <p className="text-muted-foreground text-sm">
                Todas as nossas embalagens são recicláveis ou biodegradáveis. Utilizamos materiais mínimos e evitamos plástico excessivo, dando preferência a papel, cartão e embalagens reutilizáveis.
              </p>
            </div>

            <div className="bg-background p-6 rounded">
              <h4 className="font-semibold mb-3">Produtos Sustentáveis</h4>
              <p className="text-muted-foreground text-sm">
                Destacamos produtos ecológicos e de marcas comprometidas com a sustentabilidade. Pode filtrar por produtos &ldquo;Eco-Friendly&rdquo; na nossa plataforma.
              </p>
            </div>

            <div className="bg-background p-6 rounded">
              <h4 className="font-semibold mb-3">Qualidade que Dura</h4>
              <p className="text-muted-foreground text-sm">
                Ao priorizarmos produtos de qualidade, reduzimos a necessidade de substituições frequentes. Menos desperdício, mais valor para si e para o planeta.
              </p>
            </div>

            <div className="bg-background p-6 rounded">
              <h4 className="font-semibold mb-3">Entregas Otimizadas</h4>
              <p className="text-muted-foreground text-sm">
                Otimizamos as rotas de entrega para reduzir emissões e incentivamos o levantamento em pontos de recolha sempre que possível.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="questions" className="py-20 md:py-24 px-4 sm:px-6 lg:px-8 text-primary-foreground banner-gradient">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-6 font-heading">Dúvidas Sobre os Seus Produtos?</h2>
          <p className="text-lg mb-8 text-primary-foreground/90">
            A nossa equipa de especialistas está pronta para ajudar com conselhos personalizados sobre qualidade e cuidados.
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
          >
            Entre em Contacto
          </a>
        </div>
      </section>
    </main>
  );
}
