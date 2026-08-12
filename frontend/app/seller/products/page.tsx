'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Plus, Search, Edit, Trash2, RefreshCw, Layers, Download, FileText, GraduationCap, History, X, AlertCircle } from 'lucide-react';
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

export default function SellerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeType, setStoreType] = useState<string>('physical');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<any | null>(null);

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
                        {' '}· {log.change_type === 'sale' ? '🛒 Venda' : log.change_type === 'cancel' ? '🔙 Cancelamento' : log.change_type === 'return' ? '🔄 Devolução' : log.change_type === 'restock' ? '📦 Reposição' : '✏️ Ajuste'}
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
