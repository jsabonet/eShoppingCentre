import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Clock, Star, Users, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cursos Online | eShoppingCentre',
  description: 'Aprenda com os melhores cursos online. Desenvolvimento, marketing, design e muito mais.',
};

const courses = [
  { slug: 'python-para-iniciantes', title: 'Python para Iniciantes', instructor: 'Dr. Carlos Macamo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg', price: '2.499 MZN', originalPrice: '4.999 MZN', rating: 4.8, students: 1234, duration: '20h', lessons: 48, level: 'Iniciante' },
  { slug: 'marketing-digital-completo', title: 'Marketing Digital Completo', instructor: 'Ana Mondlane', image: 'https://cdn.b12.io/client_media/iKv1biKD/573d35e0-7e6e-11f1-a56d-0242ac110002-m84D8GY8ROKweXe5v3qi3.jpg', price: '3.499 MZN', originalPrice: null, rating: 4.6, students: 856, duration: '15h', lessons: 34, level: 'Intermediário' },
  { slug: 'fotografia-profissional', title: 'Fotografia Profissional com Smartphone', instructor: 'Pedro Chissano', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg', price: '1.999 MZN', originalPrice: '2.999 MZN', rating: 4.9, students: 2103, duration: '10h', lessons: 25, level: 'Iniciante' },
  { slug: 'excel-avancado', title: 'Excel Avançado para Negócios', instructor: 'Maria Santos', image: 'https://cdn.b12.io/client_media/iKv1biKD/5b46db3a-7e6e-11f1-98fb-0242ac110002-yUsdDCiNGkUXvIXwHDkP9.jpg', price: '2.999 MZN', originalPrice: null, rating: 4.7, students: 1567, duration: '12h', lessons: 30, level: 'Avançado' },
  { slug: 'empreendedorismo-digital', title: 'Empreendedorismo Digital', instructor: 'João Silva', image: 'https://cdn.b12.io/client_media/iKv1biKD/5783f32a-7e6e-11f1-a05c-0242ac110002-gL5f6HGZjVLK9tX7ZtneG.jpg', price: '4.999 MZN', originalPrice: '6.999 MZN', rating: 4.5, students: 678, duration: '25h', lessons: 60, level: 'Intermediário' },
  { slug: 'design-grafico-canva', title: 'Design Gráfico com Canva', instructor: 'Lúcia Sitoe', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aaa7a70-7e6e-11f1-9018-0242ac110002-4Rd8xIvDAA18urOueGtC6.jpg', price: '1.499 MZN', originalPrice: '2.499 MZN', rating: 4.8, students: 3456, duration: '8h', lessons: 20, level: 'Iniciante' },
];

const levels = ['Todos', 'Iniciante', 'Intermediário', 'Avançado'];

export default function CoursesPage() {
  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Cursos</span>
          </nav>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-accent/10 rounded-full"><BookOpen size={28} className="text-accent" /></div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Cursos Online</h1>
              <p className="text-lg text-muted-foreground">Aprenda novas habilidades com os melhores instrutores</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {levels.map((level) => (
              <button key={level} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                level === 'Todos' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border hover:bg-muted'
              }`}>{level}</button>
            ))}
          </div>
        </div>
      </div>

      <section className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link key={course.slug} href={`/courses/${course.slug}`}
              className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
              <div className="h-48 overflow-hidden relative">
                <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-3 left-3 px-2 py-1 bg-white/90 rounded-md text-xs font-medium">{course.level}</span>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-1 group-hover:text-accent transition-colors line-clamp-1">{course.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{course.instructor}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Star size={14} className="text-accent fill-accent" />{course.rating}</span>
                  <span className="flex items-center gap-1"><Users size={14} />{course.students}</span>
                  <span className="flex items-center gap-1"><Clock size={14} />{course.duration}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{course.lessons} aulas</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-accent">{course.price}</span>
                  {course.originalPrice && <span className="text-sm text-muted-foreground line-through">{course.originalPrice}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
