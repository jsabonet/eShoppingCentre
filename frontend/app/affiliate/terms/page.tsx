import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos do Programa de Afiliados | e-Shopping Centre',
  description:
    'Termos do Programa de Afiliados do e-Shopping Centre — regras, comissões, pagamentos e obrigações dos afiliados.',
};

export default function AffiliateTermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <article className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold mb-2">TERMOS DO PROGRAMA DE AFILIADOS</h1>
        <h2 className="text-2xl font-semibold mb-2">E-SHOPPING CENTRE</h2>
        <p className="text-lg mb-2">Centro de Compras Online</p>
        <p className="text-muted-foreground mb-8">Última atualização: Agosto de 2026</p>

        <p className="mb-6">
          Estes Termos do Programa de Afiliados regem a participação no programa de afiliação do
          E-SHOPPING CENTRE. Ao registar-se como afiliado, o utilizador declara que leu, compreendeu
          e aceita integralmente estes termos.
        </p>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">1. ACEITAÇÃO DOS TERMOS</h3>
          <p className="mb-3">
            Ao criar uma conta de afiliado e gerar links de indicação, o afiliado aceita estes Termos
            do Programa de Afiliados, bem como os Termos e Condições gerais da plataforma.
          </p>
          <p>O incumprimento destes termos pode resultar na suspensão da conta e na retenção de comissões.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">2. ELEGIBILIDADE</h3>
          <p className="mb-3">Pode tornar-se afiliado qualquer utilizador que:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Tenha uma conta ativa e verificada no E-SHOPPING CENTRE;</li>
            <li>Seja maior de idade e tenha capacidade legal para contratar;</li>
            <li>Não seja proprietário da loja cujos produtos está a promover (auto-referência).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">3. REGISTO E CONTA</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>O registo como afiliado é gratuito.</li>
            <li>O afiliado recebe um código de indicação único e pode criar links personalizados por produto.</li>
            <li>O afiliado é responsável pela confidencialidade da sua conta e pelas atividades realizadas através dela.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">4. LINKS DE INDICAÇÃO E COOKIES</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Cada link de afiliado contém um código único que identifica a origem da venda.</li>
            <li>A janela de atribuição (cookie) é, por defeito, de 30 dias. Ou seja, se um comprador clicar no link e finalizar a compra dentro de 30 dias, a comissão é atribuída ao afiliado.</li>
            <li>Produtos específicos podem ter janelas de atribuição diferentes, definidas pelo vendedor.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">5. COMISSÕES</h3>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>A comissão é uma percentagem do valor da venda, definida por produto pelo vendedor.</li>
            <li>A percentagem padrão é de 10%, podendo variar entre 1% e 50% conforme o produto.</li>
            <li>As comissões só são geradas sobre vendas efetivamente pagas e confirmadas.</li>
            <li>Produtos da própria loja do afiliado ou produtos com afiliação desativada não geram comissão.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">6. APROVAÇÃO E PAGAMENTO DE COMISSÕES</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>As comissões ficam com o estado <strong>pendente</strong> após a venda.</li>
            <li>Após um período de confirmação (normalmente 7 dias), as comissões elegíveis passam a <strong>aprovadas</strong> e são adicionadas ao saldo do afiliado.</li>
            <li>Comissões de vendas canceladas ou reembolsadas são revertidas.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">7. SAQUES (LEVANTAMENTOS)</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>O valor mínimo de saque é de 500 MZN.</li>
            <li>Os saques podem ser efetuados via M-Pesa, e-Mola ou Transferência Bancária.</li>
            <li>A verificação de identidade (KYC) é obrigatória antes do primeiro saque.</li>
            <li>O processamento do saque está sujeito a revisão pela equipa do E-SHOPPING CENTRE.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">8. REVERSÕES DE COMISSÃO</h3>
          <p className="mb-3">
            As comissões podem ser revertidas num prazo de até 30 dias após a aprovação nos seguintes casos:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Cancelamento ou reembolso da encomenda;</li>
            <li>Vendas fraudulentas ou obtidas por meios ilícitos;</li>
            <li>Violação destes termos por parte do afiliado.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">9. OBRIGAÇÕES E PRÁTICAS PROIBIDAS</h3>
          <p className="mb-3">O afiliado compromete-se a:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Promover os produtos de forma honesta e transparente;</li>
            <li>Divulgar claramente a sua condição de afiliado quando exigido por lei;</li>
            <li>Não utilizar spam, mensagens em massa não solicitadas ou publicidade enganosa;</li>
            <li>Não comprar através do próprio link (auto-referência);</li>
            <li>Não usar marcas registadas ou conteúdo do E-SHOPPING CENTRE sem autorização;</li>
            <li>Não manipular cliques ou vendas por meios fraudulentos.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">10. SUSPENSÃO E TERMINAÇÃO</h3>
          <p className="mb-3">
            O E-SHOPPING CENTRE reserva-se o direito de suspender ou encerrar a conta de afiliado, e de
            reter comissões, em caso de violação destes termos ou de atividade suspeita.
          </p>
          <p>O afiliado pode encerrar a sua participação no programa a qualquer momento, através do suporte.</p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">11. LIMITAÇÃO DE RESPONSABILIDADE</h3>
          <p>
            O E-SHOPPING CENTRE não garante um volume mínimo de vendas ou comissões. Os valores apresentados
            no painel do afiliado são estimativas e podem ser ajustados após validação.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">12. ALTERAÇÕES AOS TERMOS</h3>
          <p>
            O E-SHOPPING CENTRE pode atualizar estes termos a qualquer momento. As alterações entram em vigor
            após a sua publicação nesta página, sendo responsabilidade do afiliado consultá-la periodicamente.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-bold mb-3">13. CONTACTO</h3>
          <p className="mb-3">Para esclarecimentos sobre o programa de afiliados:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Email: suporte@e-shoppingcentre.com</li>
            <li>Telefone: +258 84 2040 330</li>
            <li>Telefone Alternativo: +258 86 2040 330</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
