'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import AdminLayout from '@/src/components/admin/AdminLayout';
import { adminAPI } from '@/src/lib/api';
import { useAuth } from '@/src/hooks/useAuth';

type ProductType = 'physical' | 'digital' | 'course';
type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  product_type: ProductType;
  status: string;
  price: string | number;
  stock: number;
  category: string | null;
  category_name: string;
  images: { id: string; image: string; is_primary: boolean; alt_text: string }[];
  course: {
    level: string;
    duration: string;
    total_lessons: number;
    access_duration_days: number | null;
  } | null;
  [key: string]: any;
};

type CategoryOption = { id: string; name: string; slug: string };

const TYPE_LABELS: Record<ProductType, string> = {
  physical: 'Produto físico',
  digital: 'Produto digital',
  course: 'Curso',
};

const EMPTY_FORM = {
  name: '', slug: '', description: '', short_description: '', price: '', compare_price: '',
  category: '', status: 'draft', stock: '0', sku: '', barcode: '', brand: '',
  condition: 'new', weight: '', height: '', width: '', length: '',
  digital_format: '', digital_version: '', digital_license: 'personal',
  digital_compatibility: '', download_limit: '3', download_expiry_days: '365',
  course_level: 'beginner', course_duration: '', total_lessons: '0',
  access_duration_days: '', video_url: '', meta_title: '', meta_description: '',
  is_featured: false, is_on_sale: false, allow_backorder: false,
};

function getErrorMessage(error: any): string {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const firstError = Object.values(data).flat().find((value) => typeof value === 'string');
    if (typeof firstError === 'string') return firstError;
  }
  return 'Ocorreu um erro ao processar o pedido.';
}

