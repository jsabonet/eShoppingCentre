'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Plus, Search, Edit, Trash2, RefreshCw, Layers, Download, FileText, GraduationCap, History, X, AlertCircle, ShoppingBag, Undo2, RotateCcw, Pencil, Users } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { productsAPI, storesAPI } from '@/src/lib/api';
import type { Product } from '@/src/lib/api';

const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

const FORMAT_LABELS: Record<string, string> = {
  PDF: '📄 PDF', ZIP: '📦 ZIP', MP3: '🎵 MP3', MP4: '🎬 MP4',
  PNG: '🖼️ PNG', JPG: '🖼️ JPG', DOCX: '📝 DOCX', XLSX: '📊 XLSX',
  PPTX: '📽️ PPTX', EPUB: '📖 EPUB', MOBI: '📖 MOBI', SVG: '🎨 SVG',
  PSD: '🎨 PSD', AI: '🎨 AI', OUTRO: '📎 Outro',
};

const LICENSE_LABELS: Record<string, string> = {
  personal: '👤 Pessoal',
  commercial: '🏢 Comercial',
  extended: '🌐 Extended',
};

function AffiliateCell({ product, saving, onToggle, onSaveCommission }: {
  product: Product;
  saving: boolean;
  onToggle: () => void;
  onSaveCommission: (value: string) => void;
}) {
  const [value, setValue] = useState(String(product.affiliate_commission ?? 10));
  const enabled = product.affiliate_enabled !== false;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        title={enabled ? 'Desactivar afiliação' : 'Activar afiliação'}
        className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : ''}`} />
      </button>
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          value={value}
          min="0"
          max="100"
          step="0.5"
          disabled={!enabled || saving}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onSaveCommission(value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-14 px-1.5 py-1 border border-border rounded-md text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

export default function SellerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeType, setStoreType] = useState<string>('physical');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<any | null>(null);
  const [savingAffiliate, setSavingAffiliate] = useState<string | null>(null);
  const [bulkCommission, setBulkCommission] = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [affiliateError, setAffiliateError] = useState('');

  // Course stores should use /seller/courses instead
  useEffect(() => {
    (async () => {
      try {
        const { data } = await storesAPI.myStore();
        const type = data.product_type || 'physical';
        setStoreType(type);
        if (type === 'course') {
          router.replace('/seller/courses');
          return;
        }
      } catch {}
    })();
  }, [router]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await productsAPI.myProducts();
      setProducts((data as any).results || data || []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (storeType !== 'course') {
      fetchProducts();
    }
  }, [fetchProducts, storeType]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este produto?')) return;
    setDeleting(id);
    try {
      await productsAPI.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch { alert('Erro ao remover produto.'); }
    finally { setDeleting(null); }
  };

  const toggleAffiliate = async (product: Product) => {
    setSavingAffiliate(product.id);
    setAffiliateError('');
    try {
      const newValue = product.affiliate_enabled === false;
      await productsAPI.updateAffiliate(product.id, { affiliate_enabled: newValue });
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, affiliate_enabled: newValue } : p));
    } catch {
      setAffiliateError('Erro ao actualizar afiliação.');
    } finally {
      setSavingAffiliate(null);
    }
  };

  const saveCommission = async (product: Product, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    if (num === Number(product.affiliate_commission)) return;
    setSavingAffiliate(product.id);
    setAffiliateError('');
    try {
      await productsAPI.updateAffiliate(product.id, { affiliate_commission: num });
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, affiliate_commission: num } : p));
    } catch (err: any) {
      setAffiliateError(err?.response?.data?.detail || 'Erro ao actualizar comissão.');
    } finally {
      setSavingAffiliate(null);
    }
  };

  const bulkApply = async () => {
    const num = parseFloat(bulkCommission);
    if (isNaN(num) || num <= 0) { setAffiliateError('Indique uma comissão válida.'); return; }
    setBulkApplying(true);
    setAffiliateError('');
    try {
      const { data } = await productsAPI.bulkAffiliate({ affiliate_commission: num, affiliate_enabled: true });
      setProducts((prev) => prev.map((p) => ({ ...p, affiliate_commission: num, affiliate_enabled: true })));
      alert(`${data.updated} produto(s) actualizados.`);
      setBulkCommission('');
    } catch (err: any) {
      setAffiliateError(err?.response?.data?.detail || 'Erro ao aplicar em massa.');
    } finally {
      setBulkApplying(false);
    }
  };

  const imageUrl = (img: string | null) => {
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return `${MEDIA_BASE}${img.startsWith('/') ? '' : '/'}${img}`;
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusLabel: Record<string, string> = {
    active: 'Activo', inactive: 'Inactivo', draft: 'Rascunho', deleted: 'Removido',
  };
  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
    deleted: 'bg-gray-100 text-gray-400',
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar produtos..." /></div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="text-sm text-muted-foreground">{products.length} produtos na sua loja</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchProducts} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Actualizar">
              <RefreshCw size={16} />
            </button>
            <Link href="/seller/products/new"
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
              <Plus size={16} /> Novo Produto
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar produtos..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background">
            <option value="all">Todos os status</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="draft">Rascunho</option>
          </select>
        </div>

        {/* Afiliação em massa */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 p-3 bg-violet-50 border border-violet-100 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 shrink-0">
            <Users size={16} /> Afiliação em massa
          </div>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <span className="text-xs text-muted-foreground">Definir comissão para todos os produtos:</span>
            <input type="number" min="0" max="100" step="0.5" value={bulkCommission} onChange={(e) => setBulkCommission(e.target.value)}
              placeholder="Ex: 10" className="w-20 px-2 py-1.5 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            <span className="text-xs text-muted-foreground">%</span>
            <button onClick={bulkApply} disabled={bulkApplying}
              className="px-3 py-1.5 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50">
              {bulkApplying ? 'A aplicar...' : 'Aplicar a todos'}
            </button>
          </div>
        </div>
        {affiliateError && <p className="text-xs text-red-600 mb-3">{affiliateError}</p>}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Preço</th>
                  {storeType === 'physical' ? (
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                  ) : storeType === 'digital' ? (
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Formato</th>
                  ) : (
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Info</th>
                  )}
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">{storeType === 'digital' ? 'Downloads' : 'Vendas'}</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Afiliação</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => {
                  const img = imageUrl((product as any).primary_image);
                  const pData = product as any;
                  return (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                          {img ? <img src={img} alt="" className="w-full h-full object-cover" />
                           : <div className="w-full h-full flex items-center justify-center text-muted-foreground">{storeType === 'digital' ? <FileText size={16} /> : <Package size={16} />}</div>}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate block max-w-[200px]">{product.name}</span>
                          {storeType === 'digital' && pData.digital_version && (
                            <span className="text-[10px] text-muted-foreground">{pData.digital_version}</span>
                          )}
                          {product.affiliate_enabled !== false && (
                            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded-full font-medium">
                              <Users size={10} /> Afiliável {Number(product.affiliate_commission ?? 10)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{Number(product.price).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</td>
                    {storeType === 'physical' ? (
                      <td className="py-3 px-4">
                        <span className={Number(product.stock) === 0 ? 'text-red-600 font-medium' : ''}>
                          {Number(product.stock) === 0 ? 'Sem stock' : product.stock}
                        </span>
                      </td>
                    ) : storeType === 'digital' ? (
                      <td className="py-3 px-4">
                        {pData.digital_format ? (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {FORMAT_LABELS[pData.digital_format] || pData.digital_format}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        {pData.digital_license && (
                          <span className="ml-1 px-1 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px]">
                            {LICENSE_LABELS[pData.digital_license]?.split(' ')[0] || pData.digital_license}
                          </span>
                        )}
                      </td>
                    ) : (
                      <td className="py-3 px-4 text-sm text-muted-foreground">—</td>
                    )}
                    <td className="py-3 px-4">
                      {storeType === 'digital'
                        ? <span className="flex items-center gap-1 text-sm"><Download size={13} className="text-muted-foreground" />{pData.digital_downloads ?? pData.sales_count}</span>
                        : product.sales_count
                      }
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[product.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel[product.status] || product.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <AffiliateCell
                        product={product}
                        saving={savingAffiliate === product.id}
                        onToggle={() => toggleAffiliate(product)}
                        onSaveCommission={(v) => saveCommission(product, v)}
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {product.product_type === 'physical' && (
                          <button onClick={() => setStockModal(product)} title="Histórico de Stock"
                            className="p-1.5 hover:bg-purple-50 rounded-md text-muted-foreground hover:text-purple-600 transition-colors">
                            <History size={16} />
                          </button>
                        )}
                        <Link href={`/seller/products/${product.id}/edit`}
                          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
                          <Edit size={16} />
                        </Link>
                        <button onClick={() => handleDelete(product.id)} disabled={deleting === product.id}
                          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {search || statusFilter !== 'all' ? 'Nenhum produto encontrado.' : 'Nenhum produto. Crie o seu primeiro produto!'}
            </div>
          )}
        </div>
      </div>

      {/* Stock History Modal */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStockModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><History size={18} className="text-purple-600" /> Stock: {stockModal.name}</h2>
              <button onClick={() => setStockModal(null)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Stock atual: <span className="font-bold text-foreground">{stockModal.stock}</span></p>
            {stockModal.stock_logs?.length > 0 ? (
              <div className="space-y-2">
                {stockModal.stock_logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2 text-xs border-b border-border pb-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      log.quantity > 0 ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p>
                        <span className={`font-semibold ${log.quantity > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {log.quantity > 0 ? '+' : ''}{log.quantity}
                        </span>
                        {' '}· <span className="inline-flex items-center gap-1">{log.change_type === 'sale' ? <><ShoppingBag size={12} /> Venda</> : log.change_type === 'cancel' ? <><Undo2 size={12} /> Cancelamento</> : log.change_type === 'return' ? <><RotateCcw size={12} /> Devolução</> : log.change_type === 'restock' ? <><Plus size={12} /> Reposição</> : <><Pencil size={12} /> Ajuste</>}</span>
                        {' '}· <span className="text-muted-foreground">{log.stock_before} → {log.stock_after}</span>
                      </p>
                      <p className="text-muted-foreground">{log.reference} · {log.changed_by_name}</p>
                      <p className="text-muted-foreground/60">{new Date(log.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhum registo de stock ainda.</p>
            )}
          </div>
        </div>
      )}

    </SellerLayout>
  );
}
