'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Check, ChevronRight, Upload } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useAuth } from '@/src/hooks/useAuth';
import { storesAPI } from '@/src/lib/api';

const steps = [
  { number: 1, label: 'Informações da Loja' },
  { number: 2, label: 'Dados do Vendedor' },
  { number: 3, label: 'Políticas & Finalizar' },
];

const needsVerso = (docType: string) => docType === 'bi';

const CATEGORIES_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  physical: [
    { value: 'eletronicos', label: '📱 Electrónicos & Tecnologia' },
    { value: 'moda', label: '👗 Moda, Roupa & Calçado' },
    { value: 'casa-jardim', label: '🏠 Casa, Decoração & Jardim' },
    { value: 'esportes', label: '⚽ Desporto & Lazer' },
    { value: 'livros', label: '📚 Livros Físicos & Papelaria' },
    { value: 'beleza', label: '💄 Beleza, Saúde & Bem-Estar' },
    { value: 'brinquedos', label: '🎮 Brinquedos & Jogos' },
    { value: 'automotivo', label: '🚗 Automóvel & Acessórios' },
    { value: 'artesanato', label: '🎨 Artesanato & Cultura' },
    { value: 'alimentacao', label: '🍽️ Alimentação & Bebidas' },
  ],
  digital: [
    { value: 'ebooks', label: '📖 Ebooks & Livros Digitais' },
    { value: 'software', label: '💻 Software & Aplicações' },
    { value: 'musica', label: '🎵 Música & Áudio' },
    { value: 'templates', label: '📋 Templates & Recursos' },
    { value: 'arte-digital', label: '🖼️ Arte Digital & NFTs' },
    { value: 'cursos-gravados', label: '📹 Cursos Gravados' },
    { value: 'planilhas', label: '📊 Planilhas & Ferramentas' },
  ],
  course: [
    { value: 'programacao', label: '💻 Programação & Tecnologia' },
    { value: 'design', label: '🎨 Design & Criatividade' },
    { value: 'marketing', label: '📈 Marketing & Vendas' },
    { value: 'negocios', label: '💼 Negócios & Empreendedorismo' },
    { value: 'financas', label: '💰 Finanças & Investimentos' },
    { value: 'idiomas', label: '🌍 Idiomas & Comunicação' },
    { value: 'culinaria', label: '🍳 Culinária & Gastronomia' },
    { value: 'bem-estar', label: '🧘 Saúde & Bem-Estar' },
  ],
};