export default function AdminStoreProductsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [digitalFile, setDigitalFile] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);

  const loadProducts = useCallback(async (requestedPage = 1) => {
    const { data } = await adminAPI.storeProducts(id, { page_size: 100, page: requestedPage });
    const items: StoreProduct[] = Array.isArray(data) ? data : data.results || [];
    setProducts(items);
    setProductCount(Array.isArray(data) ? data.length : data.count || 0);
    setPage(requestedPage);
    return items;
  }, [id]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    if (!isAuthenticated || !isAdmin) return;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: storeData } = await adminAPI.getStore(id);
        setStore(storeData);
        const { data: categoryData } = await adminAPI.storeProductCategories(storeData.product_type);
        setCategories(Array.isArray(categoryData) ? categoryData : categoryData.results || []);
        await loadProducts(1);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isAuthenticated, isAdmin, authLoading, router, loadProducts]);

  const productType = (editing?.product_type || store?.product_type || 'physical') as ProductType;
  const pageCount = Math.max(1, Math.ceil(productCount / 100));

  const startCreate = () => {
    setEditing(null);
    setDigitalFile(null);
    setProductImage(null);
    setForm({ ...EMPTY_FORM });
    setError('');
  };

  const startEdit = (product: StoreProduct) => {
    setEditing(product);
    setDigitalFile(null);
    setProductImage(null);
    setForm({
      ...EMPTY_FORM,
      name: product.name || '',
      slug: product.slug || '',
      description: product.description || '',
      short_description: product.short_description || '',
      price: String(product.price ?? ''),
      compare_price: product.compare_price == null ? '' : String(product.compare_price),
      category: product.category || '',
      status: product.status || 'draft',
      stock: String(product.stock ?? 0),
      sku: product.sku || '',
      barcode: product.barcode || '',
      brand: product.brand || '',
      condition: product.condition || 'new',
      weight: product.weight == null ? '' : String(product.weight),
      height: product.height == null ? '' : String(product.height),
      width: product.width == null ? '' : String(product.width),
      length: product.length == null ? '' : String(product.length),
      digital_format: product.digital_format || '',
      digital_version: product.digital_version || '',
      digital_license: product.digital_license || 'personal',
      digital_compatibility: product.digital_compatibility || '',
      download_limit: String(product.download_limit ?? 3),
      download_expiry_days: String(product.download_expiry_days ?? 365),
      course_level: product.course?.level || 'beginner',
      course_duration: product.course?.duration || '',
      total_lessons: String(product.course?.total_lessons ?? 0),
      access_duration_days: product.course?.access_duration_days == null
        ? '' : String(product.course.access_duration_days),
      video_url: product.video_url || '',
      meta_title: product.meta_title || '',
      meta_description: product.meta_description || '',
      is_featured: Boolean(product.is_featured),
      is_on_sale: Boolean(product.is_on_sale),
      allow_backorder: Boolean(product.allow_backorder),
    });
    setError('');
  };

  const setField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    const checked = event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
      ? event.target.checked : undefined;
    setForm((current) => ({ ...current, [name]: checked ?? value }));
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        category: form.category || null,
        compare_price: form.compare_price || null,
        weight: form.weight || null,
        height: form.height || null,
        width: form.width || null,
        length: form.length || null,
        access_duration_days: form.access_duration_days || null,
      };
      let response;
      if (digitalFile) {
        const data = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            data.append(key, typeof value === 'boolean' ? String(value) : String(value));
          } else if (key === 'category' || key === 'compare_price' || key === 'access_duration_days') {
            data.append(key, '');
          }
        });
        data.append('digital_file', digitalFile);
        response = editing
          ? await adminAPI.updateStoreProduct(id, editing.id, data)
          : await adminAPI.createStoreProduct(id, data);
      } else {
        response = editing
          ? await adminAPI.updateStoreProduct(id, editing.id, payload)
          : await adminAPI.createStoreProduct(id, payload);
      }

      const saved = response.data as StoreProduct;
      setEditing(saved);
      if (productImage) {
        const imageData = new FormData();
        imageData.append('image', productImage);
        imageData.append('alt_text', form.name);
        imageData.append('is_primary', 'true');
        await adminAPI.addStoreProductImage(id, saved.id, imageData);
      }
      await loadProducts(editing ? page : 1);
      startCreate();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: StoreProduct) => {
    if (!window.confirm(`Remover "${product.name}"? O produto ficará marcado como removido e poderá ser reactivado.`)) return;
    setError('');
    try {
      await adminAPI.deleteStoreProduct(id, product.id);
      const requestedPage = page > 1 && products.length === 1 ? page - 1 : page;
      await loadProducts(requestedPage);
      if (editing?.id === product.id) startCreate();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!editing) return;
    setError('');
    try {
      await adminAPI.deleteStoreProductImage(id, editing.id, imageId);
      const updatedProducts = await loadProducts(page);
      const updatedProduct = updatedProducts.find((product: StoreProduct) => product.id === editing.id);
      if (updatedProduct) startEdit({
        ...updatedProduct,
        images: updatedProduct.images.filter((image) => image.id !== imageId),
      });
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  };

  const inputClass = 'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm';
  const fieldClass = 'flex flex-col gap-1.5 text-xs font-medium text-muted-foreground';

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/stores/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
            <ArrowLeft size={14} /> Voltar à loja
          </Link>
          <h1 className="text-2xl font-bold">Produtos — {store?.name || 'Loja'}</h1>
          {store && <p className="mt-1 text-sm text-muted-foreground">
            Tipo de loja: {TYPE_LABELS[store.product_type as ProductType] || store.product_type}.
            {' '}Os novos produtos serão criados nesse tipo.
          </p>}
        </div>
        <button type="button" onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90">
          <Plus size={16} /> Novo produto
        </button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <section className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3 font-semibold">Produtos da loja ({productCount})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Esta loja ainda não tem produtos.</td></tr>
                  ) : products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.category_name || 'Sem categoria'}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{TYPE_LABELS[product.product_type] || product.product_type}</td>
                      <td className="whitespace-nowrap px-4 py-3">{Number(product.price).toLocaleString('pt-MZ')} MZN</td>
                      <td className="px-4 py-3">{product.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => startEdit(product)} aria-label={`Editar ${product.name}`}
                            className="rounded-md p-2 text-accent hover:bg-accent/10"><Pencil size={15} /></button>
                          {product.status !== 'deleted' && (
                            <button type="button" onClick={() => deleteProduct(product)} aria-label={`Remover ${product.name}`}
                              className="rounded-md p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground">Página {page} de {pageCount}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => loadProducts(page - 1)} disabled={page === 1}
                    className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Anterior</button>
                  <button type="button" onClick={() => loadProducts(page + 1)} disabled={page === pageCount}
                    className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Seguinte</button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold">{editing ? `Editar: ${editing.name}` : 'Criar produto'}</h2>
              {editing && <button type="button" onClick={startCreate} aria-label="Cancelar edição" className="rounded p-1 hover:bg-muted"><X size={17} /></button>}
            </div>
            <form onSubmit={saveProduct} className="max-h-[78vh] space-y-4 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`${fieldClass} sm:col-span-2`}>Nome *
                  <input className={inputClass} name="name" value={form.name} onChange={setField} required maxLength={500} />
                </label>
                <label className={fieldClass}>Slug
                  <input className={inputClass} name="slug" value={form.slug} onChange={setField} />
                </label>
                <label className={fieldClass}>Categoria
                  <select className={inputClass} name="category" value={form.category} onChange={setField}>
                    <option value="">Sem categoria</option>
                    {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
                  </select>
                </label>
                <label className={fieldClass}>Preço (MZN) *
                  <input className={inputClass} type="number" name="price" value={form.price} onChange={setField} required min="0" step="0.01" />
                </label>
                <label className={fieldClass}>Preço anterior
                  <input className={inputClass} type="number" name="compare_price" value={form.compare_price} onChange={setField} min="0" step="0.01" />
                </label>
                <label className={fieldClass}>Estado
                  <select className={inputClass} name="status" value={form.status} onChange={setField}>
                    <option value="draft">Rascunho</option><option value="active">Activo</option>
                    <option value="inactive">Inactivo</option><option value="deleted">Removido</option>
                  </select>
                </label>
                <label className={fieldClass}>Stock
                  <input className={inputClass} type="number" name="stock" value={form.stock} onChange={setField} min="0" />
                </label>
                <label className={fieldClass}>SKU
                  <input className={inputClass} name="sku" value={form.sku} onChange={setField} />
                </label>
                <label className={fieldClass}>Código de barras
                  <input className={inputClass} name="barcode" value={form.barcode} onChange={setField} />
                </label>
                <label className={`${fieldClass} sm:col-span-2`}>Descrição *
                  <textarea className={inputClass} name="description" rows={4} value={form.description} onChange={setField} required />
                </label>
                <label className={`${fieldClass} sm:col-span-2`}>Descrição curta
                  <textarea className={inputClass} name="short_description" rows={2} value={form.short_description} onChange={setField} />
                </label>
              </div>

              {productType === 'physical' && (
                <fieldset className="space-y-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-semibold">Dados do produto físico</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={fieldClass}>Marca<input className={inputClass} name="brand" value={form.brand} onChange={setField} /></label>
                    <label className={fieldClass}>Condição
                      <select className={inputClass} name="condition" value={form.condition} onChange={setField}>
                        <option value="new">Novo</option><option value="used">Usado</option><option value="refurbished">Recondicionado</option>
                      </select>
                    </label>
                    {(['weight', 'height', 'width', 'length'] as const).map((field) => (
                      <label key={field} className={fieldClass}>{({ weight: 'Peso (kg)', height: 'Altura (cm)', width: 'Largura (cm)', length: 'Comprimento (cm)' })[field]}
                        <input className={inputClass} type="number" min="0" step="0.01" name={field} value={form[field]} onChange={setField} />
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_backorder" checked={form.allow_backorder} onChange={setField} /> Permitir encomenda sem stock</label>
                  </div>
                </fieldset>
              )}

              {productType === 'digital' && (
                <fieldset className="space-y-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-semibold">Dados do produto digital</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={fieldClass}>Formato<input className={inputClass} name="digital_format" value={form.digital_format} onChange={setField} placeholder="PDF, ZIP, MP3..." /></label>
                    <label className={fieldClass}>Versão<input className={inputClass} name="digital_version" value={form.digital_version} onChange={setField} /></label>
                    <label className={fieldClass}>Licença
                      <select className={inputClass} name="digital_license" value={form.digital_license} onChange={setField}>
                        <option value="personal">Pessoal</option><option value="commercial">Comercial</option><option value="extended">Estendida</option>
                      </select>
                    </label>
                    <label className={fieldClass}>Limite de downloads
                      <input className={inputClass} type="number" min="0" name="download_limit" value={form.download_limit} onChange={setField} />
                    </label>
                    <label className={fieldClass}>Validade do download (dias)
                      <input className={inputClass} type="number" min="0" name="download_expiry_days" value={form.download_expiry_days} onChange={setField} />
                    </label>
                    <label className={`${fieldClass} sm:col-span-2`}>Compatibilidade
                      <input className={inputClass} name="digital_compatibility" value={form.digital_compatibility} onChange={setField} />
                    </label>
                    <label className={`${fieldClass} sm:col-span-2`}>Ficheiro digital
                      <input className={inputClass} type="file" onChange={(event) => setDigitalFile(event.target.files?.[0] || null)} />
                    </label>
                  </div>
                </fieldset>
              )}

              {productType === 'course' && (
                <fieldset className="space-y-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-semibold">Dados do curso</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={fieldClass}>Nível
                      <select className={inputClass} name="course_level" value={form.course_level} onChange={setField}>
                        <option value="beginner">Iniciante</option><option value="intermediate">Intermédio</option><option value="advanced">Avançado</option>
                      </select>
                    </label>
                    <label className={fieldClass}>Duração<input className={inputClass} name="course_duration" value={form.course_duration} onChange={setField} placeholder="Ex.: 8 horas" /></label>
                    <label className={fieldClass}>Número de aulas<input className={inputClass} type="number" min="0" name="total_lessons" value={form.total_lessons} onChange={setField} /></label>
                    <label className={fieldClass}>Acesso (dias; vazio = vitalício)
                      <input className={inputClass} type="number" min="1" name="access_duration_days" value={form.access_duration_days} onChange={setField} />
                    </label>
                  </div>
                </fieldset>
              )}

              <fieldset className="space-y-3 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-semibold">Visibilidade e media</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_on_sale" checked={form.is_on_sale} onChange={setField} /> Em promoção</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" checked={form.is_featured} onChange={setField} /> Em destaque</label>
                  <label className={`${fieldClass} sm:col-span-2`}>URL do vídeo<input className={inputClass} name="video_url" value={form.video_url} onChange={setField} /></label>
                  <label className={`${fieldClass} sm:col-span-2`}>Imagem principal / nova imagem
                    <input className={inputClass} type="file" accept="image/*" onChange={(event) => setProductImage(event.target.files?.[0] || null)} />
                  </label>
                </div>
                {editing?.images?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {editing.images.map((image) => (
                      <div key={image.id} className="relative h-16 w-16 overflow-hidden rounded border">
                        <img src={image.image} alt={image.alt_text || editing.name} className="h-full w-full object-cover" />
                        {image.is_primary && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-white">Principal</span>}
                        <button type="button" onClick={() => deleteImage(image.id)} aria-label="Remover imagem"
                          className="absolute right-0 top-0 rounded-bl bg-white/90 p-1 text-red-600"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!editing && <p className="text-xs text-muted-foreground">A imagem selecionada será enviada como imagem principal após criar o produto.</p>}
              </fieldset>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                {editing && <button type="button" onClick={startCreate} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>}
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : editing ? <Save size={15} /> : <ImagePlus size={15} />}
                  {editing ? 'Guardar alterações' : 'Criar produto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
