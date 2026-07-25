import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Clock, Star, Users, BookOpen, PlayCircle, FileText, Award, CheckCircle, ShoppingCart } from 'lucide-react';

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

const courses = [
  {
    slug: 'python-para-iniciantes',
    title: 'Python para Iniciantes',
    subtitle: 'Aprenda programação do zero com Python',
    instructor: 'Dr. Carlos Macamo',
    instructorBio: 'PhD em Ciência da Computação com 15 anos de experiência em programação e ensino.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg',
    price: '2.499 MZN',
    originalPrice: '4.999 MZN',
    rating: 4.8,
    students: 1234,
    duration: '20 horas',
    lessons: 48,
    level: 'Iniciante',
    language: 'Português',
    includes: ['Acesso vitalício', 'Certificado de conclusão', 'Exercícios práticos', 'Suporte via WhatsApp'],
    description: 'Aprenda Python do absoluto zero! Este curso cobre desde conceitos básicos até tópicos avançados como orientação a objetos, manipulação de arquivos e introdução a bibliotecas populares.',
    curriculum: [
      { module: 'Módulo 1: Introdução', lessons: ['Instalação e Configuração', 'Primeiro Programa', 'Variáveis e Tipos de Dados', 'Entrada e Saída'] },
      { module: 'Módulo 2: Estruturas de Controle', lessons: ['Condicionais (if/else)', 'Loops (for/while)', 'Listas e Tuplas', 'Dicionários'] },
      { module: 'Módulo 3: Funções', lessons: ['Funções Básicas', 'Parâmetros e Retorno', 'Escopo de Variáveis', 'Funções Lambda'] },
      { module: 'Módulo 4: Projeto Final', lessons: ['Planejamento', 'Implementação', 'Testes', 'Deploy'] },
    ],
  },
  {
    slug: 'marketing-digital-completo',
    title: 'Marketing Digital Completo',
    subtitle: 'Domine as estratégias de marketing online',
    instructor: 'Ana Mondlane',
    instructorBio: 'Especialista em marketing digital com mais de 8 anos de experiência em campanhas para grandes marcas.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573d35e0-7e6e-11f1-a56d-0242ac110002-m84D8GY8ROKweXe5v3qi3.jpg',
    price: '3.499 MZN',
    originalPrice: null,
    rating: 4.6,
    students: 856,
    duration: '15 horas',
    lessons: 34,
    level: 'Intermediário',
    language: 'Português',
    includes: ['Acesso vitalício', 'Certificado', 'Planilhas e templates', 'Suporte 24h'],
    description: 'Aprenda as estratégias de marketing digital mais eficientes para alavancar seu negócio online. SEO, mídias sociais, Google Ads, email marketing e muito mais.',
    curriculum: [
      { module: 'Módulo 1: Fundamentos', lessons: ['Introdução ao Marketing Digital', 'Funil de Vendas', 'Persona e Segmentação', 'Jornada do Cliente'] },
      { module: 'Módulo 2: SEO', lessons: ['Pesquisa de Palavras-Chave', 'SEO On-Page', 'SEO Off-Page', 'Ferramentas SEO'] },
      { module: 'Módulo 3: Mídias Sociais', lessons: ['Facebook/Instagram Ads', 'Marketing de Conteúdo', 'Influenciadores', 'Métricas'] },
    ],
  },
  {
    slug: 'fotografia-profissional',
    title: 'Fotografia Profissional com Smartphone',
    subtitle: 'Tire fotos incríveis usando apenas seu celular',
    instructor: 'Pedro Chissano',
    instructorBio: 'Fotógrafo profissional premiado, especializado em fotografia mobile.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg',
    price: '1.999 MZN',
    originalPrice: '2.999 MZN',
    rating: 4.9,
    students: 2103,
    duration: '10 horas',
    lessons: 25,
    level: 'Iniciante',
    language: 'Português',
    includes: ['Acesso vitalício', 'Certificado', 'Edição com Lightroom Mobile', 'Grupo exclusivo'],
    description: 'Descubra como tirar fotos profissionais usando apenas seu smartphone. Iluminação, composição, edição e truques que farão suas fotos se destacarem.',
    curriculum: [
      { module: 'Módulo 1: Equipamento', lessons: ['Configurações do Smartphone', 'Acessórios Essenciais', 'Apps Recomendados'] },
      { module: 'Módulo 2: Técnicas', lessons: ['Composição', 'Iluminação Natural', 'Modo Retrato', 'Fotografia Noturna'] },
      { module: 'Módulo 3: Edição', lessons: ['Lightroom Mobile', 'Ajustes Básicos', 'Presets', 'Exportação'] },
    ],
  },
  {
    slug: 'excel-avancado',
    title: 'Excel Avançado para Negócios',
    subtitle: 'Domine o Excel e automatize suas planilhas',
    instructor: 'Maria Santos',
    instructorBio: 'Analista de dados com 10+ anos usando Excel para análise de negócios.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b46db3a-7e6e-11f1-98fb-0242ac110002-yUsdDCiNGkUXvIXwHDkP9.jpg',
    price: '2.999 MZN',
    originalPrice: null,
    rating: 4.7,
    students: 1567,
    duration: '12 horas',
    lessons: 30,
    level: 'Avançado',
    language: 'Português',
    includes: ['Acesso vitalício', 'Certificado', 'Planilhas prontas', 'Macros e VBA'],
    description: 'Do básico ao avançado no Excel. Fórmulas, tabelas dinâmicas, gráficos, macros e VBA para automatizar seu trabalho.',
    curriculum: [
      { module: 'Módulo 1: Revisão', lessons: ['Fórmulas Essenciais', 'Funções Lógicas', 'PROCV e ÍNDICE', 'Tabelas Dinâmicas'] },
      { module: 'Módulo 2: Avançado', lessons: ['Power Query', 'Gráficos Avançados', 'Dashboard', 'Validação de Dados'] },
      { module: 'Módulo 3: Automação', lessons: ['Introdução ao VBA', 'Macros', 'UserForms', 'Projeto Final'] },
    ],
  },
];

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = courses.find(c => c.slug === slug);
  if (!course) return { title: 'Curso não encontrado | eShoppingCentre' };
  return { title: `${course.title} | eShoppingCentre Cursos`, description: course.subtitle };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = courses.find(c => c.slug === slug);

  if (!course) notFound();

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground">Início</Link>
            <ChevronRight size={14} />
            <Link href="/courses" className="hover:text-foreground">Cursos</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium line-clamp-1">{course.title}</span>
          </nav>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">{course.level}</span>
                <span className="flex items-center gap-1"><Clock size={14} />{course.duration}</span>
                <span className="flex items-center gap-1"><Users size={14} />{course.students} alunos</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{course.title}</h1>
              <p className="text-lg text-muted-foreground mb-4">{course.subtitle}</p>
              <p className="text-muted-foreground mb-6">{course.description}</p>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                  {course.instructor.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium">Por {course.instructor}</p>
                  <p className="text-xs text-muted-foreground">{course.instructorBio}</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-32">
                <div className="h-48 bg-muted overflow-hidden">
                  <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl font-bold text-accent">{course.price}</span>
                    {course.originalPrice && <span className="text-lg text-muted-foreground line-through">{course.originalPrice}</span>}
                  </div>
                  <button className="w-full px-4 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 mb-3">
                    <ShoppingCart size={18} /> Comprar Agora
                  </button>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> {course.language}</div>
                    <div className="flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> {course.lessons} aulas</div>
                    {course.includes.map((inc) => (
                      <div key={inc} className="flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> {inc}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <section className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Conteúdo do Curso</h2>
          <div className="space-y-4">
            {course.curriculum.map((mod, i) => (
              <div key={mod.module} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 bg-muted/30 flex items-center justify-between">
                  <h3 className="font-bold">{mod.module}</h3>
                  <span className="text-sm text-muted-foreground">{mod.lessons.length} aulas</span>
                </div>
                <div className="divide-y divide-border">
                  {mod.lessons.map((lesson) => (
                    <div key={lesson} className="px-4 py-3 flex items-center gap-3 text-sm">
                      <PlayCircle size={16} className="text-muted-foreground flex-shrink-0" />
                      <span>{lesson}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