export default function SellerRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    storeName: '',
    description: '',
    category: '',
    location: '',
    sellerType: 'individual', // 'individual' | 'company'
    // Individual
    phone: '',
    fullName: '',
    email: '',
    docType: '',
    nuit: '',
    // Company
    companyName: '',
    companyNuit: '',
    representativeName: '',
    companyPhone: '',
    companyEmail: '',
    repDocType: '', // Tipo de doc do representante: 'bi' | 'passaporte' | 'diire'
    // Product type (single selection)
    productType: '',
    // Policies
    shippingPolicy: '',
    returnPolicy: '',
    agreeTerms: false,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  // Individual: frente + verso do doc pessoal
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  // Company: documentos da empresa
  const [companyNuitFile, setCompanyNuitFile] = useState<File | null>(null);
  const [companyNuitPreview, setCompanyNuitPreview] = useState<string | null>(null);
  const [companyAlvaraFile, setCompanyAlvaraFile] = useState<File | null>(null);
  const [companyAlvaraPreview, setCompanyAlvaraPreview] = useState<string | null>(null);
  // Company: documentos pessoais do representante
  const [repFrontFile, setRepFrontFile] = useState<File | null>(null);
  const [repFrontPreview, setRepFrontPreview] = useState<string | null>(null);
  const [repBackFile, setRepBackFile] = useState<File | null>(null);
  const [repBackPreview, setRepBackPreview] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const companyNuitRef = useRef<HTMLInputElement>(null);
  const companyAlvaraRef = useRef<HTMLInputElement>(null);
  const repFrontRef = useRef<HTMLInputElement>(null);
  const repBackRef = useRef<HTMLInputElement>(null);

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFrontPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setBackPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/seller/register');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
        representativeName: prev.representativeName || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        companyEmail: prev.companyEmail || user.email || '',
      }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!form.agreeTerms) { setError('Deve aceitar os Termos e Condições para continuar.'); return; }
    if (!form.productType) {
      setError('Seleccione o tipo de produto que vai vender (físico, digital ou curso).');
      setStep(1);
      return;
    }

    setSubmitting(true); setError('');

    try {
      const isCompany = form.sellerType === 'company';
      const fd = new FormData();
      fd.append('name', form.storeName);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('location', form.location);
      fd.append('phone', isCompany ? form.companyPhone : form.phone);
      fd.append('email', isCompany ? (form.companyEmail || user?.email || '') : (form.email || user?.email || ''));
      fd.append('shipping_policy', form.shippingPolicy);
      fd.append('return_policy', form.returnPolicy);
      fd.append('product_type', form.productType);
      if (logoFile) fd.append('logo', logoFile);

      // ── Documentos de verificação ──
      if (isCompany) {
        // Empresa: NUIT/registo → tax_document, Alvará → additional_documents (opcional)
        if (companyNuitFile) fd.append('tax_document', companyNuitFile);
        if (companyAlvaraFile) fd.append('additional_documents', companyAlvaraFile);
        // Representante: frente → identity_document, verso (BI/DIRE) → address_proof
        if (repFrontFile) fd.append('identity_document', repFrontFile);
        if (repBackFile) fd.append('address_proof', repBackFile);
      } else {
        // Particular: frente do doc → identity_document, verso → additional_documents
        if (frontFile) fd.append('identity_document', frontFile);
        if (backFile) fd.append('additional_documents', backFile);
      }

      await storesAPI.register(fd);
      setSuccess(true);
    } catch (err: any) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join('. ') : 'Erro ao enviar solicitação.');
    } finally { setSubmitting(false); }
  };

  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <LoadingSpinner size={32} message="A carregar..." />
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-[calc(100vh-200px)] py-12 px-4 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-green-100 rounded-full mb-6">
            <Check size={48} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Solicitação Enviada! 🎉</h1>
          <p className="text-muted-foreground mb-6">
            A sua loja <strong>{form.storeName}</strong> foi submetida para aprovação.
            A nossa equipa irá rever os dados e activar a sua loja em breve.
          </p>
          <Link href="/seller/dashboard" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 inline-block">
            Ir para o Painel do Vendedor
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-200px)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-accent/10 rounded-full mb-4">
            <Store size={32} className="text-accent" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Abra sua Loja no eShoppingCentre</h1>
          <p className="text-muted-foreground">
            Junte-se ao maior marketplace de Moçambique e comece a vender hoje mesmo.
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > s.number ? 'bg-green-500 text-white' :
                step === s.number ? 'bg-accent text-accent-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {step > s.number ? <Check size={16} /> : s.number}
              </div>
              <span className={`text-sm hidden sm:inline ${step === s.number ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <ChevronRight size={16} className="text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6">
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold">Informações da Loja</h2>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Vendedor *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => updateField('sellerType', 'individual')}
                    className={`p-4 border-2 rounded-lg text-center transition-colors ${
                      form.sellerType === 'individual' ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'
                    }`}>
                    <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2" fill="none" className={form.sellerType === 'individual' ? 'text-accent' : 'text-muted-foreground'} />
                      <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" className={form.sellerType === 'individual' ? 'text-accent' : 'text-muted-foreground'} />
                    </svg>
                    <span className="text-sm font-medium">Particular</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Pessoa singular</p>
                  </button>
                  <button type="button" onClick={() => updateField('sellerType', 'company')}
                    className={`p-4 border-2 rounded-lg text-center transition-colors ${
                      form.sellerType === 'company' ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'
                    }`}>
                    <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="2" fill="none" className={form.sellerType === 'company' ? 'text-accent' : 'text-muted-foreground'} />
                      <rect x="12" y="10" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" className={form.sellerType === 'company' ? 'text-accent' : 'text-muted-foreground'} />
                      <line x1="12" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={form.sellerType === 'company' ? 'text-accent' : 'text-muted-foreground'} />
                      <line x1="12" y1="24" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={form.sellerType === 'company' ? 'text-accent' : 'text-muted-foreground'} />
                      <line x1="12" y1="28" x2="18" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={form.sellerType === 'company' ? 'text-accent' : 'text-muted-foreground'} />
                    </svg>
                    <span className="text-sm font-medium">Empresa</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Pessoa colectiva</p>
                  </button>
                </div>
              </div>

              {form.sellerType === 'company' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome da Empresa *</label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          companyName: val,
                          // Auto-fill store name only if user hasn't customized it yet
                          storeName: prev.storeName === prev.companyName || !prev.storeName ? val : prev.storeName,
                        }));
                      }}
                      placeholder="Ex: TechMoz, Lda."
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome da Loja (marca)</label>
                    <input
                      type="text"
                      value={form.storeName}
                      onChange={(e) => updateField('storeName', e.target.value)}
                      placeholder={form.companyName || 'Ex: TechMoz Store'}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="text-xs text-muted-foreground mt-1">O nome público da sua loja. Pode ser diferente do nome da empresa.</p>
                  </div>
                </div>
              )}

              {form.sellerType === 'individual' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da Loja *</label>
                  <input type="text" value={form.storeName} onChange={(e) => updateField('storeName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Descrição *</label>
                <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Produto que vai vender *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    {
                      value: 'physical' as const,
                      label: 'Produtos Físicos',
                      desc: 'Com stock e envio',
                      icon: (
                        <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 12l14-7 14 7-14 7L6 12z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                          <path d="M6 12v16l14 7V28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                          <path d="M34 12v16l-14 7V28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                          <line x1="20" y1="19" x2="20" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ),
                    },
                    {
                      value: 'digital' as const,
                      label: 'Produtos Digitais',
                      desc: 'Download imediato',
                      icon: (
                        <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 6h10l10 10v16a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                          <path d="M22 6v10h10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                          <path d="M14 24l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="20" y1="20" x2="20" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ),
                    },
                    {
                      value: 'course' as const,
                      label: 'Cursos Online',
                      desc: 'Conteúdo educativo',
                      icon: (
                        <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="6" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
                          <path d="M16 15l8 5-8 5V15z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                          <path d="M10 32l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M30 32l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ),
                    },
                  ]).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, productType: t.value, category: '' }))}
                      className={`p-4 border-2 rounded-lg text-center transition-colors ${
                        form.productType === t.value ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'
                      }`}
                    >
                      <span className={`${form.productType === t.value ? 'text-accent' : 'text-muted-foreground'}`}>
                        {t.icon}
                      </span>
                      <span className="text-sm font-medium">{t.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {form.productType && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Categoria Específica *</label>
                    <select value={form.category} onChange={(e) => updateField('category', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required>
                      <option value="">Seleccione a categoria...</option>
                      {(CATEGORIES_BY_TYPE[form.productType] || []).map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {form.productType === 'physical' && 'Escolha a categoria que melhor representa os produtos que vai vender.'}
                      {form.productType === 'digital' && 'Escolha o tipo de conteúdo digital que irá comercializar.'}
                      {form.productType === 'course' && 'Escolha a área principal dos seus cursos.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Localização *</label>
                    <select value={form.location} onChange={(e) => updateField('location', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required>
                      <option value="">Selecionar...</option>
                      <option value="Maputo">Maputo</option><option value="Beira">Beira</option>
                      <option value="Nampula">Nampula</option><option value="Pemba">Pemba</option>
                      <option value="Tete">Tete</option><option value="Quelimane">Quelimane</option>
                      <option value="Chimoio">Chimoio</option><option value="Inhambane">Inhambane</option>
                      <option value="Lichinga">Lichinga</option><option value="Xai-Xai">Xai-Xai</option>
                    </select>
                  </div>
                </div>
              )}

              {!form.productType && (
                <div>
                  <label className="block text-sm font-medium mb-1">Localização *</label>
                  <select value={form.location} onChange={(e) => updateField('location', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required>
                    <option value="">Selecionar...</option>
                    <option value="Maputo">Maputo</option><option value="Beira">Beira</option>
                    <option value="Nampula">Nampula</option><option value="Pemba">Pemba</option>
                    <option value="Tete">Tete</option><option value="Quelimane">Quelimane</option>
                    <option value="Chimoio">Chimoio</option><option value="Inhambane">Inhambane</option>
                    <option value="Lichinga">Lichinga</option><option value="Xai-Xai">Xai-Xai</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Logótipo da Loja</label>
                <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                <div onClick={() => logoRef.current?.click()}
                  className={`border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    logoPreview ? 'border-accent bg-accent/5' : 'hover:border-accent'
                  }`}>
                  {logoPreview ? (
                    <div className="flex items-center justify-center gap-4">
                      <img src={logoPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-accent">{logoFile?.name}</p>
                        <p className="text-xs text-muted-foreground">Clique para alterar</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Arraste ou clique para fazer upload</p>
                      <p className="text-xs text-muted-foreground mt-1">Recomendado: 500x500px, PNG ou JPG</p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold">Dados do Vendedor</h2>

              {form.sellerType === 'individual' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nome Completo *</label>
                      <input type="text" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)}
                        className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Telefone *</label>
                      <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)}
                        className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+258 84 000 0000" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Documento de Identificação *</label>
                      <select value={form.docType} onChange={(e) => updateField('docType', e.target.value)}
                        className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required>
                        <option value="">Selecionar...</option>
                        <option value="bi">BI (Bilhete de Identidade)</option>
                        <option value="passaporte">Passaporte</option>
                        <option value="diire">DIRE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">NUIT</label>
                      <input type="text" value={form.nuit} onChange={(e) => updateField('nuit', e.target.value)}
                        placeholder="Ex: 123456789"
                        className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                      <p className="text-xs text-muted-foreground mt-1">Opcional. Necessário para emissão de facturas.</p>
                    </div>
                  </div>

                  {/* Document upload for individual */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Upload do Documento *</label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                      {form.docType === 'bi' ? (
                        <p>📸 Fotografe a <strong>frente</strong> e o <strong>verso</strong> do Bilhete de Identidade.</p>
                      ) : form.docType === 'passaporte' ? (
                        <p>📸 Fotografe a <strong>página de identificação</strong> do passaporte — onde estão os seus dados e foto.</p>
                      ) : form.docType === 'diire' ? (
                        <p>📸 Fotografe a <strong>frente e verso</strong> do DIRE.</p>
                      ) : (
                        <p>📸 Faça upload do seu documento de identificação. Imagens nítidas e legíveis.</p>
                      )}
                    </div>

                    <div className={`grid gap-4 ${needsVerso(form.docType) || form.docType === 'diire' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {/* FRENTE */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5 text-center">
                          {form.docType === 'passaporte' ? 'PÁGINA DE IDENTIFICAÇÃO' : 'FRENTE DO DOCUMENTO'}
                        </label>
                        <input ref={frontRef} type="file" accept="image/*" onChange={handleFrontChange} className="hidden" />
                        {frontPreview ? (
                          <div className="relative group rounded-lg overflow-hidden border-2 border-green-300">
                            <img src={frontPreview} alt="Frente" className="w-full h-40 object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                              <button type="button" onClick={() => { setFrontFile(null); setFrontPreview(null); }}
                                className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md transition-opacity">Remover</button>
                              <button type="button" onClick={() => frontRef.current?.click()}
                                className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs px-3 py-1.5 rounded-md transition-opacity">Alterar</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => frontRef.current?.click()}
                            className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                            <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">
                              {form.docType === 'passaporte' ? 'Fotografar página' : 'Fotografar frente'}
                            </span>
                            <span className="text-xs text-muted-foreground block mt-1">Clique para fazer upload</span>
                          </button>
                        )}
                      </div>

                      {/* VERSO - only for BI and DIRE */}
                      {(needsVerso(form.docType) || form.docType === 'diire') && (
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5 text-center">VERSO DO DOCUMENTO</label>
                          <input ref={backRef} type="file" accept="image/*" onChange={handleBackChange} className="hidden" />
                          {backPreview ? (
                            <div className="relative group rounded-lg overflow-hidden border-2 border-green-300">
                              <img src={backPreview} alt="Verso" className="w-full h-40 object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                                <button type="button" onClick={() => { setBackFile(null); setBackPreview(null); }}
                                  className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md transition-opacity">Remover</button>
                                <button type="button" onClick={() => backRef.current?.click()}
                                  className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs px-3 py-1.5 rounded-md transition-opacity">Alterar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => backRef.current?.click()}
                              className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                              <span className="text-sm text-muted-foreground">Fotografar verso</span>
                              <span className="text-xs text-muted-foreground block mt-1">Clique para fazer upload</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {form.sellerType === 'company' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">NUIT da Empresa *</label>
                      <input type="text" value={form.companyNuit} onChange={(e) => updateField('companyNuit', e.target.value)}
                        placeholder="Ex: 123456789"
                        className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Telefone *</label>
                      <input type="tel" value={form.companyPhone} onChange={(e) => updateField('companyPhone', e.target.value)}
                        className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+258 84 000 0000" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email da Empresa *</label>
                    <input type="email" value={form.companyEmail} onChange={(e) => updateField('companyEmail', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome do Representante *</label>
                    <input type="text" value={form.representativeName} onChange={(e) => updateField('representativeName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                  </div>

                  {/* Document upload for company */}
                  <div className="space-y-6">
                    {/* ── Documentos da Empresa ── */}
                    <div>
                      <label className="block text-sm font-medium mb-2">📁 Documentos da Empresa *</label>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                        <p>📸 Faça upload do <strong>certificado NUIT</strong> ou <strong>documento de registo comercial</strong> da empresa. O alvará/licença é opcional mas recomendado.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Doc 1 - NUIT / Registo Comercial (obrigatório) */}
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5 text-center">
                            📷 NUIT / REGISTO COMERCIAL *
                          </label>
                          <input ref={companyNuitRef} type="file" accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setCompanyNuitFile(file);
                                const reader = new FileReader();
                                reader.onloadend = () => setCompanyNuitPreview(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden" />
                          {companyNuitPreview ? (
                            <div className="relative group rounded-lg overflow-hidden border-2 border-green-300">
                              <img src={companyNuitPreview} alt="NUIT" className="w-full h-40 object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                                <button type="button" onClick={() => { setCompanyNuitFile(null); setCompanyNuitPreview(null); }}
                                  className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md transition-opacity">Remover</button>
                                <button type="button" onClick={() => companyNuitRef.current?.click()}
                                  className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs px-3 py-1.5 rounded-md transition-opacity">Alterar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => companyNuitRef.current?.click()}
                              className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                              <span className="text-sm text-muted-foreground">Fotografar NUIT</span>
                              <span className="text-xs text-muted-foreground block mt-1">Clique para fazer upload</span>
                            </button>
                          )}
                        </div>

                        {/* Doc 2 - Alvará / Licença (opcional) */}
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5 text-center">
                            📷 ALVARÁ / LICENÇA <span className="text-muted-foreground font-normal">(opcional)</span>
                          </label>
                          <input ref={companyAlvaraRef} type="file" accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setCompanyAlvaraFile(file);
                                const reader = new FileReader();
                                reader.onloadend = () => setCompanyAlvaraPreview(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden" />
                          {companyAlvaraPreview ? (
                            <div className="relative group rounded-lg overflow-hidden border-2 border-green-300">
                              <img src={companyAlvaraPreview} alt="Alvará" className="w-full h-40 object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                                <button type="button" onClick={() => { setCompanyAlvaraFile(null); setCompanyAlvaraPreview(null); }}
                                  className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md transition-opacity">Remover</button>
                                <button type="button" onClick={() => companyAlvaraRef.current?.click()}
                                  className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs px-3 py-1.5 rounded-md transition-opacity">Alterar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => companyAlvaraRef.current?.click()}
                              className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                              <span className="text-sm text-muted-foreground">Fotografar alvará</span>
                              <span className="text-xs text-muted-foreground block mt-1">Clique para fazer upload</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Documentos Pessoais do Representante ── */}
                    <div>
                      <label className="block text-sm font-medium mb-2">🪪 Documento do Representante *</label>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                        <p>📸 Documento de identificação pessoal do representante da empresa. Imagens nítidas e legíveis.</p>
                      </div>

                      {/* Tipo de documento do representante */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Documento *</label>
                        <select
                          value={form.repDocType}
                          onChange={(e) => {
                            updateField('repDocType', e.target.value);
                            // Limpar imagens ao trocar tipo
                            setRepFrontFile(null); setRepFrontPreview(null);
                            setRepBackFile(null); setRepBackPreview(null);
                          }}
                          className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        >
                          <option value="">Selecionar...</option>
                          <option value="bi">BI (Bilhete de Identidade)</option>
                          <option value="passaporte">Passaporte</option>
                          <option value="diire">DIRE</option>
                        </select>
                      </div>

                      {/* Info contextual */}
                      {form.repDocType && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                          {form.repDocType === 'bi' ? (
                            <p>📸 Fotografe a <strong>frente</strong> e o <strong>verso</strong> do Bilhete de Identidade do representante.</p>
                          ) : form.repDocType === 'passaporte' ? (
                            <p>📸 Fotografe a <strong>página de identificação</strong> do passaporte — onde estão os dados e foto do representante.</p>
                          ) : form.repDocType === 'diire' ? (
                            <p>📸 Fotografe a <strong>frente e verso</strong> do DIRE do representante.</p>
                          ) : null}
                        </div>
                      )}

                      {form.repDocType && (
                        <div className={`grid gap-4 ${needsVerso(form.repDocType) || form.repDocType === 'diire' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                          {/* FRENTE */}
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5 text-center">
                              {form.repDocType === 'passaporte' ? 'PÁGINA DE IDENTIFICAÇÃO' : 'FRENTE DO DOCUMENTO'}
                            </label>
                            <input ref={repFrontRef} type="file" accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setRepFrontFile(file);
                                  const reader = new FileReader();
                                  reader.onloadend = () => setRepFrontPreview(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden" />
                            {repFrontPreview ? (
                              <div className="relative group rounded-lg overflow-hidden border-2 border-green-300">
                                <img src={repFrontPreview} alt="Frente" className="w-full h-40 object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                                  <button type="button" onClick={() => { setRepFrontFile(null); setRepFrontPreview(null); }}
                                    className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md transition-opacity">Remover</button>
                                  <button type="button" onClick={() => repFrontRef.current?.click()}
                                    className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs px-3 py-1.5 rounded-md transition-opacity">Alterar</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => repFrontRef.current?.click()}
                                className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                                <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                                <span className="text-sm text-muted-foreground">
                                  {form.repDocType === 'passaporte' ? 'Fotografar página' : 'Fotografar frente'}
                                </span>
                                <span className="text-xs text-muted-foreground block mt-1">Clique para fazer upload</span>
                              </button>
                            )}
                          </div>

                          {/* VERSO - only for BI and DIRE */}
                          {(needsVerso(form.repDocType) || form.repDocType === 'diire') && (
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1.5 text-center">VERSO DO DOCUMENTO</label>
                              <input ref={repBackRef} type="file" accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setRepBackFile(file);
                                    const reader = new FileReader();
                                    reader.onloadend = () => setRepBackPreview(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="hidden" />
                              {repBackPreview ? (
                                <div className="relative group rounded-lg overflow-hidden border-2 border-green-300">
                                  <img src={repBackPreview} alt="Verso" className="w-full h-40 object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => { setRepBackFile(null); setRepBackPreview(null); }}
                                      className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md transition-opacity">Remover</button>
                                    <button type="button" onClick={() => repBackRef.current?.click()}
                                      className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs px-3 py-1.5 rounded-md transition-opacity">Alterar</button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => repBackRef.current?.click()}
                                  className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                                  <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                                  <span className="text-sm text-muted-foreground">Fotografar verso</span>
                                  <span className="text-xs text-muted-foreground block mt-1">Clique para fazer upload</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold">Políticas & Finalizar</h2>

              {/* Tipo seleccionado */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                <p className="font-bold">📋 Resumo</p>
                <p><span className="text-muted-foreground">Tipo de loja:</span> <strong>
                  {form.productType === 'physical' ? '📦 Produtos Físicos' : form.productType === 'digital' ? '📄 Produtos Digitais' : '🎓 Cursos Online'}
                </strong></p>
                <p><span className="text-muted-foreground">Categoria:</span> {CATEGORIES_BY_TYPE[form.productType]?.find(c => c.value === form.category)?.label || form.category || '—'}</p>
                <p><span className="text-muted-foreground">Localização:</span> {form.location || '—'}</p>
              </div>

              {form.productType === 'physical' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">📦 Política de Envio *</label>
                    <textarea value={form.shippingPolicy} onChange={(e) => updateField('shippingPolicy', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                      placeholder="Ex: Entregas em Maputo em 24h. Resto do país 3-7 dias via transportadora. Custo calculado no checkout." required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">📦 Política de Devolução *</label>
                    <textarea value={form.returnPolicy} onChange={(e) => updateField('returnPolicy', e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                      placeholder="Ex: Aceitamos devoluções em até 7 dias. Produto intacto e na embalagem original." required />
                  </div>
                </>
              )}

              {form.productType === 'digital' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm">
                  <p className="font-medium text-purple-800 mb-1">📄 Entrega de Produtos Digitais</p>
                  <p className="text-purple-700">O ficheiro será disponibilizado automaticamente ao cliente após confirmação do pagamento. Certifique-se de que os ficheiros estão livres de vírus.</p>
                </div>
              )}

              {form.productType === 'course' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                  <p className="font-medium text-green-800 mb-1">🎓 Plataforma de Cursos</p>
                  <p className="text-green-700">Após aprovação, poderá criar módulos e aulas no painel do vendedor. Os alunos acedem aos cursos através da plataforma.</p>
                </div>
              )}

              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                <h3 className="font-bold text-sm mb-2">💼 Taxas da Plataforma</h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex justify-between"><span>Comissão por venda</span> <strong>{form.productType === 'physical' ? '8%' : form.productType === 'digital' ? '5%' : '15%'}</strong></li>
                  <li className="flex justify-between"><span>Comissão de afiliados</span> <strong>10%</strong></li>
                  <li className="flex justify-between"><span>Levantamentos</span> <strong className="text-green-600">Grátis</strong></li>
                  <li className="flex justify-between"><span>Retenção</span> <strong>{form.productType === 'physical' ? '14 dias' : '7 dias'}</strong></li>
                </ul>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.agreeTerms} onChange={(e) => updateField('agreeTerms', e.target.checked)}
                  className="mt-1 accent-accent" required />
                <span className="text-sm text-muted-foreground">
                  Concordo com os <Link href="/terms" className="text-accent hover:underline">Termos de Serviço</Link> e a{' '}
                  <Link href="/privacy" className="text-accent hover:underline">Política de Privacidade</Link> do eShoppingCentre.
                </span>
              </label>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <button type="button" onClick={() => { setStep(step - 1); setError(''); }}
                className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Voltar
              </button>
            )}
            <button type="submit" disabled={submitting}
              className="flex-1 px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
              {submitting ? 'Enviando...' : step === 3 ? 'Enviar Solicitação' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
