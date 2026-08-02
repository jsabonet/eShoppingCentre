'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Building2, FileText, Clock, Package, ShoppingCart,
  Store as StoreIcon, TrendingUp, Users, CheckCircle, XCircle, ChevronRight, AlertCircle, Loader2
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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'bg-green-100 text-green-700' },
  pending: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
  awaiting_documents: { label: 'Aguardando Docs', cls: 'bg-blue-100 text-blue-700' },
  suspended: { label: 'Suspenso', cls: 'bg-orange-100 text-orange-700' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-700' },
};

export default function AdminStoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    if (!isAuthenticated || !isAdmin) return;

    (async () => {
      setLoading(true);
      try {
        const { data } = await adminAPI.getStore(id);
        setStore(data);
      } catch { setError('Erro ao carregar a loja.'); }
      finally { setLoading(false); }
    })();
  }, [id, isAuthenticated, isAdmin, authLoading, router]);

  const status = store ? (STATUS_BADGE[store.status] || { label: store.status, cls: 'bg-gray-100 text-gray-700' }) : null;

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/admin?tab=stores" className="hover:text-accent transition-colors flex items-center gap-1">
          <ArrowLeft size={14} /> Lojas
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{store?.name || '...'}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-accent" /></div>
      ) : error ? (
        <div className="bg-white rounded-lg border p-12 text-center text-muted-foreground">{error}</div>
      ) : store ? (
        <div className="space-y-6">
          {/* Header card */}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            {store.banner && (
              <div className="h-36 bg-muted">
                <img src={mediaUrl(store.banner) || ''} alt="Banner" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {store.logo ? (
                    <img src={mediaUrl(store.logo) || ''} alt="" className="w-20 h-20 rounded-xl object-cover border" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                      <Building2 size={32} className="text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold">{store.name}</h1>
                      {status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{store.tagline || store.description || 'Sem slogan'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="inline-block px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs mr-1.5">
                        {store.product_type === 'course' ? 'Cursos' : store.product_type === 'digital' ? 'Digital' : 'Físico'}
                      </span>
                      {store.category || '—'} · {store.location || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/admin/stores/${store.id}/edit`}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90">
                    <Edit size={14} /> Editar Loja
                  </Link>
                  {store.slug && (
                    <a href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">
                      Ver Loja
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Produtos', value: store.total_products || 0 },
              { label: 'Vendas', value: store.total_sales || 0 },
              { label: 'Avaliação', value: `${Number(store.rating || 0).toFixed(1)} ★` },
              { label: 'Receita', value: `${(store.total_revenue || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg border border-border p-4 text-center shadow-sm">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Owner info */}
              <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                <h3 className="font-bold mb-3 flex items-center gap-2"><Users size={16} /> Dono da Loja</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Nome:</span> <strong>{store.owner_name || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Email:</span> <strong>{store.owner_email || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <strong>{store.owner_phone || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Verificado:</span> <strong>{store.owner_verified ? '✅ Sim' : '❌ Não'}</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Registado em:</span> <strong>{store.owner_date_joined ? new Date(store.owner_date_joined).toLocaleDateString('pt-MZ') : '—'}</strong></div>
                </div>
              </div>

              {/* Store details */}
              <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                <h3 className="font-bold mb-3 flex items-center gap-2"><StoreIcon size={16} /> Detalhes da Loja</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Slug:</span> <strong>{store.slug || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <strong>{store.phone || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Email loja:</span> <strong>{store.email || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Website:</span> <strong>{store.website || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Comissão Afiliados:</span> <strong>{store.default_affiliate_commission}%</strong></div>
                  <div><span className="text-muted-foreground">Alerta Stock:</span> <strong>{store.low_stock_threshold} unid.</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> <span>{store.description || '—'}</span></div>
                  {store.about && <div className="col-span-2"><span className="text-muted-foreground">Sobre:</span> <span>{store.about}</span></div>}
                </div>
              </div>

              {/* Monthly sales chart */}
              {store.monthly_sales?.length > 0 && (
                <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                  <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp size={16} /> Vendas Mensais</h3>
                  <div className="flex items-end gap-2 h-40">
                    {store.monthly_sales.map((m: any) => {
                      const maxVal = Math.max(...store.monthly_sales.map((x: any) => x.total || 0), 1);
                      const height = ((m.total || 0) / maxVal) * 100;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <span className="text-[10px] font-medium text-muted-foreground">{m.total > 0 ? `${(m.total / 1000).toFixed(0)}k` : ''}</span>
                          <div className="w-full bg-accent/20 rounded-t-sm overflow-hidden" style={{ height: '120px' }}>
                            <div className="w-full bg-accent rounded-t-sm transition-all" style={{ height: `${Math.max(height, 2)}%`, marginTop: `${100 - Math.max(height, 2)}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{m.month}</span>
                          {m.orders > 0 && <span className="text-[9px] text-muted-foreground">{m.orders} vendas</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Products */}
              {store.store_products?.length > 0 && (
                <div className="bg-white rounded-lg border border-border shadow-sm">
                  <div className="p-5 pb-3"><h3 className="font-bold flex items-center gap-2"><Package size={16} /> Produtos da Loja ({store.store_products.length})</h3></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-y border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Produto</th>
                          <th className="text-right px-4 py-2 font-medium">Preço</th>
                          <th className="text-center px-4 py-2 font-medium">Stock</th>
                          <th className="text-center px-4 py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {store.store_products.map((p: any) => (
                          <tr key={p.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-muted-foreground ml-1.5">{p.product_type === 'course' ? '🎓' : p.product_type === 'digital' ? '📥' : '📦'}</span>
                            </td>
                            <td className="px-4 py-2 text-right">{Number(p.price).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</td>
                            <td className="px-4 py-2 text-center">{p.product_type === 'physical' ? p.stock : '∞'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'draft' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                                {p.status === 'active' ? 'Activo' : p.status === 'draft' ? 'Rascunho' : p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right column: docs, logs, orders, notes */}
            <div className="space-y-6">
              {/* Documents */}
              <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                <h3 className="font-bold mb-3 flex items-center gap-2"><FileText size={16} /> Documentos de Verificação</h3>
                {store.identity_document || store.tax_document || store.address_proof || store.additional_documents ? (
                  <div className="space-y-2">
                    {store.identity_document && <a href={mediaUrl(store.identity_document) || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg hover:bg-muted/40 text-sm"><FileText size={16} className="text-blue-500" /> Doc. Identidade (frente)</a>}
                    {store.tax_document && <a href={mediaUrl(store.tax_document) || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg hover:bg-muted/40 text-sm"><FileText size={16} className="text-green-500" /> NUIT / Registo Comercial</a>}
                    {store.address_proof && <a href={mediaUrl(store.address_proof) || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg hover:bg-muted/40 text-sm"><FileText size={16} className="text-orange-500" /> Verso do Documento / Morada</a>}
                    {store.additional_documents && <a href={mediaUrl(store.additional_documents) || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg hover:bg-muted/40 text-sm"><FileText size={16} className="text-gray-500" /> Documentos Adicionais</a>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>}
              </div>

              {/* Policies */}
              <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                <h3 className="font-bold mb-3">📦 Políticas</h3>
                <p className="text-sm text-muted-foreground mb-3"><strong className="text-foreground">Envio:</strong><br />{store.shipping_policy || 'Não definida.'}</p>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">Devolução:</strong><br />{store.return_policy || 'Não definida.'}</p>
              </div>

              {/* Recent orders */}
              {store.recent_orders?.length > 0 && (
                <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                  <h3 className="font-bold mb-3 flex items-center gap-2"><ShoppingCart size={16} /> Últimas Encomendas</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {store.recent_orders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{o.customer}</p>
                          <p className="text-xs text-muted-foreground">{o.order_number} · {o.items_count} itens · {new Date(o.created_at).toLocaleDateString('pt-MZ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Number(o.total).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${o.status === 'delivered' ? 'bg-green-100 text-green-700' : o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : o.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{o.status_display}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation log */}
              {store.moderation_logs?.length > 0 && (
                <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                  <h3 className="font-bold mb-3 flex items-center gap-2"><Clock size={16} /> Histórico de Moderação</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {store.moderation_logs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-3 p-2 bg-muted/20 rounded-lg text-sm">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${log.action === 'approved' ? 'bg-green-100 text-green-700' : log.action === 'rejected' ? 'bg-red-100 text-red-700' : log.action === 'suspended' ? 'bg-orange-100 text-orange-700' : log.action === 'reactivated' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{log.action_display}</span>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">por {log.admin_name || log.admin_email || 'Sistema'} · {new Date(log.created_at).toLocaleDateString('pt-MZ')}</p>
                          {log.reason && <p className="text-xs mt-0.5">{log.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin notes */}
              <div className="bg-white rounded-lg border border-border p-5 shadow-sm">
                <h3 className="font-bold mb-3">💬 Notas Admin</h3>
                <p className="text-sm text-muted-foreground italic">{store.admin_notes || 'Nenhuma nota.'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
