// e-Shopping Academy — dados de demonstração (mockup, sem backend).
// As videoaulas serão carregadas no canal oficial do YouTube; até lá o
// campo `youtubeId` fica vazio e o leitor mostra um placeholder.

export type AcademyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AcademyQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AcademyLesson {
  slug: string;
  title: string;
  description: string;
  duration: string;
  youtubeId: string;
  quiz?: AcademyQuiz;
}

export interface AcademyModule {
  slug: string;
  title: string;
  description: string;
  lessons: AcademyLesson[];
}

export interface AcademyPath {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  level: AcademyLevel;
  audience: string;
  emoji: string;
  gradient: string;
  image: string;
  totalDuration: string;
  certificateTitle: string;
  outcomes: string[];
  benefits: string[];
  modules: AcademyModule[];
}

export const LEVEL_LABELS: Record<AcademyLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export function pathLessonCount(path: AcademyPath): number {
  return path.modules.reduce((sum, m) => sum + m.lessons.length, 0);
}

export function pathQuizCount(path: AcademyPath): number {
  return path.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.quiz).length,
    0,
  );
}

export function findPath(slug: string): AcademyPath | undefined {
  return academyPaths.find((p) => p.slug === slug);
}

export function findLesson(
  path: AcademyPath,
  lessonSlug: string,
): { module: AcademyModule; lesson: AcademyLesson; moduleIndex: number; lessonIndex: number } | undefined {
  for (let mi = 0; mi < path.modules.length; mi++) {
    const module = path.modules[mi];
    for (let li = 0; li < module.lessons.length; li++) {
      if (module.lessons[li].slug === lessonSlug) {
        return { module, lesson: module.lessons[li], moduleIndex: mi, lessonIndex: li };
      }
    }
  }
  return undefined;
}

