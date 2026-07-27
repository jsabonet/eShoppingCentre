'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Save, Upload, X, Palette, Store, Info, Phone, Mail, MapPin, Percent, FileText, ShieldCheck, Image, Layout, CheckCircle2 } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { storesAPI } from '@/src/lib/api';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

function apiMediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

const LOCATIONS = ['Maputo', 'Beira', 'Nampula', 'Pemba', 'Quelimane', 'Tete', 'Lichinga', 'Xai-Xai', 'Inhambane', 'Matola', 'Chimoio'];

const THEME_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Roxo', value: '#9333ea' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Ciano', value: '#0891b2' },
  { name: 'Âmbar', value: '#d97706' },
  { name: 'Vermelho', value: '#dc2626' },
];

export default function SellerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storeSlug, setStoreSlug] = useState('');
  const [activeTab, setActiveTab] = useState('appearance');

  const TABS = [
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'description', label: 'Descrição', icon: Info },
    { id: 'contact', label: 'Contacto', icon: Phone },
    { id: 'commission', label: 'Comissão', icon: Percent },
    { id: 'policies', label: 'Políticas', icon: ShieldCheck },
  ];

  const [form, setForm] = useState({
    name: '',
    tagline: '',
    description: '',
    about: '',
    theme_color: '#2563eb',
    phone: '',
    email: '',
    location: 'Maputo',
    default_affiliate_commission: '10',
    low_stock_threshold: '5',
    shipping_policy: '',
    return_policy: '',
  });

  // Logo / Banner files
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ─── Load store data ───
  useEffect(() => {
    (async () => {
      try {
        const { data } = await storesAPI.myStore();
        setStoreSlug(data.slug);
        setForm({
          name: data.name || '',
          tagline: data.tagline || '',
          description: data.description || '',
          about: data.about || '',
          theme_color: data.theme_color || '#2563eb',
          phone: data.phone || '',
          email: data.email || '',
          location: data.location || 'Maputo',
          default_affiliate_commission: String(data.default_affiliate_commission ?? '10'),
          low_stock_threshold: String(data.low_stock_threshold ?? '5'),
          shipping_policy: data.shipping_policy || '',
          return_policy: data.return_policy || '',
        });
        setCurrentLogo(apiMediaUrl(data.logo));
        setCurrentBanner(apiMediaUrl(data.banner));
      } catch (err) {
        setMessage({ type: 'error', text: 'Erro ao carregar dados da loja.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // ─── File handlers ───
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearLogo = () => { setLogoFile(null); setLogoPreview(null); setCurrentLogo(null); };
  const clearBanner = () => { setBannerFile(null); setBannerPreview(null); setCurrentBanner(null); };

  // ─── Submit ───
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('tagline', form.tagline);
      fd.append('description', form.description);
      fd.append('about', form.about);
      fd.append('theme_color', form.theme_color);
      fd.append('phone', form.phone);
      fd.append('email', form.email);
      fd.append('location', form.location);
      fd.append('default_affiliate_commission', form.default_affiliate_commission);
      fd.append('low_stock_threshold', form.low_stock_threshold);
      fd.append('shipping_policy', form.shipping_policy);
      fd.append('return_policy', form.return_policy);

      if (logoFile) fd.append('logo', logoFile);
      if (bannerFile) fd.append('banner', bannerFile);

      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      await axios.patch(`${API_URL}/stores/me/`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      // Update previews after successful upload
      if (logoFile) {
        setCurrentLogo(logoPreview);
        setLogoFile(null);
      }
      if (bannerFile) {
        setCurrentBanner(bannerPreview);
        setBannerFile(null);
      }

      setMessage({ type: 'success', text: 'Configurações guardadas com sucesso!' });
    } catch (err: any) {
      const detail = err.response?.data;
      const msg = typeof detail === 'object' ? Object.values(detail).flat().join('. ') : 'Erro ao guardar.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }, [form, logoFile, bannerFile, logoPreview, bannerPreview]);

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  const displayLogo = logoPreview || currentLogo;
  const displayBanner = bannerPreview || currentBanner;

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações da Loja</h1>
          <p className="text-sm text-muted-foreground">Personalize a aparência e informações da sua loja</p>
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* ─── Preview ─── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="h-48 md:h-64 bg-muted relative">
            {displayBanner ? (
              <img src={displayBanner} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center gap-3"
                style={{ background: `linear-gradient(135deg, ${form.theme_color}22, ${form.theme_color}44)` }}>
                <Store size={64} className="text-muted-foreground/20" />
                <div className="text-xs text-muted-foreground/50">
                  <p>Banner: 1200×400px</p>
                  <p>PNG ou JPG, máx 2MB</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 text-white text-xs rounded-lg hover:bg-black/80 flex items-center gap-1.5"
            >
              <Upload size={12} /> {displayBanner ? 'Alterar Capa' : 'Adicionar Capa'}
            </button>
            {displayBanner && (
              <button type="button" onClick={clearBanner}
                className="absolute top-3 right-3 p-1 bg-black/40 text-white rounded-full hover:bg-black/60">
                <X size={14} />
              </button>
            )}
            <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleBannerChange} />
          </div>
          <div className="max-w-[1500px] mx-auto px-4 py-6">
            <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 ${displayBanner ? '-mt-12' : ''} relative z-10`}>
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl border border-border/50 overflow-hidden bg-white shrink-0 relative group">
                {displayLogo ? (
                  <img src={displayLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: form.theme_color }}>
                    {form.name?.charAt(0) || 'L'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium gap-0.5"
                >
                  <Upload size={14} />
                  <span className="text-[10px]">Logo</span>
                </button>
                {displayLogo && (
                  <button type="button" onClick={clearLogo}
                    className="absolute top-0 right-0 p-0.5 bg-black/40 text-white rounded-bl-lg hover:bg-black/60">
                    <X size={12} />
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoChange} />
              <div className={`flex-1 ${displayBanner ? 'backdrop-blur-md bg-white/75 dark:bg-black/60 rounded-xl px-4 py-3' : ''}`}>
                <h1 className="text-2xl md:text-3xl font-bold">{form.name || 'Nome da Loja'}</h1>
                <p className="text-sm text-muted-foreground">{form.tagline || 'Slogan da loja'}</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ─── Tab Bar ─── */}
          <div className="flex flex-col sm:flex-row gap-1 bg-muted/40 p-1 rounded-xl mb-6 sticky top-0 z-20 backdrop-blur-sm">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ─── Aparência ─── */}
          {activeTab === 'appearance' && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div>
                <h2 className="font-bold text-lg">Aparência da Loja</h2>
                <p className="text-sm text-muted-foreground">Estes elementos aparecem na página pública da sua loja e na listagem de lojas.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border rounded-xl p-4 flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <Image size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-sm font-semibold">Logótipo</p>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500 shrink-0" /> Quadrado, mín 200×200px</p>
                      <p className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500 shrink-0" /> PNG ou SVG (fundo transparente)</p>
                      <p className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500 shrink-0" /> Máx 1MB</p>
                    </div>
                  </div>
                </div>
                <div className="bg-muted/30 border border-border rounded-xl p-4 flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Layout size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-sm font-semibold">Banner / Capa</p>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500 shrink-0" /> Horizontal, 1200×400px (3:1)</p>
                      <p className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500 shrink-0" /> PNG ou JPG</p>
                      <p className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500 shrink-0" /> Máx 2MB</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nome da Loja</label>
                  <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Ex: TechnoMoz"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Slogan / Tagline</label>
                  <input type="text" value={form.tagline} onChange={(e) => updateField('tagline', e.target.value)}
                    placeholder="Ex: Os melhores preços em tecnologia"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Cor Temática</label>
                <div className="flex flex-wrap gap-2.5">
                  {THEME_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => updateField('theme_color', c.value)}
                      className={`relative w-10 h-10 rounded-xl border-2 transition-all duration-200 ${
                        form.theme_color === c.value
                          ? 'border-foreground scale-110 shadow-lg ring-2 ring-foreground/20'
                          : 'border-transparent hover:scale-105 hover:shadow-md'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {form.theme_color === c.value && (
                        <CheckCircle2 size={14} className="absolute -top-1.5 -right-1.5 text-foreground bg-background rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2.5">Define a cor dos botões, links e destaques na página pública da sua loja.</p>
              </div>
            </div>
          )}

          {/* ─── Descrição ─── */}
          {activeTab === 'description' && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div>
                <h2 className="font-bold text-lg">Descrição da Loja</h2>
                <p className="text-sm text-muted-foreground">Conte aos clientes quem é e o que torna a sua loja especial.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Descrição Curta</label>
                <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none text-sm"
                  placeholder="Breve descrição que aparece nos cards de listagem..." />
                <p className="text-xs text-muted-foreground mt-1.5">Aparece nos cards de listagem de lojas. Máx 2-3 frases.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Sobre a Loja</label>
                <textarea value={form.about} onChange={(e) => updateField('about', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring h-28 resize-none text-sm"
                  placeholder="Conte a história da sua loja, missão, valores, o que diferencia os seus produtos..." />
              </div>
            </div>
          )}

          {/* ─── Contacto ─── */}
          {activeTab === 'contact' && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div>
                <h2 className="font-bold text-lg">Informações de Contacto</h2>
                <p className="text-sm text-muted-foreground">Como os clientes podem entrar em contacto com a sua loja.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Telefone</label>
                  <input type="text" value={form.phone} onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+258 84 123 4567"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
                    placeholder="contacto@sualoja.co.mz"
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Localização</label>
                <select value={form.location} onChange={(e) => updateField('location', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  {LOCATIONS.map((loc) => <option key={loc}>{loc}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ─── Comissão ─── */}
          {activeTab === 'commission' && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div>
                <h2 className="font-bold text-lg">Comissão & Stock</h2>
                <p className="text-sm text-muted-foreground">Configure as comissões de afiliados e alertas de inventário.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-muted/30 rounded-xl p-4">
                  <label className="block text-sm font-medium mb-1">Comissão de Afiliados (%)</label>
                  <p className="text-xs text-muted-foreground mb-3">Percentagem padrão para novos produtos. Pode alterar por produto.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.default_affiliate_commission} onChange={(e) => updateField('default_affiliate_commission', e.target.value)}
                      min="0" max="100" step="0.5"
                      className="w-24 px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <label className="block text-sm font-medium mb-1">Alerta de Stock Baixo</label>
                  <p className="text-xs text-muted-foreground mb-3">Notificado quando o stock atingir este valor ou menos.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.low_stock_threshold} onChange={(e) => updateField('low_stock_threshold', e.target.value)}
                      min="1" max="100"
                      className="w-24 px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                    <span className="text-muted-foreground text-sm">unidades</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Políticas ─── */}
          {activeTab === 'policies' && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div>
                <h2 className="font-bold text-lg">Políticas</h2>
                <p className="text-sm text-muted-foreground">Defina as políticas da sua loja visíveis para os clientes.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Política de Envio</label>
                <textarea value={form.shipping_policy} onChange={(e) => updateField('shipping_policy', e.target.value)}
                  placeholder="Ex: Enviamos para todo Moçambique em 2-5 dias úteis. Frete grátis acima de 199 MZN."
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Política de Devolução</label>
                <textarea value={form.return_policy} onChange={(e) => updateField('return_policy', e.target.value)}
                  placeholder="Ex: Aceitamos devoluções em até 7 dias após a entrega. O produto deve estar nas condições originais."
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none text-sm" />
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-60">
              <Save size={16} /> {saving ? 'A guardar...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  );
}
