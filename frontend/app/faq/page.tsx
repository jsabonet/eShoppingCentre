import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Ajuda & Suporte | eShopping Centre',
  description:
    'Central de ajuda do eShopping Centre. Encontre respostas para perguntas frequentes, informações de entrega e política de devoluções.',
};

const faqItems = [
  {
    question: 'Como faço para criar uma conta?',
    answer: (
      <>
        <p className="mb-3">Criar uma conta no eShopping Centre é rápido e gratuito:</p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li>Clique em &ldquo;Entrar&rdquo; no canto superior direito</li>
          <li>Selecione &ldquo;Criar Conta&rdquo;</li>
          <li>Preencha o seu nome, email e palavra-passe</li>
          <li>Confirme o email de verificação que enviaremos</li>
        </ul>
        <p className="mt-4 text-sm">Com uma conta, pode acompanhar encomendas, guardar favoritos e finalizar compras mais rapidamente.</p>
      </>
    ),
  },
  {
    question: 'Quanto tempo demora a entrega?',
    answer: (
      <>
        <p className="mb-3">Os prazos de entrega variam conforme a sua localização:</p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li><strong>Maputo e arredores:</strong> 1–3 dias úteis</li>
          <li><strong>Outras capitais provinciais:</strong> 3–5 dias úteis</li>
          <li><strong>Resto do país:</strong> 5–10 dias úteis</li>
        </ul>
        <p className="mt-4 text-sm">Todos os prazos são contados a partir da confirmação do pagamento. Receberá um código de rastreio assim que a encomenda for despachada.</p>
      </>
    ),
  },
  {
    question: 'Quais são as formas de pagamento aceitas?',
    answer: (
      <>
        <p className="mb-3">Aceitamos diversos métodos de pagamento para sua conveniência:</p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li>Cartões de crédito e débito (Visa, Mastercard)</li>
          <li>M-Pesa</li>
          <li>e-Mola</li>
          <li>Transferência bancária</li>
          <li>Pagamento na entrega (em regiões selecionadas)</li>
        </ul>
        <p className="mt-4 text-sm">Todas as transações são processadas com segurança e encriptação de ponta a ponta.</p>
      </>
    ),
  },
  {
    question: 'Como posso devolver um produto?',
    answer: (
      <>
        <p className="mb-3">Temos uma política de devolução gratuita em até 30 dias:</p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li>O produto deve estar na embalagem original e sem sinais de uso</li>
          <li>Aceda à sua conta e vá em &ldquo;Minhas Encomendas&rdquo;</li>
          <li>Selecione o produto e clique em &ldquo;Solicitar Devolução&rdquo;</li>
          <li>Receberá uma etiqueta de devolução gratuita</li>
          <li>O reembolso é processado em até 7 dias úteis após recebermos o produto</li>
        </ul>
        <p className="mt-4 text-sm">Produtos personalizados ou perecíveis não são elegíveis para devolução.</p>
      </>
    ),
  },
  {
    question: 'O frete é realmente grátis?',
    answer: (
      <>
        <p className="mb-3">Sim! O frete é gratuito para:</p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li>Compras acima de 199 MZN</li>
          <li>Todo o território nacional (Moçambique)</li>
          <li>Qualquer categoria de produto</li>
        </ul>
        <p className="mt-4 text-sm">Para compras abaixo de 199 MZN, o frete é calculado no checkout com base no peso e destino.</p>
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <main>
      {/* Hero Section */}
      <section id="support" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-6 font-heading">Central de Ajuda</h1>
          <p className="text-lg text-muted-foreground">
            Estamos aqui para ajudar. Encontre respostas para as dúvidas mais comuns ou entre em contacto connosco.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Perguntas Frequentes</h2>

          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <details key={i} className="group border border-border rounded-sm">
                <summary className="flex items-center justify-between w-full px-6 py-4 font-semibold cursor-pointer hover:bg-subtle transition-colors">
                  {item.question}
                  <ChevronDown size={20} className="group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 py-4 border-t border-border bg-subtle text-muted-foreground">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Shipping Section */}
      <section id="shipping" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-subtle border-elegant">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Entregas & Envios</h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Entrega Standard (Grátis)</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>GRÁTIS em compras acima de 199 MZN</li>
                <li>Entrega em 3–7 dias úteis em território nacional</li>
                <li>Encomenda segurada com número de rastreio</li>
                <li>Notificações por SMS e email em cada etapa</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Entrega Express</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>150 MZN para entrega em 1–2 dias úteis</li>
                <li>Disponível para Maputo, Matola e arredores</li>
                <li>Segurada e com confirmação de entrega</li>
                <li>Ideal para presentes e encomendas urgentes</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Levantamento em Loja</h3>
              <p className="text-muted-foreground mb-3">
                Pode optar por levantar a sua encomenda gratuitamente num dos nossos pontos de recolha.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Disponível em Maputo, Beira e Nampula</li>
                <li>Receberá uma notificação quando a encomenda estiver pronta</li>
                <li>Prazo de levantamento: 7 dias</li>
                <li>Necessário apresentar documento de identificação</li>
              </ul>
            </div>

            <div className="bg-background p-6 rounded border border-border">
              <p className="text-muted-foreground">
                <strong>Nota:</strong> Todas as encomendas incluem seguro e número de rastreio. Recomendamos que forneça um contacto telefónico válido para facilitar a comunicação com o estafeta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Returns Section */}
      <section id="returns" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl mb-12 font-heading">Devoluções & Trocas</h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Política de Devolução (30 Dias)</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Queremos que fique 100% satisfeito com a sua compra. Se não estiver completamente satisfeito, pode devolver o produto em até 30 dias após a entrega para um reembolso total.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Produto deve estar na embalagem original e sem sinais de uso</li>
                <li>Devolução gratuita para produtos em perfeitas condições</li>
                <li>Reembolso processado em até 7 dias úteis</li>
                <li>Produtos personalizados têm venda final (não elegíveis para devolução)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Como Devolver</h3>
              <ol className="list-decimal list-inside text-muted-foreground space-y-2">
                <li>Contacte-nos em support@eshoppingcentre.co.mz com o número da encomenda</li>
                <li>Enviaremos uma etiqueta de devolução pré-paga</li>
                <li>Embale o produto com todos os materiais originais</li>
                <li>Entregue num ponto de recolha autorizado</li>
                <li>Processaremos o reembolso após receção e inspeção</li>
              </ol>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Trocas</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Precisa de um tamanho ou modelo diferente? As trocas são fáceis e gratuitas (exceto produtos personalizados).
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Solicite a troca em até 30 dias</li>
                <li>Enviaremos uma etiqueta de devolução pré-paga</li>
                <li>Sem custos adicionais para troca por tamanho</li>
                <li>Se trocar por um produto de valor superior, cobraremos a diferença</li>
              </ul>
            </div>

            <div className="bg-background p-6 rounded border border-border">
              <p className="text-muted-foreground">
                <strong>Produto com Defeito ou Danificado:</strong> Se o produto chegar danificado ou com defeito, contacte-nos imediatamente com fotos. Enviaremos uma substituição sem qualquer custo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 text-primary-foreground banner-gradient">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-8 font-heading">Entre em Contacto</h2>

          <div className="mb-8">
            <div>
              <p className="text-sm font-semibold mb-2 text-primary-foreground/70">Email</p>
              <a href="mailto:support@eshoppingcentre.co.mz" className="text-lg hover:text-accent transition-colors">
                support@eshoppingcentre.co.mz
              </a>
              <p className="text-sm font-semibold mb-2 mt-6 text-primary-foreground/70">Horário</p>
              <p className="text-lg">Segunda – Sexta, 08:00 – 17:00 (CAT)</p>
            </div>
          </div>

          <p className="text-primary-foreground/90 mb-8">
            Tem alguma dúvida ou precisa de ajuda? A nossa equipa responde normalmente em até 24 horas.
          </p>

          <a
            href="mailto:support@eshoppingcentre.co.mz"
            className="inline-block px-8 py-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
          >
            Enviar Email
          </a>
        </div>
      </section>
    </main>
  );
}
