'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Save, ArrowLeft, X, FileText, BookOpen, Box, Info, Check, ChevronRight, Plus, Layers, Trash2, ImagePlus, Shield, Download, Clock, Monitor, Users } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Link from 'next/link';
import SellerLayout from '@/src/components/SellerLayout';
import { productsAPI, storesAPI } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CategoryNode {
  name: string;
  slug: string;
  parent_slug: string | null;
  children: { name: string; slug: string }[];
}

interface VariantDraft {
  name: string;
  sku: string;
  price: string;
  stock: string;
  attributes: Record<string, string>;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
}

const TYPE_LABELS: Record<string, { title: string; subtitle: string; icon: any }> = {
  physical: { title: 'Novo Produto Fisico', subtitle: 'Adicione um produto com stock e envio', icon: Box },
  digital: { title: 'Novo Produto Digital', subtitle: 'Adicione um produto para download', icon: FileText },
  course: { title: 'Novo Curso', subtitle: 'Adicione um curso educativo', icon: BookOpen },
};

const BASE_STEPS = [
  { number: 1, label: 'Essencial', desc: 'Nome, preco e imagem' },
  { number: 2, label: 'Detalhes', desc: 'Inventario e especificacoes' },
  { number: 3, label: 'Media e SEO', desc: 'Imagens extra e metadados' },
  { number: 4, label: 'Publicar', desc: 'Visibilidade e finalizar' },
];

// ── Reusable sub-components defined at module level to avoid focus loss on re-render ──

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-foreground/80 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-muted-foreground font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Counter({ current, max }: { current: number; max: number }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-0.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{current}/{max}</span>
    </div>
  );
}

// ── Main component ──

