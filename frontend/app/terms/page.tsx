import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos e Condições | eShopping Centre',
  description:
    'Termos e Condições de Uso do eShopping Centre — Conheça as regras da nossa plataforma.',
};

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <article className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold mb-2">TERMOS E CONDIÇÕES DE USO</h1>
        <h2 className="text-2xl font-semibold mb-2">E-SHOPPING CENTRE</h2>
        <p className="text-lg mb-2">Centro de Compras Online</p>
        <p className="text-muted-foreground mb-8">Última atualização: Junho de 2026</p>

        <p className="mb-6">
          Bem-vindo ao E-SHOPPING CENTRE, uma plataforma de comércio eletrónico destinada à compra e venda de produtos e serviços online. Ao utilizar a nossa plataforma, o utilizador concorda integralmente com os presentes Termos e Condições.
        </p>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">1. ACEITAÇÃO DOS TERMOS</h3>
          <p className="mb-3">Ao aceder, registar-se ou utilizar qualquer serviço do E-SHOPPING CENTRE, o utilizador declara que leu, compreendeu e aceita os presentes Termos e Condições.</p>
          <p>Caso não concorde com estes termos, não deverá utilizar a plataforma.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">2. INFORMAÇÕES DA EMPRESA</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Nome da Plataforma: E-SHOPPING CENTRE</li>
            <li>Slogan: Centro de Compras Online</li>
            <li>Morada: Avenida 25 de Setembro, Cidade de Pemba, Cabo Delgado, Moçambique</li>
            <li>Email: support@eshoppingcentre.co.mz</li>
            <li>Telefone: +258 84 2040 330</li>
            <li>Telefone Alternativo: +258 86 2040 330</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">3. DEFINIÇÕES</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Plataforma:</strong> E-SHOPPING CENTRE.</li>
            <li><strong>Utilizador:</strong> Qualquer pessoa que utilize a plataforma.</li>
            <li><strong>Comprador:</strong> Utilizador que realiza compras.</li>
            <li><strong>Vendedor:</strong> Pessoa singular ou coletiva que vende produtos ou serviços através da plataforma.</li>
            <li><strong>Encomenda:</strong> Pedido realizado por um comprador.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">4. CRIAÇÃO DE CONTA</h3>
          <p className="mb-3">O utilizador compromete-se a:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Fornecer informações verdadeiras e atualizadas.</li>
            <li>Manter a confidencialidade da sua palavra-passe.</li>
            <li>Ser responsável pelas atividades realizadas na sua conta.</li>
            <li>Informar imediatamente qualquer utilização não autorizada da conta.</li>
          </ul>
          <p>O E-SHOPPING CENTRE reserva-se o direito de suspender contas com informações falsas ou suspeitas.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">5. COMPRAS E ENCOMENDAS</h3>
          <p className="mb-3">Ao realizar uma compra, o utilizador concorda que:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Todas as informações fornecidas são verdadeiras.</li>
            <li>Possui capacidade legal para celebrar contratos.</li>
            <li>Os pagamentos serão efetuados pelos meios autorizados.</li>
          </ul>
          <p>A encomenda apenas será considerada válida após confirmação do pagamento.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">6. PAGAMENTOS</h3>
          <p className="mb-3">A plataforma poderá disponibilizar os seguintes meios de pagamento:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>M-Pesa</li>
            <li>e-Mola</li>
            <li>Transferência Bancária</li>
            <li>Visa</li>
            <li>Mastercard</li>
            <li>Outros meios autorizados futuramente</li>
          </ul>
          <p>A confirmação do pagamento poderá depender dos sistemas financeiros parceiros.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">7. ENTREGA DOS PRODUTOS</h3>
          <p className="mb-3">As entregas poderão ser efetuadas por:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Transportadoras parceiras</li>
            <li>Correios</li>
            <li>Serviços próprios de logística</li>
            <li>Entregadores independentes autorizados</li>
          </ul>
          <p>Os prazos de entrega poderão variar conforme a localização do comprador e disponibilidade do produto.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">8. DEVOLUÇÕES E REEMBOLSOS</h3>
          <p className="mb-3">O comprador poderá solicitar devolução ou reembolso quando:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Receber produto diferente do anunciado.</li>
            <li>Receber produto danificado.</li>
            <li>Receber produto defeituoso.</li>
            <li>Existir incumprimento comprovado por parte do vendedor.</li>
          </ul>
          <p>Cada caso será analisado individualmente.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">9. RESPONSABILIDADES DOS VENDEDORES</h3>
          <p className="mb-3">Os vendedores comprometem-se a:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Publicar informações verdadeiras.</li>
            <li>Comercializar apenas produtos legais.</li>
            <li>Cumprir a legislação aplicável.</li>
            <li>Respeitar os direitos dos consumidores.</li>
            <li>Garantir a qualidade dos produtos anunciados.</li>
          </ul>
          <p>O incumprimento poderá resultar em suspensão ou remoção da conta.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">10. CONDUTA PROIBIDA</h3>
          <p className="mb-3">É proibido:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Utilizar a plataforma para atividades ilegais.</li>
            <li>Praticar fraudes.</li>
            <li>Publicar conteúdos ofensivos.</li>
            <li>Violar direitos autorais.</li>
            <li>Manipular avaliações.</li>
            <li>Criar contas falsas.</li>
            <li>Tentar invadir sistemas informáticos da plataforma.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">11. PRODUTOS E SERVIÇOS PROIBIDOS</h3>
          <p className="mb-3">O E-SHOPPING CENTRE não permite a venda, promoção ou divulgação de produtos considerados ilegais, perigosos ou incompatíveis com os princípios da plataforma.</p>

          <h4 className="font-semibold mb-2 mt-4">Produtos Haram e Itens Não Permitidos</h4>
          <p className="mb-3">É expressamente proibida a venda de:</p>

          <h5 className="font-semibold mb-2 mt-3">Alimentos e Bebidas</h5>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Carne de porco.</li>
            <li>Produtos derivados de porco.</li>
            <li>Bebidas alcoólicas.</li>
            <li>Vinhos.</li>
            <li>Cervejas.</li>
            <li>Licores.</li>
            <li>Qualquer produto destinado ao consumo alcoólico.</li>
          </ul>

          <h5 className="font-semibold mb-2 mt-3">Drogas e Substâncias Ilícitas</h5>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Drogas ilícitas.</li>
            <li>Estupefacientes.</li>
            <li>Narcóticos.</li>
            <li>Substâncias psicotrópicas ilegais.</li>
            <li>Produtos destinados ao consumo de drogas.</li>
          </ul>

          <h5 className="font-semibold mb-2 mt-3">Armas e Materiais Perigosos</h5>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Armas de fogo.</li>
            <li>Munições.</li>
            <li>Explosivos.</li>
            <li>Granadas.</li>
            <li>Equipamentos militares restritos.</li>
            <li>Armas artesanais.</li>
          </ul>

          <h5 className="font-semibold mb-2 mt-3">Produtos Contrafeitos</h5>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Produtos falsificados.</li>
            <li>Réplicas ilegais.</li>
            <li>Documentos falsos.</li>
            <li>Licenças ilegais.</li>
            <li>Software pirateado.</li>
          </ul>

          <h5 className="font-semibold mb-2 mt-3">Medicamentos</h5>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Medicamentos não autorizados.</li>
            <li>Produtos farmacêuticos falsificados.</li>
            <li>Produtos proibidos pelas autoridades sanitárias.</li>
          </ul>

          <h5 className="font-semibold mb-2 mt-3">Conteúdo Imoral ou Ilegal</h5>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Material pornográfico.</li>
            <li>Conteúdo de exploração sexual.</li>
            <li>Material que incentive violência.</li>
            <li>Material que promova discriminação ou ódio.</li>
          </ul>

          <h5 className="font-semibold mb-2 mt-3">Serviços Proibidos</h5>
          <ul className="list-disc list-inside space-y-1">
            <li>Jogos de azar ilegais.</li>
            <li>Lavagem de dinheiro.</li>
            <li>Esquemas fraudulentos.</li>
            <li>Atividades criminosas.</li>
            <li>Serviços ilegais de qualquer natureza.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">12. FISCALIZAÇÃO E PENALIZAÇÕES</h3>
          <p className="mb-3">O E-SHOPPING CENTRE reserva-se o direito de:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Remover anúncios sem aviso prévio.</li>
            <li>Suspender contas.</li>
            <li>Encerrar contas definitivamente.</li>
            <li>Cancelar transações suspeitas.</li>
            <li>Comunicar infrações às autoridades competentes.</li>
          </ul>
          <p>Os utilizadores são responsáveis pelos produtos e serviços que anunciam.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">13. PROPRIEDADE INTELECTUAL</h3>
          <p className="mb-3">Todos os elementos da plataforma, incluindo:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Logotipos</li>
            <li>Marcas</li>
            <li>Textos</li>
            <li>Imagens</li>
            <li>Sistemas</li>
            <li>Bases de dados</li>
          </ul>
          <p>são propriedade do E-SHOPPING CENTRE ou dos seus respetivos titulares e estão protegidos pelas leis de propriedade intelectual.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">14. LIMITAÇÃO DE RESPONSABILIDADE</h3>
          <p className="mb-3">O E-SHOPPING CENTRE atua como intermediário entre compradores e vendedores.</p>
          <p className="mb-3">A plataforma não se responsabiliza por:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Informações falsas fornecidas por vendedores.</li>
            <li>Danos causados por terceiros.</li>
            <li>Interrupções temporárias dos serviços.</li>
            <li>Problemas decorrentes de força maior.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">15. ALTERAÇÕES DOS TERMOS</h3>
          <p className="mb-3">O E-SHOPPING CENTRE poderá alterar estes Termos e Condições a qualquer momento.</p>
          <p>As alterações entram em vigor após a sua publicação no website.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">16. LEGISLAÇÃO APLICÁVEL</h3>
          <p className="mb-3">Os presentes Termos e Condições são regidos pelas leis da República de Moçambique.</p>
          <p>Qualquer litígio será submetido aos tribunais competentes de Moçambique.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">17. CONTACTOS</h3>
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold mb-2">E-SHOPPING CENTRE</p>
            <p className="mb-1">Centro de Compras Online</p>
            <p className="mb-1">📍 Avenida 25 de Setembro, Cidade de Pemba, Cabo Delgado, Moçambique</p>
            <p className="mb-1">
              📧{' '}
              <a href="mailto:support@eshoppingcentre.co.mz" className="text-accent hover:underline">
                support@eshoppingcentre.co.mz
              </a>
            </p>
            <p className="mb-1">📞 +258 84 2040 330</p>
            <p className="mb-1">📞 +258 86 2040 330</p>
            <p>
              🌐{' '}
              <a href="https://www.eshoppingcentre.co.mz" className="text-accent hover:underline">
                www.eshoppingcentre.co.mz
              </a>
            </p>
          </div>
        </section>

        <div className="mt-12 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm">
            Ao utilizar o E-SHOPPING CENTRE, o utilizador confirma que leu, compreendeu e aceita integralmente estes Termos e Condições de Uso.
          </p>
        </div>
      </article>
    </main>
  );
}