export const academyPaths: AcademyPath[] = [
  {
    slug: 'trilha-do-vendedor',
    title: 'Trilha do Vendedor',
    tagline: 'Do zero à loja profissional',
    description:
      'Aprende a abrir a tua loja, criar produtos que vendem, gerir stock e entregar com confiança — tudo do início.',
    level: 'beginner',
    audience: 'Quem quer começar a vender online, mesmo sem experiência.',
    emoji: '🏪',
    gradient: 'from-accent/20 to-accent/5',
    image: '/images/academy/trilha-do-vendedor.svg',
    totalDuration: '1h 20min',
    certificateTitle: 'Vendedor Certificado — Nível Iniciante',
    outcomes: [
      'Abrir e configurar uma loja atrativa',
      'Criar anúncios com fotos e descrições profissionais',
      'Definir preços e gerir stock sem prejuízo',
      'Enviar encomendas e atender clientes com confiança',
    ],
    benefits: [
      'Selo "Vendedor Formado" na tua loja',
      'Prioridade em destaques da plataforma',
      'Desbloqueio de funcionalidades avançadas',
    ],
    modules: [
      {
        slug: 'abrir-a-loja',
        title: 'Abrir a tua Loja',
        description: 'Os primeiros passos para existir no marketplace.',
        lessons: [
          {
            slug: 'como-funciona-o-marketplace',
            title: 'Como funciona o e-Shopping Centre',
            description: 'Entende o modelo: quem vende, quem compra e como todos ganham.',
            duration: '6 min',
            youtubeId: '',
          },
          {
            slug: 'criar-conta-e-loja',
            title: 'Criar a conta e a tua loja',
            description: 'Do registo à aprovação: documentos, nome, logótipo e tema.',
            duration: '8 min',
            youtubeId: '',
          },
          {
            slug: 'identidade-da-loja',
            title: 'Identidade visual e políticas',
            description: 'Logo, banner, cor, slogan e as políticas que geram confiança.',
            duration: '7 min',
            youtubeId: '',
            quiz: {
              question: 'Qual destes elementos transmite mais confiança num primeiro contacto com o cliente?',
              options: [
                'Uma loja sem logo nem descrição',
                'Logo, slogan claro e políticas de devolução visíveis',
                'Apenas uma lista de produtos sem apresentação',
              ],
              correctIndex: 1,
              explanation: 'Identidade visual coerente e políticas claras reduzem a desconfiança do comprador.',
            },
          },
        ],
      },
      {
        slug: 'produtos-que-vendem',
        title: 'Produtos que Vendem',
        description: 'Como apresentar e precificar os teus produtos.',
        lessons: [
          {
            slug: 'fotos-com-telemovel',
            title: 'Fotografar produtos com o telemóvel',
            description: 'Luz, ângulo e fundo: fotos que chamam a atenção sem equipamento caro.',
            duration: '9 min',
            youtubeId: '',
          },
          {
            slug: 'titulos-e-descricoes',
            title: 'Títulos e descrições que convencem',
            description: 'Escreve títulos claros e descrições que respondem às dúvidas do cliente.',
            duration: '8 min',
            youtubeId: '',
          },
          {
            slug: 'preco-e-margem',
            title: 'Preço, margem e comparação',
            description: 'Calcula custos, define preço e usa o preço comparativo a teu favor.',
            duration: '10 min',
            youtubeId: '',
            quiz: {
              question: 'Ao definir o preço de venda, o que deves considerar primeiro?',
              options: [
                'Apenas o preço dos concorrentes',
                'Os custos totais (produto, comissão, frete) mais a margem de lucro',
                'O preço mais alto possível',
              ],
              correctIndex: 1,
              explanation: 'O preço deve cobrir todos os custos e ainda deixar margem de lucro.',
            },
          },
          {
            slug: 'gerir-stock',
            title: 'Gerir stock e evitar ruturas',
            description: 'Controla quantidades, alertas de stock baixo e produtos esgotados.',
            duration: '7 min',
            youtubeId: '',
          },
        ],
      },
      {
        slug: 'vender-e-entregar',
        title: 'Vender e Entregar',
        description: 'Fecha o ciclo: encomenda, pagamento e entrega.',
        lessons: [
          {
            slug: 'receber-pagamentos',
            title: 'Receber pagamentos (M-Pesa e e-Mola)',
            description: 'Como o cliente paga e como o dinheiro chega à tua carteira.',
            duration: '8 min',
            youtubeId: '',
          },
          {
            slug: 'envio-e-entrega',
            title: 'Envio, embalagem e prazos',
            description: 'Zonas de entrega, frete e embalagem segura para chegar bem.',
            duration: '9 min',
            youtubeId: '',
            quiz: {
              question: 'Porque é importante configurar zonas de entrega e frete na loja?',
              options: [
                'Para o cliente ver o custo de envio correto no checkout',
                'Não é importante',
                'Apenas para enfeitar a loja',
              ],
              correctIndex: 0,
              explanation: 'Sem frete configurado, o cliente pode desistir da compra no último passo.',
            },
          },
          {
            slug: 'atendimento-e-avaliacoes',
            title: 'Atendimento e boas avaliações',
            description: 'Responde rápido, resolve devoluções e constrói a tua reputação.',
            duration: '8 min',
            youtubeId: '',
          },
        ],
      },
    ],
  },
  {
    slug: 'trilha-do-crescimento',
    title: 'Trilha do Crescimento',
    tagline: 'Transforma vendas em negócio',
    description:
      'Estratégias de marketing, SEO e fidelização para fazeres a tua loja crescer de forma consistente.',
    level: 'intermediate',
    audience: 'Vendedores que já vendem e querem aumentar resultados.',
    emoji: '📈',
    gradient: 'from-primary/15 to-primary/5',
    image: '/images/academy/trilha-do-crescimento.svg',
    totalDuration: '1h 05min',
    certificateTitle: 'Vendedor Certificado — Crescimento',
    outcomes: [
      'Posicionar os teus produtos para a pesquisa',
      'Criar promoções e cupões que convertem',
      'Fidelizar clientes e aumentar vendas repetidas',
      'Usar o programa de afiliados para escalar',
    ],
    benefits: [
      'Desconto progressivo de comissão',
      'Acesso a destaques "Top Seller"',
      'Certificado de nível intermédio',
    ],
    modules: [
      {
        slug: 'ser-encontrado',
        title: 'Ser Encontrado',
        description: 'Aparece quando o cliente procura.',
        lessons: [
          {
            slug: 'seo-para-produtos',
            title: 'SEO básico para os teus produtos',
            description: 'Palavras-chave, títulos e categorias que ajudam o cliente a encontrar-te.',
            duration: '9 min',
            youtubeId: '',
          },
          {
            slug: 'fotos-e-video-que-convertem',
            title: 'Fotos e vídeo que convertem',
            description: 'Múltiplas imagens, vídeo do produto e galeria apelativa.',
            duration: '8 min',
            youtubeId: '',
            quiz: {
              question: 'Qual é o efeito de ter várias imagens de qualidade por produto?',
              options: [
                'Reduz a confiança do comprador',
                'Aumenta a probabilidade de compra ao mostrar o produto em detalhe',
                'Não tem qualquer efeito',
              ],
              correctIndex: 1,
              explanation: 'Imagens detalhadas reduzem dúvidas e aumentam a conversão.',
            },
          },
        ],
      },
      {
        slug: 'marketing-e-fidelizacao',
        title: 'Marketing e Fidelização',
        description: 'Promove e mantém os clientes a voltar.',
        lessons: [
          {
            slug: 'promocoes-e-cupoes',
            title: 'Promoções e cupões',
            description: 'Cria descontos que incentivam a primeira e a próxima compra.',
            duration: '9 min',
            youtubeId: '',
          },
          {
            slug: 'redes-sociais',
            title: 'Vender nas redes sociais',
            description: 'Leva tráfego do Facebook, Instagram e WhatsApp para a tua loja.',
            duration: '10 min',
            youtubeId: '',
            quiz: {
              question: 'Qual é o objetivo principal de promover a loja nas redes sociais?',
              options: [
                'Levar potenciais clientes até aos teus produtos',
                'Apenas ganhar seguidores',
                'Substituir completamente a loja online',
              ],
              correctIndex: 0,
              explanation: 'As redes sociais são um canal de tráfego que aponta para a loja.',
            },
          },
          {
            slug: 'programa-de-afiliados',
            title: 'Usar afiliados para crescer',
            description: 'Outras pessoas promovem os teus produtos e ganham comissão.',
            duration: '8 min',
            youtubeId: '',
          },
        ],
      },
    ],
  },
  {
    slug: 'trilha-do-afiliado',
    title: 'Trilha do Afiliado',
    tagline: 'Ganha comissões a promover',
    description:
      'Aprende a promover produtos de outras lojas e a transformar o teu público em rendimento.',
    level: 'intermediate',
    audience: 'Quem quer ganhar dinheiro promovendo produtos sem ter stock.',
    emoji: '🤝',
    gradient: 'from-green-600/15 to-green-600/5',
    image: '/images/academy/trilha-do-afiliado.svg',
    totalDuration: '50min',
    certificateTitle: 'Afiliado Certificado',
    outcomes: [
      'Criar links de afiliado rastreáveis',
      'Promover produtos de forma ética e eficaz',
      'Construir uma audiência que converte',
      'Acompanhar cliques, vendas e comissões',
    ],
    benefits: [
      'Selo de Afiliado Certificado',
      'Acesso antecipado a campanhas',
      'Comissões com cálculo automático',
    ],
    modules: [
      {
        slug: 'comecar-como-afiliado',
        title: 'Começar como Afiliado',
        description: 'Os fundamentos do programa.',
        lessons: [
          {
            slug: 'como-funciona-a-afiliacao',
            title: 'Como funciona o programa de afiliados',
            description: 'O que é afiliação e como ganhas por cada venda.',
            duration: '6 min',
            youtubeId: '',
          },
          {
            slug: 'criar-o-primeiro-link',
            title: 'Criar e partilhar o teu primeiro link',
            description: 'Gera o link, partilha e entende a atribuição da venda.',
            duration: '7 min',
            youtubeId: '',
            quiz: {
              question: 'Quando é que recebes a comissão de uma venda de afiliado?',
              options: [
                'Sempre que alguém clica no link',
                'Quando a venda é concluída e atribuída ao teu link',
                'Assim que partilhas o link',
              ],
              correctIndex: 1,
              explanation: 'A comissão é gerada sobre vendas concluídas atribuídas ao teu link.',
            },
          },
        ],
      },
      {
        slug: 'promover-com-resultados',
        title: 'Promover com Resultados',
        description: 'Estratégias de divulgação.',
        lessons: [
          {
            slug: 'escolher-produtos',
            title: 'Escolher produtos que convertem',
            description: 'Seleciona produtos alinhados com o teu público.',
            duration: '8 min',
            youtubeId: '',
          },
          {
            slug: 'conteudo-que-vende',
            title: 'Criar conteúdo que vende',
            description: 'Recomendações honestas em redes sociais e WhatsApp.',
            duration: '9 min',
            youtubeId: '',
            quiz: {
              question: 'Qual é a prática mais eficaz ao promover produtos como afiliado?',
              options: [
                'Recomendar produtos relevantes para o teu público, de forma transparente',
                'Enviar links em massa sem contexto',
                'Prometer descontos que não existem',
              ],
              correctIndex: 0,
              explanation: 'Relevância e transparência geram confiança e mais conversões.',
            },
          },
          {
            slug: 'acompanhar-resultados',
            title: 'Acompanhar cliques e comissões',
            description: 'Lê o teu dashboard e melhora o que funciona.',
            duration: '6 min',
            youtubeId: '',
          },
        ],
      },
    ],
  },
  {
    slug: 'trilha-do-comprador',
    title: 'Trilha do Comprador Consciente',
    tagline: 'Compra online com segurança',
    description:
      'Aprende a comprar com confiança: escolher, pagar em segurança e resolver qualquer problema.',
    level: 'beginner',
    audience: 'Qualquer pessoa que queira comprar online sem medo.',
    emoji: '🛒',
    gradient: 'from-blue-600/15 to-blue-600/5',
    image: '/images/academy/trilha-do-comprador.svg',
    totalDuration: '40min',
    certificateTitle: 'Comprador Digital Consciente',
    outcomes: [
      'Identificar lojas e vendedores de confiança',
      'Pagar em segurança com M-Pesa e e-Mola',
      'Acompanhar a encomenda e pedir devoluções',
      'Reconhecer e evitar burlas',
    ],
    benefits: [
      'Selo "Comprador Consciente"',
      'Confiança para comprar mais',
      'Acesso a promoções exclusivas',
    ],
    modules: [
      {
        slug: 'comprar-em-seguranca',
        title: 'Comprar em Segurança',
        description: 'Do carrinho ao pagamento sem sustos.',
        lessons: [
          {
            slug: 'escolher-um-bom-vendedor',
            title: 'Como escolher um bom vendedor',
            description: 'Avaliações, selo verificado e reputação da loja.',
            duration: '6 min',
            youtubeId: '',
          },
          {
            slug: 'pagar-em-seguranca',
            title: 'Pagar em segurança',
            description: 'M-Pesa, e-Mola e carteira: como funciona cada método.',
            duration: '8 min',
            youtubeId: '',
            quiz: {
              question: 'O que deves verificar antes de pagar uma compra online?',
              options: [
                'Apenas o preço',
                'A reputação do vendedor e as condições da encomenda',
                'Nada, basta pagar',
              ],
              correctIndex: 1,
              explanation: 'Verificar o vendedor e as condições reduz o risco de problemas.',
            },
          },
        ],
      },
      {
        slug: 'depois-da-compra',
        title: 'Depois da Compra',
        description: 'Acompanha e resolve qualquer questão.',
        lessons: [
          {
            slug: 'acompanhar-a-encomenda',
            title: 'Acompanhar a encomenda',
            description: 'Estados da encomenda e prazos de entrega.',
            duration: '5 min',
            youtubeId: '',
          },
          {
            slug: 'devolucoes-e-reembolsos',
            title: 'Devoluções e reembolsos',
            description: 'Como pedir devolução e o que esperar.',
            duration: '7 min',
            youtubeId: '',
          },
          {
            slug: 'evitar-burlas',
            title: 'Reconhecer e evitar burlas',
            description: 'Sinais de alerta e boas práticas de segurança.',
            duration: '8 min',
            youtubeId: '',
            quiz: {
              question: 'Qual destas atitudes te protege de burlas online?',
              options: [
                'Pagar fora da plataforma a pedido do vendedor',
                'Comprar apenas dentro da plataforma e desconfiar de ofertas suspeitas',
                'Partilhar a palavra-passe com o vendedor',
              ],
              correctIndex: 1,
              explanation: 'Manter tudo dentro da plataforma protege o teu dinheiro e dados.',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'literacia-digital',
    title: 'Literacia Digital',
    tagline: 'O básico para começar online',
    description:
      'Para quem está a dar os primeiros passos no mundo digital: internet, email, contas e segurança.',
    level: 'beginner',
    audience: 'Quem nunca usou a internet ou quer reforçar o básico.',
    emoji: '💡',
    gradient: 'from-amber-500/15 to-amber-500/5',
    image: '/images/academy/literacia-digital.svg',
    totalDuration: '45min',
    certificateTitle: 'Certificado de Literacia Digital',
    outcomes: [
      'Navegar na internet e usar email',
      'Criar e proteger contas com senhas seguras',
      'Reconhecer fraudes e proteger dados pessoais',
      'Usar pagamentos digitais com confiança',
    ],
    benefits: [
      'Base para todas as outras trilhas',
      'Certificado de competências digitais',
      'Confiança para usar o digital no dia a dia',
    ],
    modules: [
      {
        slug: 'primeiros-passos',
        title: 'Primeiros Passos Online',
        description: 'O essencial para navegar e comunicar.',
        lessons: [
          {
            slug: 'internet-e-navegacao',
            title: 'Internet e navegação básica',
            description: 'O que é a internet e como navegar com segurança.',
            duration: '7 min',
            youtubeId: '',
          },
          {
            slug: 'email-e-contas',
            title: 'Email e criação de contas',
            description: 'Cria o teu email e gere as tuas contas.',
            duration: '8 min',
            youtubeId: '',
            quiz: {
              question: 'Qual é a prática mais segura para criar senhas?',
              options: [
                'Usar a mesma senha em todas as contas',
                'Usar senhas diferentes e fortes em cada conta',
                'Partilhar a senha com amigos de confiança',
              ],
              correctIndex: 1,
              explanation: 'Senhas únicas e fortes protegem as tuas contas contra acessos indevidos.',
            },
          },
        ],
      },
      {
        slug: 'seguranca-digital',
        title: 'Segurança Digital',
        description: 'Protege os teus dados e o teu dinheiro.',
        lessons: [
          {
            slug: 'senhas-e-privacidade',
            title: 'Senhas, privacidade e dados pessoais',
            description: 'Protege a tua identidade digital.',
            duration: '8 min',
            youtubeId: '',
          },
          {
            slug: 'pagamentos-digitais',
            title: 'Pagamentos digitais com confiança',
            description: 'M-Pesa e e-Mola explicados do zero.',
            duration: '9 min',
            youtubeId: '',
            quiz: {
              question: 'O que deves fazer ao receber uma mensagem a pedir o teu PIN?',
              options: [
                'Partilhar o PIN para resolver o problema',
                'Nunca partilhar o PIN e contactar os canais oficiais',
                'Responder à mensagem com os teus dados',
              ],
              correctIndex: 1,
              explanation: 'Nenhuma entidade legítima pede o teu PIN. Nunca o partilhes.',
            },
          },
        ],
      },
    ],
  },
];