export default function NewProductPage() {
  const router = useRouter();
  const [productType, setProductType] = useState<'physical' | 'digital' | 'course'>('physical');
  const [loadingType, setLoadingType] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: '', description: '', short_description: '', price: '', compare_price: '', category: '',
    // Inventory
    stock: '1', sku: '', barcode: '', brand: '', condition: 'new',
    weight: '', height: '', width: '', length: '',
    allow_backorder: false, min_order_quantity: '1',
    // SEO & Tags
    meta_title: '', meta_description: '', tags: '',
    // Media
    video_url: '',
    // Toggles
    is_active: true, is_featured: false, is_on_sale: false,
    // Extra
    warranty_days: '0', commission: '10',
    // Afiliação
    affiliate_enabled: true, affiliate_cookie_days: '', affiliate_terms: '',
    // Type-specific — Digital
    digitalFile: null as File | null,
    digitalFormat: '',           // PDF, ZIP, MP3, MP4, etc.
    digitalVersion: '',          // v1.0, 2026 Edition
    digitalLicense: 'personal',  // personal, commercial, extended
    downloadLimit: '3',          // default 3
    downloadExpiry: '365',       // default 365 days
    digitalCompatibility: '',    // OS/software requirements
    // Type-specific — Course
    instructorName: '', courseLevel: 'iniciante', courseDuration: '', courseLessons: '',
    accessDurationDays: '',  // vazio = vitalício
  });

  const [mainImage, setMainImage] = useState<File | null>(null);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<File[]>([]);
  const [thumbnailPreviews, setThumbnailPreviews] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  const mainRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  // Load store's product type and categories on mount
  useEffect(() => {
    (async () => {
      let storeType = 'physical';
      try {
        const { data } = await storesAPI.myStore();
        storeType = data.product_type || 'physical';
        setProductType(storeType as 'physical' | 'digital' | 'course');
      } catch {} finally { setLoadingType(false); }

      // Fetch categories filtered by store type
      try {
        const res = await fetch(`${API_URL}/categories/?root=true&product_type=${storeType}`);
        const data = await res.json();
        if (data.results?.length) {
          setCategories(data.results);
        } else {
          // Fallback: fetch all if none match the type
          const fallback = await fetch(`${API_URL}/categories/?root=true`);
          const fbData = await fallback.json();
          setCategories(fbData.results || []);
        }
      } catch {}
    })();
  }, []);

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleMainImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setMainPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnails = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setThumbnailPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    setThumbnails((prev) => [...prev, ...files]);
  };

  const removeThumbnail = (index: number) => {
    setThumbnails((prev) => prev.filter((_, i) => i !== index));
    setThumbnailPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Variant helpers ───
  const updateVariant = (idx: number, field: keyof VariantDraft, value: any) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  };

  const updateVariantAttr = (idx: number, attrKey: string, value: string) => {
    setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, attributes: { ...v.attributes, [attrKey]: value } } : v));
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, {
      name: '', sku: '', price: '', stock: '0', attributes: {},
      is_active: true, imageFile: null, imagePreview: null,
    }]);
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleVariantImage = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateVariant(idx, 'imagePreview', reader.result as string);
    reader.readAsDataURL(file);
    updateVariant(idx, 'imageFile', file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Step navigation — validate required fields before proceeding
    if (step === 1 && (!form.name || !form.price || !form.category)) {
      setError('Preencha nome, preco e categoria antes de continuar.');
      return;
    }
    if (step === 2 && productType === 'physical' && !form.stock) {
      setError('Preencha o stock antes de continuar.');
      return;
    }

    if (step < 4) {
      setStep(step + 1);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Final submit
    setSubmitting(true); setError('');

    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      if (form.short_description) formData.append('short_description', form.short_description);
      formData.append('price', form.price);
      if (form.compare_price) formData.append('compare_price', form.compare_price);
      formData.append('category', form.category);
      formData.append('product_type', productType);
      formData.append('affiliate_commission', form.commission);
      formData.append('affiliate_enabled', String(form.affiliate_enabled));
      if (form.affiliate_cookie_days) formData.append('affiliate_cookie_days', form.affiliate_cookie_days);
      if (form.affiliate_terms) formData.append('affiliate_terms', form.affiliate_terms);

      // Toggles
      formData.append('status', form.is_active ? 'active' : 'draft');
      formData.append('is_featured', String(form.is_featured));
      formData.append('is_on_sale', String(form.is_on_sale));

      // SEO & Tags
      if (form.meta_title) formData.append('meta_title', form.meta_title);
      if (form.meta_description) formData.append('meta_description', form.meta_description);
      if (form.tags) formData.append('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)));

      if (productType === 'physical') {
        formData.append('stock', form.stock);
        if (form.sku) formData.append('sku', form.sku);
        if (form.barcode) formData.append('barcode', form.barcode);
        if (form.brand) formData.append('brand', form.brand);
        formData.append('condition', form.condition);
        if (form.weight) formData.append('weight', form.weight);
        if (form.height) formData.append('height', form.height);
        if (form.width) formData.append('width', form.width);
        if (form.length) formData.append('length', form.length);
        formData.append('allow_backorder', String(form.allow_backorder));
        formData.append('min_order_quantity', form.min_order_quantity);
        if (form.warranty_days) formData.append('warranty_days', form.warranty_days);
      } else if (productType === 'digital') {
        formData.append('stock', '999');
        if (form.digitalFile) formData.append('digital_file', form.digitalFile);
        if (form.digitalFormat) formData.append('digital_file_format', form.digitalFormat);
        if (form.digitalVersion) formData.append('digital_version', form.digitalVersion);
        formData.append('digital_license', form.digitalLicense);
        formData.append('download_limit', form.downloadLimit);
        formData.append('download_expiry_days', form.downloadExpiry);
        if (form.digitalCompatibility) formData.append('digital_compatibility', form.digitalCompatibility);
      } else if (productType === 'course') {
        formData.append('stock', '999');
        formData.append('instructor_name', form.instructorName);
        formData.append('course_level', form.courseLevel);
        formData.append('course_duration', form.courseDuration);
        formData.append('total_lessons', form.courseLessons);
        if (form.accessDurationDays) {
          formData.append('access_duration_days', form.accessDurationDays);
        }
      }

      // Images are NOT sent with product creation — the backend ignores them (images field is read_only).
      // They must be uploaded separately via /products/<id>/images/

      const product = await productsAPI.create(formData);
      const productId = product.data.id;

      // Upload main image (primary) — uses fetch directly to let browser set multipart boundary
      if (mainImage) {
        const imgFd = new FormData();
        imgFd.append('image', mainImage);
        imgFd.append('is_primary', 'true');
        const token = localStorage.getItem('access_token');
        await fetch(`${API_URL}/products/${productId}/images/`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: imgFd,
        });
      }

      // Upload thumbnails one by one
      for (const thumb of thumbnails) {
        const imgFd = new FormData();
        imgFd.append('image', thumb);
        imgFd.append('is_primary', 'false');
        const token = localStorage.getItem('access_token');
        await fetch(`${API_URL}/products/${productId}/images/`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: imgFd,
        });
      }

      // Create variants (if any)
      for (const v of variants) {
        if (!v.name.trim()) continue; // skip empty variants
        const vData: Record<string, any> = {
          name: v.name,
          sku: v.sku || '',
          stock: parseInt(v.stock) || 0,
          attributes: v.attributes,
          is_active: v.is_active,
        };
        if (v.price) vData.price = parseFloat(v.price);

        if (v.imageFile) {
          const vfd = new FormData();
          Object.entries(vData).forEach(([k, val]) => {
            if (val !== null && val !== undefined) vfd.append(k, String(val));
          });
          vfd.append('image', v.imageFile);
          const token = localStorage.getItem('access_token');
          await fetch(`${API_URL}/products/${productId}/variants/`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: vfd,
          });
        } else {
          await productsAPI.createVariant(productId, vData);
        }
      }

      // Redirect: courses go to builder, others go to product list
      if (productType === 'course' && product.data.course?.course_id) {
        router.push(`/seller/courses/${product.data.course.course_id}/builder`);
      } else {
        router.push('/seller/products');
      }
    } catch (err: any) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join('. ') : 'Erro ao criar produto.');
    } finally { setSubmitting(false); }
  };

  if (loadingType) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  const typeInfo = TYPE_LABELS[productType] || TYPE_LABELS.physical;
  const TypeIcon = typeInfo.icon;

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/seller/products" className="p-1.5 hover:bg-muted rounded-md"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><TypeIcon size={24} className="text-accent" />{typeInfo.title}</h1>
            <p className="text-sm text-muted-foreground">{typeInfo.subtitle}</p>
          </div>
        </div>

        {/* Steps Timeline */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 overflow-x-auto pb-2">
          {BASE_STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s.number ? 'bg-green-500 text-white' :
                step === s.number ? 'bg-accent text-accent-foreground ring-2 ring-accent/30' :
                'bg-muted text-muted-foreground'
              }`}>
                {step > s.number ? <Check size={14} /> : s.number}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-medium leading-tight ${step === s.number ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
              </div>
              {i < BASE_STEPS.length - 1 && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <Info size={14} className="shrink-0" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="bg-card border border-border rounded-xl p-5 md:p-8 space-y-5">

            {/* ─── STEP 1: Essencial ─── */}
            {step === 1 && (
              <>
                <h2 className="text-lg font-bold">Informacoes Essenciais</h2>
                <p className="text-sm text-muted-foreground -mt-3">Os campos marcados com * sao obrigatorios.</p>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-3 space-y-4">
                    <Field label="Nome do Produto" required hint="Maximo 200 caracteres">
                      <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} maxLength={200}
                        placeholder={
                          productType === 'physical' ? 'Ex: Smartphone Galaxy S25 256GB' :
                          productType === 'digital' ? 'Ex: Pacote de Templates para Instagram' :
                          'Ex: Curso de Python para Iniciantes'
                        }
                        className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                      <Counter current={form.name.length} max={200} />
                    </Field>
                    <Field label="Descricao Curta" hint="Aparece nos cards de listagem">
                      <textarea value={form.short_description} onChange={(e) => updateField('short_description', e.target.value)} maxLength={300}
                        placeholder={
                          productType === 'physical' ? 'Resumo atrativo do produto em 1-2 frases...' :
                          productType === 'digital' ? 'Destaque o que o comprador vai receber: inclui ficheiros editaveis? licenca comercial?' :
                          'Resuma o que o aluno vai aprender neste curso...'
                        }
                        className="w-full px-4 py-3 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none resize-none h-14 text-sm" />
                      <Counter current={form.short_description.length} max={300} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Preco (MZN)" required>
                        <input type="number" step="0.01" value={form.price} onChange={(e) => updateField('price', e.target.value)}
                          placeholder="0.00" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                      </Field>
                      <Field label="Preco Original" hint="Para promocao">
                        <input type="number" step="0.01" value={form.compare_price} onChange={(e) => updateField('compare_price', e.target.value)}
                          placeholder="Opcional" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                      </Field>
                    </div>
                    <Field label="Categoria" required>
                      <select value={form.category} onChange={(e) => updateField('category', e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none">
                        <option value="">Selecionar...</option>
                        {categories.map((cat) => (
                          <optgroup key={cat.slug} label={cat.name}>
                            <option value={cat.slug}>{cat.name}</option>
                            {cat.children?.map((sub) => (<option key={sub.slug} value={sub.slug}>— {sub.name}</option>))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Imagem Principal" required>
                      {mainPreview ? (
                        <div className="relative group rounded-xl overflow-hidden border aspect-square bg-muted/30">
                          <img src={mainPreview} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => { setMainImage(null); setMainPreview(null); }}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">Principal</span>
                        </div>
                      ) : (
                        <button type="button" onClick={() => mainRef.current?.click()}
                          className="w-full aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-accent hover:bg-accent/2 transition-colors cursor-pointer text-muted-foreground">
                          <Upload size={32} className="opacity-30" />
                          <span className="text-sm font-medium">Clique para adicionar</span>
                          <span className="text-xs opacity-50">PNG, JPG, WebP</span>
                        </button>
                      )}
                      <input ref={mainRef} type="file" accept="image/*" onChange={handleMainImage} className="hidden" />
                    </Field>
                  </div>
                </div>
                <Field label="Descricao Completa" required>
                  <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)}
                    placeholder={
                      productType === 'physical'
                        ? 'Descreva o produto em detalhe: caracteristicas, beneficios, o que esta incluido na caixa...'
                        : productType === 'digital'
                        ? 'Descreva o produto digital em detalhe: o que contem, como usar, formatos incluidos, exemplos de uso...'
                        : 'Descreva o curso: topicos abordados, metodologia, pre-requisitos, o que o aluno vai aprender...'
                    }
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none resize-none h-28 text-sm" />
                </Field>
              </>
            )}

            {/* ─── STEP 2: Detalhes (physical) ─── */}
            {step === 2 && productType === 'physical' && (
              <>
                <h2 className="text-lg font-bold">Inventario e Detalhes</h2>
                <p className="text-sm text-muted-foreground -mt-3">Informacoes de stock, dimensoes e identificacao do produto.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="SKU"><input type="text" value={form.sku} onChange={(e) => updateField('sku', e.target.value)} placeholder="SKU-001" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Codigo de Barras" hint="GTIN/EAN"><input type="text" value={form.barcode} onChange={(e) => updateField('barcode', e.target.value)} placeholder="7891234567890" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Marca"><input type="text" value={form.brand} onChange={(e) => updateField('brand', e.target.value)} placeholder="Samsung, Nike..." className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Condicao">
                    <select value={form.condition} onChange={(e) => updateField('condition', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none">
                      <option value="new">Novo</option><option value="used">Usado</option><option value="refurbished">Recondicionado</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Peso (kg)"><input type="number" step="0.001" value={form.weight} onChange={(e) => updateField('weight', e.target.value)} placeholder="0.5" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Altura (cm)"><input type="number" step="0.01" value={form.height} onChange={(e) => updateField('height', e.target.value)} placeholder="10" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Largura (cm)"><input type="number" step="0.01" value={form.width} onChange={(e) => updateField('width', e.target.value)} placeholder="5" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Comprimento (cm)"><input type="number" step="0.01" value={form.length} onChange={(e) => updateField('length', e.target.value)} placeholder="15" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Stock" required><input type="number" value={form.stock} onChange={(e) => updateField('stock', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Qtd. Minima" hint="Por encomenda"><input type="number" min="1" value={form.min_order_quantity} onChange={(e) => updateField('min_order_quantity', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Garantia" hint="Dias"><input type="number" min="0" value={form.warranty_days} onChange={(e) => updateField('warranty_days', e.target.value)} placeholder="0 = sem" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Comissao Afiliados" hint="%"><input type="number" value={form.commission} onChange={(e) => updateField('commission', e.target.value)} min="0" max="100" step="0.5" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.allow_backorder} onChange={(e) => updateField('allow_backorder', e.target.checked)} className="accent-accent rounded w-4 h-4" />
                  <span className="text-muted-foreground">Permitir venda sem stock (backorder)</span>
                </label>

                {/* ─── Variants: Cores & Tamanhos ─── */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2"><Layers size={16} className="text-accent" />Cores e Variantes</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Adicione opcoes de cor, tamanho ou outras variantes do produto.</p>
                    </div>
                    <button type="button" onClick={addVariant}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors">
                      <Plus size={14} /> Adicionar Variante
                    </button>
                  </div>

                  {variants.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                      Nenhuma variante adicionada. Clique em "Adicionar Variante" para comecar.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {variants.map((v, idx) => (
                        <div key={idx} className="border border-border rounded-lg p-3 bg-muted/20 relative">
                          <button type="button" onClick={() => removeVariant(idx)}
                            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                            <div>
                              <label className="block text-[10px] font-medium mb-0.5 text-muted-foreground">Nome *</label>
                              <input type="text" value={v.name} onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                                placeholder="Ex: Azul / M"
                                className="w-full px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-0.5 text-muted-foreground">SKU</label>
                              <input type="text" value={v.sku} onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                                placeholder="SKU-VAR-001"
                                className="w-full px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-0.5 text-muted-foreground">Preco (opcional)</label>
                              <input type="number" step="0.01" value={v.price} onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                                placeholder="Usa preco base"
                                className="w-full px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-0.5 text-muted-foreground">Stock</label>
                              <input type="number" value={v.stock} onChange={(e) => updateVariant(idx, 'stock', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs" />
                            </div>
                          </div>

                          {/* Attributes: Cor, Tamanho */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <label className="block text-[10px] font-medium mb-0.5 text-muted-foreground">Cor</label>
                              <input type="text" value={v.attributes['Cor'] || ''} onChange={(e) => updateVariantAttr(idx, 'Cor', e.target.value)}
                                placeholder="Ex: Azul, Vermelho..."
                                className="w-full px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-0.5 text-muted-foreground">Tamanho</label>
                              <input type="text" value={v.attributes['Tamanho'] || ''} onChange={(e) => updateVariantAttr(idx, 'Tamanho', e.target.value)}
                                placeholder="Ex: M, G, GG..."
                                className="w-full px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs" />
                            </div>
                          </div>

                          {/* Variant Image */}
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 px-2 py-1 border border-border rounded-md text-[10px] text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
                              <ImagePlus size={12} />
                              {v.imagePreview ? 'Trocar Imagem' : 'Imagem da Variante'}
                              <input type="file" accept="image/*" onChange={(e) => handleVariantImage(idx, e)} className="hidden" />
                            </label>
                            {v.imagePreview && (
                              <div className="relative w-8 h-8 rounded overflow-hidden border">
                                <img src={v.imagePreview} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* STEP 2: Digital — Ficheiro, Licenciamento e Detalhes */}
            {step === 2 && productType === 'digital' && (
              <>
                <h2 className="text-lg font-bold flex items-center gap-2"><Download size={18} className="text-accent" /> Ficheiro Digital e Licenciamento</h2>
                <p className="text-sm text-muted-foreground -mt-3">Configure o ficheiro, tipo de licenca e politica de downloads.</p>

                {/* ── Upload do Ficheiro ── */}
                <div className="p-4 border-2 border-dashed border-border rounded-xl bg-muted/10">
                  <Field label="Ficheiro do Produto" required hint="ZIP, PDF, MP3, MP4 ou qualquer formato">
                    <input type="file" onChange={(e) => updateField('digitalFile', e.target.files?.[0] || null)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                  </Field>
                  {form.digitalFile && (
                    <p className="text-xs text-accent mt-1.5 flex items-center gap-1">
                      <Check size={12} /> {form.digitalFile.name} ({(form.digitalFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5">Maximo 100MB. Formatos aceites: PDF, ZIP, MP3, MP4, PNG, JPG, DOCX, XLSX, PPTX e outros.</p>
                </div>

                {/* ── Detalhes do Produto Digital ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Formato / Tipo" required hint="PDF, ZIP, MP3...">
                    <select value={form.digitalFormat} onChange={(e) => updateField('digitalFormat', e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none">
                      <option value="">Selecionar...</option>
                      <option value="PDF">📄 PDF — Documento</option>
                      <option value="ZIP">📦 ZIP — Arquivo Compactado</option>
                      <option value="MP3">🎵 MP3 — Áudio / Música</option>
                      <option value="MP4">🎬 MP4 — Vídeo</option>
                      <option value="PNG">🖼️ PNG — Imagem</option>
                      <option value="JPG">🖼️ JPG — Imagem</option>
                      <option value="DOCX">📝 DOCX — Word</option>
                      <option value="XLSX">📊 XLSX — Excel / Planilha</option>
                      <option value="PPTX">📽️ PPTX — Apresentação</option>
                      <option value="EPUB">📖 EPUB — Ebook</option>
                      <option value="MOBI">📖 MOBI — Kindle</option>
                      <option value="SVG">🎨 SVG — Vector</option>
                      <option value="PSD">🎨 PSD — Photoshop</option>
                      <option value="AI">🎨 AI — Illustrator</option>
                      <option value="OUTRO">📎 Outro</option>
                    </select>
                  </Field>
                  <Field label="Versao" hint="Ex: v1.0, 2026 Edition">
                    <input type="text" value={form.digitalVersion} onChange={(e) => updateField('digitalVersion', e.target.value)}
                      placeholder="v1.0"
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                  </Field>
                  <Field label="Licenca" required>
                    <select value={form.digitalLicense} onChange={(e) => updateField('digitalLicense', e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none">
                      <option value="personal">👤 Pessoal — Uso individual</option>
                      <option value="commercial">🏢 Comercial — Uso empresarial</option>
                      <option value="extended">🌐 Extended — Revenda / SaaS</option>
                    </select>
                  </Field>
                </div>

                {/* ── Política de Downloads ── */}
                <div className="p-4 border border-border rounded-xl bg-muted/5 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Shield size={15} className="text-accent" /> Politica de Downloads</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Limite de Downloads" hint="Quantas vezes pode baixar">
                      <input type="number" min="1" max="999" value={form.downloadLimit} onChange={(e) => updateField('downloadLimit', e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                    </Field>
                    <Field label="Expiracao do Link" hint="Em dias (0 = nunca)">
                      <input type="number" min="0" max="3650" value={form.downloadExpiry} onChange={(e) => updateField('downloadExpiry', e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={13} />
                    <span>
                      {form.downloadExpiry === '0'
                        ? 'Link de download nunca expira.'
                        : `O comprador tera ${form.downloadExpiry} dias para baixar o ficheiro apos a compra.`}
                      {' '}Pode baixar ate {form.downloadLimit} vez(es).
                    </span>
                  </div>
                </div>

                {/* ── Compatibilidade ── */}
                <Field label="Compatibilidade / Requisitos" hint="SO, software necessario">
                  <div className="relative">
                    <Monitor size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={form.digitalCompatibility} onChange={(e) => updateField('digitalCompatibility', e.target.value)}
                      placeholder="Ex: Requer Windows 10+ e Adobe Photoshop CC 2024+"
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                  </div>
                </Field>
              </>
            )}
            {step === 2 && productType === 'course' && (
              <>
                <h2 className="text-lg font-bold flex items-center gap-2"><BookOpen size={18} className="text-accent" /> Detalhes do Curso</h2>
                <p className="text-sm text-muted-foreground -mt-3">Configure o instrutor, nivel, duracao e estrutura do curso.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Instrutor" required><input type="text" value={form.instructorName} onChange={(e) => updateField('instructorName', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Nivel" required><select value={form.courseLevel} onChange={(e) => updateField('courseLevel', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none"><option value="iniciante">Iniciante</option><option value="intermedio">Intermedio</option><option value="avancado">Avancado</option></select></Field>
                  <Field label="Duracao"><input type="text" value={form.courseDuration} onChange={(e) => updateField('courseDuration', e.target.value)} placeholder="Ex: 20h" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                  <Field label="Numero de Aulas"><input type="number" value={form.courseLessons} onChange={(e) => updateField('courseLessons', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                </div>
                <div className="mt-4">
                  <Field label="Vitalidade (dias de acesso)" hint="Deixe vazio para acesso vitalicio.">
                    <input type="number" value={form.accessDurationDays} onChange={(e) => updateField('accessDurationDays', e.target.value)}
                      placeholder="Ex: 30, 90, 365" min="1"
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                  </Field>
                </div>
              </>
            )}

            {/* ─── STEP 3: Media & SEO ─── */}
            {step === 3 && (
              <>
                <h2 className="text-lg font-bold">
                  {productType === 'course' ? 'Video Promocional e SEO' : productType === 'digital' ? 'Screenshots e Pre-visualizacao' : 'Media Adicional'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-2">
                      {productType === 'digital' ? 'Screenshots do Produto' : 'Miniaturas'}
                      <span className="text-muted-foreground font-normal"> — Ilimitadas</span>
                    </label>
                    {productType === 'digital' && thumbnailPreviews.length === 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Mostre o aspecto do seu produto digital. Screenshots ajudam o comprador a decidir.
                      </p>
                    )}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {thumbnailPreviews.map((preview, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square bg-muted/30">
                          <img src={preview} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeThumbnail(i)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => thumbRef.current?.click()}
                        className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center gap-0.5 hover:border-accent hover:bg-accent/2 transition-colors cursor-pointer text-muted-foreground">
                        <Upload size={14} className="opacity-40" /><span className="text-[9px]">Adicionar</span>
                      </button>
                    </div>
                    <input ref={thumbRef} type="file" accept="image/*" multiple onChange={handleThumbnails} className="hidden" />
                  </div>
                  <Field label="Video do Produto" hint="YouTube ou Vimeo">
                    <input type="url" value={form.video_url} onChange={(e) => updateField('video_url', e.target.value)}
                      placeholder={
                        productType === 'physical' ? 'https://www.youtube.com/watch?v=...' :
                        productType === 'digital' ? 'https://www.youtube.com/watch?v=... (demo ou preview)' :
                        'https://www.youtube.com/watch?v=... (aula introdutoria)'
                      }
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                  </Field>
                </div>

                <h2 className="text-lg font-bold pt-2">SEO e Metadados</h2>
                <p className="text-sm text-muted-foreground -mt-3">Opcional — usamos valores padrao se deixar vazio.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Meta Titulo" hint="Ate 60 caracteres">
                    <input type="text" value={form.meta_title} onChange={(e) => updateField('meta_title', e.target.value)} maxLength={60}
                      placeholder={form.name?.slice(0, 60) || 'Titulo para motores de busca...'}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                    <Counter current={form.meta_title.length} max={60} />
                  </Field>
                  <Field label="Meta Descricao" hint="Ate 160 caracteres">
                    <input type="text" value={form.meta_description} onChange={(e) => updateField('meta_description', e.target.value)} maxLength={160}
                      placeholder={form.description?.slice(0, 160) || 'Descricao para motores de busca...'}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                    <Counter current={form.meta_description.length} max={160} />
                  </Field>
                </div>
                <Field label="Palavras-chave" hint="Separadas por virgula">
                  <input type="text" value={form.tags} onChange={(e) => updateField('tags', e.target.value)}
                    placeholder={
                      productType === 'physical' ? 'smartphone, android, 5g, samsung' :
                      productType === 'digital' ? 'template, design, download, editavel, pack' :
                      'python, programacao, iniciante, online'
                    }
                    className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" />
                </Field>
              </>
            )}

            {/* ─── STEP 4: Visibilidade ─── */}
            {step === 4 && (
              <>
                <h2 className="text-lg font-bold">Visibilidade e Publicacao</h2>
                <p className="text-sm text-muted-foreground -mt-3">
                  {productType === 'physical'
                    ? 'Configure como e onde o produto aparece no site.'
                    : productType === 'digital'
                    ? 'O produto digital ficara disponivel para download imediato apos a compra.'
                    : 'Configure a visibilidade do seu curso no catalogo.'
                  }
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'is_active', label: 'Produto Activo', desc: 'Disponivel para venda no site', checked: form.is_active },
                    { key: 'is_featured', label: 'Destaque na Loja', desc: 'Aparece em destaque na página da sua loja', checked: form.is_featured },
                    { key: 'is_on_sale', label: 'Em Promocao', desc: 'Badge de desconto visivel', checked: form.is_on_sale },
                  ].map((t) => (
                    <label key={t.key} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${t.checked ? 'border-accent bg-accent/3' : 'border-border hover:bg-muted/20'}`}>
                      <input type="checkbox" checked={t.checked} onChange={(e) => updateField(t.key, e.target.checked)}
                        className="accent-accent rounded w-4 h-4 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* ─── Afiliação ─── */}
                <div className="mt-4">
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${form.affiliate_enabled ? 'border-accent bg-accent/3' : 'border-border hover:bg-muted/20'}`}>
                    <input type="checkbox" checked={form.affiliate_enabled} onChange={(e) => updateField('affiliate_enabled', e.target.checked)}
                      className="accent-accent rounded w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Disponível para Afiliados</p>
                      <p className="text-[11px] text-muted-foreground">Permitir que afiliados promovam este produto e ganhem comissão</p>
                    </div>
                  </label>
                  {form.affiliate_enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                      <Field label="Comissão" hint="%"><input type="number" value={form.commission} onChange={(e) => updateField('commission', e.target.value)} min="0" max="100" step="0.5" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                      <Field label="Janela de Cookie" hint="dias (vazio = global)"><input type="number" min="0" value={form.affiliate_cookie_days} onChange={(e) => updateField('affiliate_cookie_days', e.target.value)} placeholder="Ex: 30" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                      <Field label="Termos" hint="opcional"><input type="text" value={form.affiliate_terms} onChange={(e) => updateField('affiliate_terms', e.target.value)} placeholder="Ex: não acumulável com cupões" className="w-full h-11 px-4 rounded-xl border border-border bg-card placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none" /></Field>
                    </div>
                  )}
                </div>

                {/* Resumo */}
                <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo do Produto</p>
                  <p className="text-sm"><span className="text-muted-foreground">Tipo:</span> {typeInfo.title}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Nome:</span> {form.name || '—'}</p>
                  {form.short_description && <p className="text-sm"><span className="text-muted-foreground">Desc. Curta:</span> {form.short_description.slice(0, 80)}{form.short_description.length > 80 ? '...' : ''}</p>}
                  <p className="text-sm"><span className="text-muted-foreground">Preco:</span> {form.price ? `${Number(form.price).toLocaleString('pt-MZ')} MZN` : '—'}</p>
                  {form.compare_price && <p className="text-sm"><span className="text-muted-foreground">Preco Original:</span> {Number(form.compare_price).toLocaleString('pt-MZ')} MZN</p>}
                  <p className="text-sm"><span className="text-muted-foreground">Categoria:</span> {form.category || '—'}</p>
                  {productType === 'physical' && (
                    <>
                      <p className="text-sm"><span className="text-muted-foreground">Stock:</span> {form.stock} unidades</p>
                      {form.sku && <p className="text-sm"><span className="text-muted-foreground">SKU:</span> {form.sku}</p>}
                      {form.barcode && <p className="text-sm"><span className="text-muted-foreground">Cod. Barras:</span> {form.barcode}</p>}
                      {form.brand && <p className="text-sm"><span className="text-muted-foreground">Marca:</span> {form.brand}</p>}
                      <p className="text-sm"><span className="text-muted-foreground">Condicao:</span> {{new:'Novo',used:'Usado',refurbished:'Recondicionado'}[form.condition]}</p>
                      {(form.weight || form.height || form.width || form.length) && (
                        <p className="text-sm"><span className="text-muted-foreground">Dimensoes:</span> {[form.weight && `${form.weight}kg`, form.height && `${form.height}cm(A)`, form.width && `${form.width}cm(L)`, form.length && `${form.length}cm(C)`].filter(Boolean).join(' × ') || '—'}</p>
                      )}
                      {form.warranty_days && form.warranty_days !== '0' && <p className="text-sm"><span className="text-muted-foreground">Garantia:</span> {form.warranty_days} dias</p>}
                      {variants.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Variantes:</span> {variants.length} opcao(oes)</p>}
                    </>
                  )}
                  {productType === 'digital' && (
                    <>
                      {form.digitalFile && <p className="text-sm"><span className="text-muted-foreground">Ficheiro:</span> {form.digitalFile.name}</p>}
                      {form.digitalFormat && <p className="text-sm"><span className="text-muted-foreground">Formato:</span> {form.digitalFormat}</p>}
                      {form.digitalVersion && <p className="text-sm"><span className="text-muted-foreground">Versao:</span> {form.digitalVersion}</p>}
                      <p className="text-sm"><span className="text-muted-foreground">Licenca:</span> {{personal:'👤 Pessoal',commercial:'🏢 Comercial',extended:'🌐 Extended'}[form.digitalLicense]}</p>
                      <p className="text-sm"><span className="text-muted-foreground">Downloads:</span> ate {form.downloadLimit} vez(es){form.downloadExpiry !== '0' ? ` em ${form.downloadExpiry} dias` : ', sem expirar'}</p>
                      {form.digitalCompatibility && <p className="text-sm"><span className="text-muted-foreground">Compatibilidade:</span> {form.digitalCompatibility}</p>}
                    </>
                  )}
                  {productType === 'course' && (
                    <>
                      {form.instructorName && <p className="text-sm"><span className="text-muted-foreground">Instrutor:</span> {form.instructorName}</p>}
                      <p className="text-sm"><span className="text-muted-foreground">Nivel:</span> {{iniciante:'Iniciante',intermedio:'Intermedio',avancado:'Avancado'}[form.courseLevel]}</p>
                      {form.courseDuration && <p className="text-sm"><span className="text-muted-foreground">Duracao:</span> {form.courseDuration}</p>}
                      {form.courseLessons && <p className="text-sm"><span className="text-muted-foreground">Aulas:</span> {form.courseLessons}</p>}
                      <p className="text-sm"><span className="text-muted-foreground">Acesso:</span> {form.accessDurationDays ? `${form.accessDurationDays} dias` : 'Vitalicio'}</p>
                    </>
                  )}
                  <p className="text-sm"><span className="text-muted-foreground">Afiliacao:</span> {form.affiliate_enabled ? `Sim — ${form.commission}%` : 'Desactivada'}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Imagens:</span> {mainImage ? '1 principal' : '0'}{thumbnailPreviews.length > 0 ? ` + ${thumbnailPreviews.length} miniaturas` : ''}</p>
                  {form.video_url && <p className="text-sm"><span className="text-muted-foreground">Video:</span> {form.video_url}</p>}
                  {form.tags && <p className="text-sm"><span className="text-muted-foreground">Tags:</span> {form.tags}</p>}
                  <div className="flex gap-3 pt-1">
                    {form.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Activo</span>}
                    {form.is_featured && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Destaque</span>}
                    {form.is_on_sale && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Em Promocao</span>}
                  </div>
                </div>
              </>
            )}

            {/* ─── Navigation Buttons ─── */}
            <div className="flex justify-between pt-4 border-t border-border">
              <div>
                {step > 1 && (
                  <button type="button" onClick={() => { setStep(step - 1); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                    Voltar
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <Link href="/seller/products" className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancelar</Link>
                {step < 4 ? (
                  <button type="submit"
                    className="px-5 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
                    Continuar <ChevronRight size={14} />
                  </button>
                ) : (
                  <button type="submit" disabled={submitting}
                    className="px-5 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
                    {submitting ? <><LoadingSpinner size={14} inline /> A publicar...</> : <><Save size={14} /> Publicar Produto</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

      </div>
    </SellerLayout>
  );
}
