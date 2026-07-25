'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Upload, Save, ArrowLeft, X, FileText, BookOpen, Box } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Link from 'next/link';
import SellerLayout from '@/src/components/SellerLayout';
import { productsAPI } from '@/src/lib/api';

const CATEGORIES = [
  { value: 'eletronicos', label: 'Eletrônicos' },
  { value: 'moda', label: 'Moda' },
  { value: 'casa-jardim', label: 'Casa & Jardim' },
  { value: 'esportes', label: 'Esportes' },
  { value: 'livros', label: 'Livros & Papelaria' },
  { value: 'beleza', label: 'Beleza & Saúde' },
  { value: 'brinquedos', label: 'Brinquedos & Games' },
  { value: 'automotivo', label: 'Automotivo' },
];

export default function NewProductPage() {
  const router = useRouter();
  const [productType, setProductType] = useState<'physical' | 'digital' | 'course'>('physical');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', price: '', compare_price: '', category: '',
    stock: '1', sku: '', weight: '', digitalFile: null as File | null,
    instructorName: '', courseLevel: 'iniciante', courseDuration: '', courseLessons: '',
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    setImages((prev) => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');

    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('price', form.price);
      if (form.compare_price) formData.append('compare_price', form.compare_price);
      formData.append('category', form.category);
      formData.append('product_type', productType);

      if (productType === 'physical') {
        formData.append('stock', form.stock);
        if (form.sku) formData.append('sku', form.sku);
        if (form.weight) formData.append('weight', form.weight);
      } else if (productType === 'digital') {
        formData.append('stock', '999');
        if (form.digitalFile) formData.append('digital_file', form.digitalFile);
      } else if (productType === 'course') {
        formData.append('stock', '999');
        formData.append('instructor_name', form.instructorName);
        formData.append('course_level', form.courseLevel);
        formData.append('course_duration', form.courseDuration);
        formData.append('total_lessons', form.courseLessons);
      }

      images.forEach((img, i) => {
        formData.append('images', img);
      });

      await productsAPI.create(formData);
      router.push('/seller/products');
    } catch (err: any) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join('. ') : 'Erro ao criar produto.');
    } finally { setSubmitting(false); }
  };

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/seller/products" className="p-1.5 hover:bg-muted rounded-md">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Novo Produto</h1>
            <p className="text-sm text-muted-foreground">Adicione um novo produto à sua loja</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Type */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-bold mb-4">Tipo de Produto</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: 'physical' as const, icon: Box, label: 'Físico', desc: 'Com stock e envio' },
                { value: 'digital' as const, icon: FileText, label: 'Digital', desc: 'Download imediato' },
                { value: 'course' as const, icon: BookOpen, label: 'Curso', desc: 'Conteúdo educativo' },
              ]).map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.value} type="button" onClick={() => setProductType(t.value)}
                    className={`p-4 border-2 rounded-xl text-center transition-all ${
                      productType === t.value ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                    }`}>
                    <Icon size={28} className={`mx-auto mb-2 ${productType === t.value ? 'text-accent' : 'text-muted-foreground'}`} />
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Informações Básicas</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Nome do Produto *</label>
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
                <label className="block text-sm font-medium mb-1">Preço Original (opcional)</label>
                <input type="number" step="0.01" value={form.compare_price} onChange={(e) => updateField('compare_price', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria *</label>
                <select value={form.category} onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required>
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              {/* Type-specific fields */}
              {productType === 'physical' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Stock *</label>
                  <input type="number" value={form.stock} onChange={(e) => updateField('stock', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                </div>
              )}
            </div>

            {productType === 'physical' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SKU (opcional)</label>
                  <input type="text" value={form.sku} onChange={(e) => updateField('sku', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Peso (kg)</label>
                  <input type="text" value={form.weight} onChange={(e) => updateField('weight', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            )}

            {productType === 'digital' && (
              <div>
                <label className="block text-sm font-medium mb-1">Ficheiro Digital *</label>
                <input type="file" onChange={(e) => updateField('digitalFile', e.target.files?.[0] || null)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                <p className="text-xs text-muted-foreground mt-1">ZIP, PDF ou qualquer formato. Máx 100MB.</p>
              </div>
            )}

            {productType === 'course' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Instrutor *</label>
                  <input type="text" value={form.instructorName} onChange={(e) => updateField('instructorName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nível *</label>
                  <select value={form.courseLevel} onChange={(e) => updateField('courseLevel', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="iniciante">Iniciante</option>
                    <option value="intermedio">Intermédio</option>
                    <option value="avancado">Avançado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duração (ex: 20h)</label>
                  <input type="text" value={form.courseDuration} onChange={(e) => updateField('courseDuration', e.target.value)}
                    placeholder="Ex: 20h" className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nº de Aulas</label>
                  <input type="number" value={form.courseLessons} onChange={(e) => updateField('courseLessons', e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            )}
          </div>

          {/* Images */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-bold mb-4">Imagens do Produto</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square">
                  <img src={preview} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                  {i === 0 && <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">Principal</span>}
                </div>
              ))}
              <button type="button" onClick={() => imageRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center gap-1 hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
                <Upload size={20} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Adicionar</span>
              </button>
            </div>
            <input ref={imageRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
            <p className="text-xs text-muted-foreground">PNG, JPG até 5MB. A primeira imagem será a principal.</p>
          </div>

          {/* Commission */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-bold mb-2">Comissão de Afiliados</h2>
            <p className="text-sm text-muted-foreground mb-3">Percentagem que afiliados ganham ao vender este produto.</p>
            <div className="flex items-center gap-2">
              <input type="number" defaultValue="10" className="w-20 px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link href="/seller/products"
              className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </Link>
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50">
              {submitting ? <><LoadingSpinner size={16} inline /> Criando...</> : <><Save size={16} /> Criar Produto</>}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  );
}
