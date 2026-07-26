'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, X, Plus, Layers, Trash2, ImagePlus } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { productsAPI } from '@/src/lib/api';
import type { ProductDetail, ProductVariant } from '@/src/lib/api';

const CATEGORIES = [
  { value: 'eletronicos', label: 'Eletrônicos' }, { value: 'moda', label: 'Moda' },
  { value: 'casa-jardim', label: 'Casa & Jardim' }, { value: 'esportes', label: 'Esportes' },
  { value: 'livros', label: 'Livros & Papelaria' }, { value: 'beleza', label: 'Beleza & Saúde' },
  { value: 'brinquedos', label: 'Brinquedos & Games' }, { value: 'automotivo', label: 'Automotivo' },
];

const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

interface VariantDraft {
  id?: string;
  name: string;
  sku: string;
  price: string;
  stock: string;
  attributes: Record<string, string>;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
  existingImage: string | null;
  _deleted?: boolean;
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [productType, setProductType] = useState<'physical' | 'digital' | 'course'>('physical');

  const [form, setForm] = useState({
    name: '', description: '', price: '', compare_price: '', category: '',
    stock: '', sku: '', is_featured: false, is_on_sale: false,
  });

  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);

  // ─── Load product ───
  useEffect(() => {
    (async () => {
      try {
        // Fetch product by slug — but we only have the ID here. Let's use a direct fetch.
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/products/${id}/update/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Produto não encontrado');
        const data: ProductDetail = await res.json();
        setProduct(data);
        setProductType(data.product_type);
        setForm({
          name: data.name, description: data.description,
          price: String(data.price), compare_price: data.compare_price ? String(data.compare_price) : '',
          category: data.category || '', stock: String(data.stock), sku: data.sku || '',
          is_featured: false, is_on_sale: data.is_on_sale,
        });

        // Load existing variants
        try {
          const vRes = await productsAPI.listVariants(id);
          const existing: VariantDraft[] = (Array.isArray(vRes.data) ? vRes.data : []).map((v: ProductVariant) => ({
            id: v.id,
            name: v.name,
            sku: v.sku || '',
            price: v.price != null ? String(v.price) : '',
            stock: String(v.stock),
            attributes: v.attributes || {},
            is_active: v.is_active,
            imageFile: null,
            imagePreview: null,
            existingImage: v.image_url || null,
          }));
          setVariants(existing);
        } catch {}

        // Images already loaded via product.images
        if (data.images?.length) {
          setImagePreviews(data.images.map((img) =>
            img.image.startsWith('http') ? img.image : `${MEDIA_BASE}${img.image.startsWith('/') ? '' : '/'}${img.image}`
          ));
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produto.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const updateField = (f: string, v: any) => setForm((prev) => ({ ...prev, [f]: v }));

  // ─── Variant helpers ───
  const updateVariant = (idx: number, field: keyof VariantDraft, value: any) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, {
      name: '', sku: '', price: '', stock: '0', attributes: {},
      is_active: true, imageFile: null, imagePreview: null, existingImage: null,
    }]);
  };

  const removeVariant = (idx: number) => {
    setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, _deleted: true } : v));
  };

  const handleVariantImage = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateVariant(idx, 'imagePreview', reader.result as string);
    reader.readAsDataURL(file);
    updateVariant(idx, 'imageFile', file);
    updateVariant(idx, 'existingImage', null);
  };

  // ─── Image helpers ───
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    setImages((prev) => [...prev, ...files]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');

    try {
      // 1. Update product
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      if (form.compare_price) fd.append('compare_price', form.compare_price);
      fd.append('category', form.category);
      fd.append('product_type', productType);
      fd.append('stock', form.stock || '0');
      if (form.sku) fd.append('sku', form.sku);
      fd.append('is_on_sale', String(form.is_on_sale));

      images.forEach((img) => fd.append('images', img));
      await productsAPI.update(id, fd);

      // 2. Save variants
      for (const v of variants) {
        if (v._deleted && v.id) {
          await productsAPI.deleteVariant(id, v.id);
        } else if (v._deleted) {
          // Skip new variants marked for deletion
        } else if (v.id) {
          // Update existing variant
          const vData: any = {
            name: v.name, sku: v.sku,
            price: v.price ? parseFloat(v.price) : null,
            stock: parseInt(v.stock) || 0,
            attributes: v.attributes,
            is_active: v.is_active,
          };
          // For image, need multipart
          if (v.imageFile) {
            const vfd = new FormData();
            Object.entries(vData).forEach(([k, val]) => vfd.append(k, String(val ?? '')));
            vfd.append('image', v.imageFile);
            const token = localStorage.getItem('access_token');
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/products/${id}/variants/${v.id}/`, {
              method: 'PATCH',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: vfd,
            });
          } else {
            await productsAPI.updateVariant(id, v.id, vData);
          }
        } else {
          // Create new variant
          const vData: any = {
            name: v.name, sku: v.sku,
            price: v.price ? parseFloat(v.price) : null,
            stock: parseInt(v.stock) || 0,
            attributes: v.attributes,
            is_active: v.is_active,
          };
          if (v.imageFile) {
            const vfd = new FormData();
            Object.entries(vData).forEach(([k, val]) => vfd.append(k, String(val ?? '')));
            vfd.append('image', v.imageFile);
            const token = localStorage.getItem('access_token');
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/products/${id}/variants/`, {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: vfd,
            });
          } else {
            await productsAPI.createVariant(id, vData);
          }
        }
      }

      router.push('/seller/products');
    } catch (err: any) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join('. ') : 'Erro ao guardar.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={36} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  const activeVariants = variants.filter((v) => !v._deleted);

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/seller/products" className="p-1.5 hover:bg-muted rounded-md"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold">Editar Produto</h1>
            <p className="text-sm text-muted-foreground">{form.name}</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Informações Básicas</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-28 resize-none" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Preço (MZN) *</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => updateField('price', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preço Original</label>
                <input type="number" step="0.01" value={form.compare_price} onChange={(e) => updateField('compare_price', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select value={form.category} onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              {productType === 'physical' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Stock (se sem variantes)</label>
                  <input type="number" value={form.stock} onChange={(e) => updateField('stock', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
            </div>
            {productType === 'physical' && (
              <div>
                <label className="block text-sm font-medium mb-1">SKU Base</label>
                <input type="text" value={form.sku} onChange={(e) => updateField('sku', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => updateField('is_featured', e.target.checked)} className="accent-accent" /> Destaque
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_on_sale} onChange={(e) => updateField('is_on_sale', e.target.checked)} className="accent-accent" /> Em promoção
              </label>
            </div>
          </div>

          {/* Images */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-bold mb-4">Imagens</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => imageRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center gap-1 hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <Upload size={18} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Adicionar</span>
              </button>
            </div>
            <input ref={imageRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          </div>

          {/* ─── Variants Section ─── */}
          {productType === 'physical' && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-accent" />
                  <h2 className="font-bold">Variantes do Produto</h2>
                </div>
                <button type="button" onClick={addVariant}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5 transition-colors">
                  <Plus size={14} /> Adicionar Variante
                </button>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Cada variante pode ter seu próprio preço, stock, SKU e imagem. Ex: &ldquo;Azul&rdquo;, &ldquo;Vermelho / M&rdquo;.
              </p>

              {activeVariants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma variante. Clique em &ldquo;Adicionar Variante&rdquo; para começar.</p>
              )}

              {activeVariants.map((v, idx) => {
                const realIdx = variants.indexOf(v);
                return (
                  <div key={realIdx} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Variante #{idx + 1}</span>
                      <button type="button" onClick={() => removeVariant(realIdx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-0.5">Nome * (ex: Azul, M)</label>
                        <input type="text" value={v.name} onChange={(e) => updateVariant(realIdx, 'name', e.target.value)}
                          placeholder="Azul" className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-0.5">SKU</label>
                        <input type="text" value={v.sku} onChange={(e) => updateVariant(realIdx, 'sku', e.target.value)}
                          placeholder="SKU-VAR-001" className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-0.5">Preço (MZN) — vazio = usa preço base</label>
                        <input type="number" step="0.01" value={v.price} onChange={(e) => updateVariant(realIdx, 'price', e.target.value)}
                          placeholder={form.price || 'Preço base'} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-0.5">Stock</label>
                        <input type="number" value={v.stock} onChange={(e) => updateVariant(realIdx, 'stock', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>
                    {/* Variant Image */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                        {(v.imagePreview || v.existingImage) ? (
                          <img src={v.imagePreview || v.existingImage || ''} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImagePlus size={16} /></div>
                        )}
                      </div>
                      <label className="px-3 py-1.5 border border-border rounded-md text-xs cursor-pointer hover:bg-muted transition-colors">
                        {v.imagePreview || v.existingImage ? 'Trocar Imagem' : 'Adicionar Imagem'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleVariantImage(realIdx, e)} />
                      </label>
                      {(v.imagePreview || v.existingImage) && (
                        <button type="button" onClick={() => { updateVariant(realIdx, 'imagePreview', null); updateVariant(realIdx, 'existingImage', null); updateVariant(realIdx, 'imageFile', null); }}
                          className="text-xs text-red-500 hover:underline">Remover</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link href="/seller/products" className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</Link>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50">
              {saving ? <><LoadingSpinner size={16} inline /> Salvando...</> : <><Save size={16} /> Salvar Alterações</>}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  );
}
