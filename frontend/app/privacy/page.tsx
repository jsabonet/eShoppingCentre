import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade | e-Shopping Centre',
  description:
    'Política de Privacidade do e-Shopping Centre — Saiba como protegemos os seus dados pessoais.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <article className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold mb-2">POLÍTICA DE PRIVACIDADE</h1>
        <h2 className="text-2xl font-semibold mb-2">E-SHOPPING CENTRE</h2>
        <p className="text-muted-foreground mb-8">Última atualização: Junho de 2026</p>

        <p className="mb-6">
          Bem-vindo ao E-SHOPPING CENTRE – Centro de Compras Online. A sua privacidade é importante para nós. Esta Política de Privacidade explica como recolhemos, utilizamos, armazenamos e protegemos as suas informações quando utiliza a nossa plataforma.
        </p>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">1. QUEM SOMOS</h3>
          <p className="mb-3">O E-SHOPPING CENTRE é uma plataforma de comércio eletrónico que permite a compra e venda de produtos e serviços online.</p>
          <h4 className="font-semibold mb-2">Dados da Empresa</h4>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Nome: E-SHOPPING CENTRE</li>
            <li>Morada: Avenida 25 de Setembro, Cidade de Pemba, Cabo Delgado, Moçambique</li>
            <li>Email: support@eshoppingcentre.co.mz</li>
            <li>Telefone: +258 84 2040 330 / +258 86 2040 330</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">2. INFORMAÇÕES QUE RECOLHEMOS</h3>
          <p className="mb-3">Podemos recolher os seguintes dados:</p>

          <h4 className="font-semibold mb-2">Informações de Identificação</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Nome completo</li>
            <li>Número de telefone</li>
            <li>Endereço de email</li>
            <li>Endereço de entrega</li>
            <li>Nome da empresa (quando aplicável)</li>
          </ul>

          <h4 className="font-semibold mb-2">Informações de Conta</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Nome de utilizador</li>
            <li>Palavra-passe encriptada</li>
            <li>Histórico de compras</li>
          </ul>

          <h4 className="font-semibold mb-2">Informações Financeiras</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li>Dados de pagamento</li>
            <li>Histórico de transações</li>
            <li>Informações de faturação</li>
          </ul>

          <h4 className="font-semibold mb-2">Informações Técnicas</h4>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Endereço IP</li>
            <li>Tipo de navegador</li>
            <li>Sistema operativo</li>
            <li>Localização aproximada</li>
            <li>Dados de utilização da plataforma</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">3. COMO UTILIZAMOS AS INFORMAÇÕES</h3>
          <p className="mb-3">Utilizamos os dados recolhidos para:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Criar e gerir contas de utilizadores</li>
            <li>Processar encomendas</li>
            <li>Efetuar pagamentos</li>
            <li>Melhorar a experiência do utilizador</li>
            <li>Fornecer suporte ao cliente</li>
            <li>Prevenir fraudes</li>
            <li>Cumprir obrigações legais</li>
            <li>Enviar notificações relacionadas com a plataforma</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">4. COOKIES</h3>
          <p className="mb-3">Utilizamos cookies para:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Manter a sessão iniciada</li>
            <li>Guardar preferências do utilizador</li>
            <li>Melhorar o desempenho do website</li>
            <li>Analisar estatísticas de utilização</li>
            <li>Personalizar conteúdos e ofertas</li>
          </ul>
          <p>O utilizador pode desativar os cookies através das configurações do navegador.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">5. PARTILHA DE DADOS</h3>
          <p className="mb-3">O E-SHOPPING CENTRE não vende informações pessoais dos utilizadores.</p>
          <p className="mb-3">Os dados poderão ser partilhados apenas com:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Processadores de pagamento</li>
            <li>Empresas de entrega</li>
            <li>Parceiros tecnológicos</li>
            <li>Autoridades legais quando exigido por lei</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">6. SEGURANÇA DAS INFORMAÇÕES</h3>
          <p className="mb-3">Adotamos medidas técnicas e organizacionais para proteger os dados dos utilizadores, incluindo:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Encriptação de dados</li>
            <li>Certificados SSL</li>
            <li>Monitorização de segurança</li>
            <li>Controlo de acessos</li>
            <li>Proteção contra acessos não autorizados</li>
          </ul>
          <p>Apesar dos nossos esforços, nenhum sistema é totalmente imune a riscos de segurança.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">7. DIREITOS DOS UTILIZADORES</h3>
          <p className="mb-3">O utilizador tem direito a:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Aceder aos seus dados pessoais</li>
            <li>Corrigir informações incorretas</li>
            <li>Solicitar a eliminação dos seus dados</li>
            <li>Solicitar cópia dos seus dados</li>
            <li>Opor-se ao tratamento dos seus dados</li>
            <li>Retirar consentimentos concedidos</li>
          </ul>
          <p>
            Pedidos podem ser enviados para:{' '}
            <a href="mailto:support@eshoppingcentre.co.mz" className="text-accent hover:underline">
              support@eshoppingcentre.co.mz
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">8. RETENÇÃO DOS DADOS</h3>
          <p className="mb-3">Os dados serão mantidos apenas durante o período necessário para:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Prestação dos serviços</li>
            <li>Cumprimento de obrigações legais</li>
            <li>Resolução de disputas</li>
            <li>Prevenção de fraudes</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">9. CONTA DE VENDEDORES</h3>
          <p className="mb-3">Os vendedores registados na plataforma comprometem-se a:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Fornecer informações verdadeiras</li>
            <li>Cumprir a legislação aplicável</li>
            <li>Respeitar os direitos dos consumidores</li>
            <li>Proteger os dados dos clientes</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">10. MENORES DE IDADE</h3>
          <p>Os serviços do E-SHOPPING CENTRE não são destinados a menores de 18 anos sem autorização dos seus encarregados de educação.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">11. LINKS EXTERNOS</h3>
          <p className="mb-3">A plataforma poderá conter links para websites externos.</p>
          <p>O E-SHOPPING CENTRE não se responsabiliza pelas práticas de privacidade desses websites.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">12. ALTERAÇÕES À POLÍTICA DE PRIVACIDADE</h3>
          <p className="mb-3">Reservamo-nos o direito de atualizar esta Política de Privacidade a qualquer momento.</p>
          <p>As alterações entrarão em vigor após a sua publicação no website.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">13. CONTACTOS</h3>
          <p className="mb-3">Para questões relacionadas com privacidade e proteção de dados:</p>
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold mb-2">E-SHOPPING CENTRE</p>
            <p className="mb-1">📍 Avenida 25 de Setembro, Cidade de Pemba, Cabo Delgado, Moçambique</p>
            <p className="mb-1">
              📧{' '}
              <a href="mailto:support@eshoppingcentre.co.mz" className="text-accent hover:underline">
                support@eshoppingcentre.co.mz
              </a>
            </p>
            <p className="mb-1">📞 +258 84 2040 330</p>
            <p>📞 +258 86 2040 330</p>
          </div>
        </section>

        <div className="mt-12 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm">
            Ao utilizar o E-SHOPPING CENTRE, o utilizador declara que leu, compreendeu e concorda com esta Política de Privacidade.
          </p>
        </div>
      </article>
    </main>
  );
}
