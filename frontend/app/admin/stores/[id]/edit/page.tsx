'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, ChevronRight, Trash2, Loader2, Upload, Image,
  Store, Phone, Mail, Globe, MapPin, Palette, Tag, FileText,
  Shield, ShoppingBag, Banknote, Bell, MessageSquare, Eye
} from 'lucide-react';
import AdminLayout from '@/src/components/admin/AdminLayout';
import { adminAPI } from '@/src/lib/api';
import { useAuth } from '@/src/hooks/useAuth';

const API_BASE = (process.env.NEXT_PUBLIC_MEDIA_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/api\/v1\/?$/, '');

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

const SECTIONS = [
  { id: 'general', label: 'Geral', icon: Store },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'contact', label: 'Contacto', icon: Phone },
  { id: 'settings', label: 'Configuração', icon: Bell },
  { id: 'policies', label: 'Políticas', icon: Shield },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'notes', label: 'Notas', icon: MessageSquare },
];

export default function AdminStoreEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [store, setStore] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState('general');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.replace('/admin/login'); return; }
    if (!isAuthenticated || !isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await adminAPI.getStore(id);
        setStore(data);
        setForm({
          name: data.name || '', slug: data.slug || '',
          description: data.description || '', about: data.about || '',
          tagline: data.tagline || '', category: data.category || '',
          location: data.location || '', phone: data.phone || '',
          email: data.email || '', website: data.website || '',
          shipping_policy: data.shipping_policy || '', return_policy: data.return_policy || '',
          default_affiliate_commission: data.default_affiliate_commission ?? 10,
          low_stock_threshold: data.low_stock_threshold ?? 5,
          theme_color: data.theme_color || '#2563eb',
          admin_notes: data.admin_notes || '',
        });
      } catch { setError('Erro ao carregar a loja.'); }
      finally { setLoading(false); }
    })();
  }, [id, isAuthenticated, isAdmin, authLoading, router]);

  // IntersectionObserver: update active sidebar item on scroll
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break; // first visible section wins
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    const sectionEls = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    sectionEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const hasFiles = logoFile || bannerFile;
      if (hasFiles) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
        if (logoFile) fd.append('logo', logoFile);
        if (bannerFile) fd.append('banner', bannerFile);
        await adminAPI.updateStoreDetails(id, fd, true);
      } else {
        await adminAPI.updateStoreDetails(id, form);
      }
      showToast('success', 'Alterações guardadas com sucesso.');
      setLogoFile(null); setBannerFile(null);
      // Refetch
      const { data } = await adminAPI.getStore(id);
      setStore(data);
    } catch { showToast('error', 'Erro ao guardar alterações.'); }
    finally { setSaving(false); }
  };

  const removeDocument = async (docKey: string, docLabel: string) => {
    if (!confirm(`Remover "${docLabel}"?`)) return;
    try {
      await adminAPI.manageStore(id, 'clear_documents', '', [docKey]);
      const { data } = await adminAPI.getStore(id);
      setStore(data);
      showToast('success', `Documento "${docLabel}" removido.`);
    } catch { showToast('error', 'Erro ao remover documento.'); }
  };

  const updateField = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  // ── Input classes ──
  const inputBase = 'w-full h-11 px-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none';
  const textareaBase = 'w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none resize-none';
  const labelBase = 'block text-[13px] font-semibold text-foreground/80 mb-1.5';

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">A carregar loja...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !store) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Shield size={24} className="text-red-500" />
            </div>
            <p className="text-muted-foreground">{error}</p>
            <Link href="/admin?tab=stores" className="text-sm text-accent hover:underline mt-3 inline-block">← Voltar às lojas</Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const storeName = store?.name || '...';

  return (
    <AdminLayout>
      {/* ── Toast notification ── */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-emerald-900 text-emerald-100' : 'bg-red-900 text-red-100'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.text}
        </div>
      )}

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 -mx-2 px-2 -mt-2 pt-2 pb-3 bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
          <Link href="/admin?tab=stores" className="hover:text-accent transition-colors flex items-center gap-1.5">
            <ArrowLeft size={15} /> Lojas
          </Link>
          <ChevronRight size={13} />
          <Link href={`/admin/stores/${id}`} className="hover:text-accent transition-colors truncate max-w-44">
            {storeName}
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-card border border-border overflow-hidden shadow-sm">
              {store?.logo ? (
                <img src={logoFile ? URL.createObjectURL(logoFile) : (mediaUrl(store.logo) || '')} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted"><Store size={18} className="text-muted-foreground" /></div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">{storeName}</h1>
              <p className="text-xs text-muted-foreground">Editar informações da loja</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href={`/admin/stores/${id}`}
              className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted hover:border-accent/30 transition-all duration-200 inline-flex items-center gap-2">
              Cancelar
            </Link>
            <Link href={`/store/${store?.slug}`} target="_blank"
              className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/40 transition-all duration-200">
              <Eye size={16} />
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 inline-flex items-center gap-2 shadow-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex gap-8 mt-6">
        {/* Sidebar nav */}
        <nav className="w-52 shrink-0 hidden lg:block">
          <div className="sticky top-36 space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button key={s.id} onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}>
                  <Icon size={16} className={isActive ? 'text-accent' : 'text-muted-foreground'} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* ── SECÇÃO: Geral ── */}
          <section id="general" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store size={15} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Identificação</h2>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelBase}>Nome da loja <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name || ''} onChange={e => updateField('name', e.target.value)} required
                    placeholder="Ex: TechStore Moçambique" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Slug (URL)</label>
                  <input type="text" value={form.slug || ''} onChange={e => updateField('slug', e.target.value)}
                    placeholder="techstore-mocambique" className={`${inputBase} font-mono text-xs`} />
                </div>
              </div>
              <div>
                <label className={labelBase}>Slogan</label>
                <input type="text" value={form.tagline || ''} onChange={e => updateField('tagline', e.target.value)}
                  placeholder="Uma frase curta que descreve a sua loja" className={inputBase} />
              </div>
              <div>
                <label className={labelBase}>Descrição</label>
                <textarea rows={3} value={form.description || ''} onChange={e => updateField('description', e.target.value)}
                  placeholder="Descreva o que a sua loja vende..." className={textareaBase} />
              </div>
              <div>
                <label className={labelBase}>Sobre a loja</label>
                <textarea rows={3} value={form.about || ''} onChange={e => updateField('about', e.target.value)}
                  placeholder="Conte a história da sua marca..." className={textareaBase} />
              </div>
            </div>
          </section>

          {/* ── SECÇÃO: Media ── */}
          <section id="media" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Image size={15} className="text-accent" />
                </div>
                <h2 className="font-semibold text-foreground">Media</h2>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Logo */}
              <div>
                <label className={labelBase}>Logo</label>
                <div className="flex items-start gap-5">
                  <div className={`w-24 h-24 rounded-2xl border-2 border-dashed overflow-hidden shrink-0 transition-all duration-200 flex items-center justify-center ${
                    logoFile || store?.logo
                      ? 'border-border bg-card'
                      : 'border-border bg-muted/50 hover:border-accent/40 hover:bg-accent/5 cursor-pointer'
                  }`}
                    onClick={() => !logoFile && !store?.logo && logoInputRef.current?.click()}>
                    {logoFile || store?.logo ? (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : (mediaUrl(store?.logo) || '')}
                        alt="Logo preview" className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={20} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium">Upload</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={logoInputRef} type="file" accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="hidden" />
                    <button type="button" onClick={() => logoInputRef.current?.click()}
                      className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground/80 hover:bg-muted hover:border-accent/30 transition-all duration-200 inline-flex items-center gap-2">
                      <Upload size={14} />
                      {logoFile || store?.logo ? 'Substituir imagem' : 'Carregar logo'}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {logoFile ? `${logoFile.name} (${(logoFile.size / 1024).toFixed(0)} KB)` :
                       store?.logo ? 'Logo actual. Clique para substituir.' :
                       'Recomendado: 512×512px, PNG ou JPG'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div>
                <label className={labelBase}>Banner</label>
                <div className={`w-full h-32 rounded-2xl border-2 border-dashed overflow-hidden transition-all duration-200 flex items-center justify-center ${
                  bannerFile || store?.banner
                    ? 'border-border bg-card p-0'
                    : 'border-border bg-muted/50 hover:border-accent/40 hover:bg-accent/5 cursor-pointer'
                }`}
                  onClick={() => !bannerFile && !store?.banner && bannerInputRef.current?.click()}>
                  {bannerFile || store?.banner ? (
                    <img
                      src={bannerFile ? URL.createObjectURL(bannerFile) : (mediaUrl(store?.banner) || '')}
                      alt="Banner preview" className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload size={22} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Carregar banner</span>
                      <span className="text-[10px] text-muted-foreground">Recomendado: 1200×400px</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <input ref={bannerInputRef} type="file" accept="image/*"
                    onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                    className="hidden" />
                  <button type="button" onClick={() => bannerInputRef.current?.click()}
                    className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted transition-all duration-200 inline-flex items-center gap-1.5">
                    <Upload size={12} />
                    {bannerFile || store?.banner ? 'Substituir' : 'Carregar'}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {bannerFile ? `${bannerFile.name}` : store?.banner ? 'Banner actual' : ''}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECÇÃO: Contacto ── */}
          <section id="contact" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone size={15} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Contacto &amp; Localização</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelBase}><Phone size={12} className="inline mr-1 text-muted-foreground" /> Telefone</label>
                  <input type="text" value={form.phone || ''} onChange={e => updateField('phone', e.target.value)}
                    placeholder="+258 84 123 4567" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}><Mail size={12} className="inline mr-1 text-muted-foreground" /> Email</label>
                  <input type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)}
                    placeholder="loja@exemplo.com" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}><Tag size={12} className="inline mr-1 text-muted-foreground" /> Categoria</label>
                  <input type="text" value={form.category || ''} onChange={e => updateField('category', e.target.value)}
                    placeholder="Ex: Tecnologia" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}><MapPin size={12} className="inline mr-1 text-muted-foreground" /> Localização</label>
                  <input type="text" value={form.location || ''} onChange={e => updateField('location', e.target.value)}
                    placeholder="Ex: Maputo, Moçambique" className={inputBase} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelBase}><Globe size={12} className="inline mr-1 text-muted-foreground" /> Website</label>
                  <input type="url" value={form.website || ''} onChange={e => updateField('website', e.target.value)}
                    placeholder="https://minhaloja.com" className={inputBase} />
                </div>
              </div>
            </div>
          </section>

          {/* ── SECÇÃO: Configuração ── */}
          <section id="settings" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell size={15} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Configuração</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className={labelBase}><Banknote size={12} className="inline mr-1 text-muted-foreground" /> Comissão de Afiliados</label>
                  <div className="relative">
                    <input type="number" value={form.default_affiliate_commission ?? 10}
                      onChange={e => updateField('default_affiliate_commission', parseFloat(e.target.value))}
                      className={`${inputBase} pr-10`} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelBase}><ShoppingBag size={12} className="inline mr-1 text-muted-foreground" /> Alerta Stock Baixo</label>
                  <div className="relative">
                    <input type="number" value={form.low_stock_threshold ?? 5}
                      onChange={e => updateField('low_stock_threshold', parseInt(e.target.value))}
                      className={`${inputBase} pr-16`} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">unidades</span>
                  </div>
                </div>
                <div>
                  <label className={labelBase}><Palette size={12} className="inline mr-1 text-muted-foreground" /> Cor do Tema</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.theme_color || '#2563eb'}
                      onChange={e => updateField('theme_color', e.target.value)}
                      className="w-11 h-11 rounded-xl border border-border cursor-pointer p-1" />
                    <input type="text" value={form.theme_color || '#2563eb'}
                      onChange={e => updateField('theme_color', e.target.value)}
                      className={`${inputBase} font-mono text-xs max-w-30`} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECÇÃO: Políticas ── */}
          <section id="policies" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield size={15} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Políticas</h2>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={labelBase}>Política de Envio</label>
                <textarea rows={3} value={form.shipping_policy || ''}
                  onChange={e => updateField('shipping_policy', e.target.value)}
                  placeholder="Descreva prazos, métodos e custos de envio..."
                  className={textareaBase} />
              </div>
              <div>
                <label className={labelBase}>Política de Devolução</label>
                <textarea rows={3} value={form.return_policy || ''}
                  onChange={e => updateField('return_policy', e.target.value)}
                  placeholder="Condições para devoluções e reembolsos..."
                  className={textareaBase} />
              </div>
            </div>
          </section>

          {/* ── SECÇÃO: Documentos ── */}
          <section id="documents" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileText size={15} className="text-accent" />
                </div>
                <h2 className="font-semibold text-foreground">Documentos de Verificação</h2>
              </div>
            </div>
            <div className="p-6">
              {store?.identity_document || store?.tax_document || store?.address_proof || store?.additional_documents ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'identity_document', label: 'Doc. Identidade (frente)', icon: '🪪', color: 'border-primary/20 bg-primary/5 hover:bg-primary/10', hasDoc: store?.identity_document },
                    { key: 'tax_document', label: 'NUIT / Registo Comercial', icon: '🧾', color: 'border-accent/20 bg-accent/5 hover:bg-accent/10', hasDoc: store?.tax_document },
                    { key: 'address_proof', label: 'Verso do Documento / Morada', icon: '📍', color: 'border-primary/20 bg-primary/5 hover:bg-primary/10', hasDoc: store?.address_proof },
                    { key: 'additional_documents', label: 'Documentos Adicionais', icon: '📎', color: 'border-border bg-muted/30 hover:bg-muted/50', hasDoc: store?.additional_documents },
                  ].map(doc => doc.hasDoc && (
                    <div key={doc.key} className={`flex items-center justify-between p-3.5 rounded-xl border ${doc.color} transition-all duration-200 group`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg shrink-0">{doc.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">Documento enviado</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeDocument(doc.key, doc.label)}
                        className="shrink-0 ml-3 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <FileText size={20} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Nenhum documento enviado</p>
                  <p className="text-xs text-muted-foreground mt-1">O vendedor ainda não submeteu documentos de verificação.</p>
                </div>
              )}
            </div>
          </section>

          {/* ── SECÇÃO: Notas Admin ── */}
          <section id="notes" className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare size={15} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Notas Internas</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">Apenas admin</span>
              </div>
            </div>
            <div className="p-6">
              <textarea rows={3} value={form.admin_notes || ''}
                onChange={e => updateField('admin_notes', e.target.value)}
                placeholder="Notas internas visíveis apenas para administradores..."
                className={textareaBase} />
            </div>
          </section>

          {/* ── Bottom save bar ── */}
          <div className="flex items-center justify-end gap-3 pb-10">
            <Link href={`/admin/stores/${id}`}
              className="h-11 px-5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted transition-all duration-200 inline-flex items-center gap-2">
              Cancelar
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 inline-flex items-center gap-2 shadow-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar Alterações
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

