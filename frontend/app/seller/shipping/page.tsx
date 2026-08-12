'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, Edit3, Save, X, Truck, MapPin, Loader2, AlertCircle,
  Package, Globe, Clock, Coins, Info, ArrowRight, CheckCircle2, Layers,
} from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const PROVINCES = [
  { value: 'maputo_cidade', label: 'Maputo Cidade' },
  { value: 'maputo_provincia', label: 'Maputo Província' },
  { value: 'gaza', label: 'Gaza' },
  { value: 'inhambane', label: 'Inhambane' },
  { value: 'sofala', label: 'Sofala' },
  { value: 'manica', label: 'Manica' },
  { value: 'tete', label: 'Tete' },
  { value: 'zambezia', label: 'Zambézia' },
  { value: 'nampula', label: 'Nampula' },
  { value: 'cabo_delgado', label: 'Cabo Delgado' },
  { value: 'niassa', label: 'Niassa' },
];

type ActiveTab = 'zones' | 'methods' | 'rates';

export default function SellerShippingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('zones');
  const [zones, setZones] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneForm, setZoneForm] = useState({ id: '', name: '', provinces: [] as string[] });
  const [showMethodForm, setShowMethodForm] = useState(false);
  const [methodForm, setMethodForm] = useState({ id: '', name: '', description: '', method_type: 'delivery', pickup_address: '', estimated_days_min: '1', estimated_days_max: '7' });
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ method: '', zone: '', base_price: '', per_kg_price: '', free_shipping_min: '', max_weight_kg: '' });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch(`${API_URL}/stores/me/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.product_type !== 'physical') router.replace('/seller/dashboard'); })
      .catch(() => {});
  }, [router]);

  const apiHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), };
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const h = apiHeaders();
      const [zRes, mRes, rRes] = await Promise.all([
        fetch(`${API_URL}/shipping/zones/`, { headers: h }),
        fetch(`${API_URL}/shipping/methods/`, { headers: h }),
        fetch(`${API_URL}/shipping/rates/`, { headers: h }),
      ]);
      const [zData, mData, rData] = await Promise.all([
        zRes.ok ? zRes.json() : { results: [] },
        mRes.ok ? mRes.json() : { results: [] },
        rRes.ok ? rRes.json() : { results: [] },
      ]);
      setZones(zData.results || zData || []);
      setMethods(mData.results || mData || []);
      setRates(rData.results || rData || []);
    } catch { setError('Erro ao carregar configurações.'); }
    finally { setLoading(false); }
  }, [apiHeaders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openZoneForm = (z?: any) => {
    setZoneForm(z ? { id: z.id, name: z.name, provinces: z.provinces || [] } : { id: '', name: '', provinces: [] });
    setShowZoneForm(true);
  };

  const saveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneForm.name.trim()) return;
    setSaving('zone');
    try {
      const body = JSON.stringify({ name: zoneForm.name, provinces: zoneForm.provinces, is_active: true });
      const url = zoneForm.id ? `${API_URL}/shipping/zones/${zoneForm.id}/` : `${API_URL}/shipping/zones/`;
      const res = await fetch(url, { method: zoneForm.id ? 'PUT' : 'POST', headers: apiHeaders(), body });
      if (!res.ok) throw new Error('Erro ao guardar.');
      setShowZoneForm(false);
      fetchAll();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(null); }
  };

  const deleteZone = async (id: string) => {
    if (!confirm('Eliminar esta zona e todas as suas tarifas?')) return;
    try { await fetch(`${API_URL}/shipping/zones/${id}/`, { method: 'DELETE', headers: apiHeaders() }); fetchAll(); }
    catch { alert('Erro ao eliminar.'); }
  };

  const openMethodForm = (m?: any) => {
    setMethodForm(m ? { id: m.id, name: m.name, description: m.description || '', method_type: m.method_type || 'delivery', pickup_address: m.pickup_address || '', estimated_days_min: String(m.estimated_days_min), estimated_days_max: String(m.estimated_days_max) } : { id: '', name: '', description: '', method_type: 'delivery', pickup_address: '', estimated_days_min: '1', estimated_days_max: '7' });
    setShowMethodForm(true);
  };

  const saveMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodForm.name.trim()) return;
    setSaving('method');
    try {
      const body = JSON.stringify({ name: methodForm.name, description: methodForm.description, method_type: methodForm.method_type, pickup_address: methodForm.method_type === 'pickup' ? methodForm.pickup_address : '', estimated_days_min: parseInt(methodForm.estimated_days_min) || 1, estimated_days_max: parseInt(methodForm.estimated_days_max) || 7, is_active: true });
      const url = methodForm.id ? `${API_URL}/shipping/methods/${methodForm.id}/` : `${API_URL}/shipping/methods/`;
      const res = await fetch(url, { method: methodForm.id ? 'PUT' : 'POST', headers: apiHeaders(), body });
      if (!res.ok) throw new Error('Erro ao guardar.');
      setShowMethodForm(false);
      fetchAll();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(null); }
  };

  const deleteMethod = async (id: string) => {
    if (!confirm('Eliminar este método e todas as suas tarifas?')) return;
    try { await fetch(`${API_URL}/shipping/methods/${id}/`, { method: 'DELETE', headers: apiHeaders() }); fetchAll(); }
    catch { alert('Erro ao eliminar.'); }
  };

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateForm.method || !rateForm.zone) return;
    setSaving('rate');
    try {
      const body = JSON.stringify({
        method: rateForm.method, zone: rateForm.zone,
        base_price: rateForm.base_price || '0', per_kg_price: rateForm.per_kg_price || '0',
        free_shipping_min: rateForm.free_shipping_min || null,
        max_weight_kg: rateForm.max_weight_kg || null,
        is_active: true,
      });
      const res = await fetch(`${API_URL}/shipping/rates/`, { method: 'POST', headers: apiHeaders(), body });
      if (!res.ok) throw new Error('Erro ao criar tarifa.');
      setShowRateForm(false);
      setRateForm({ method: '', zone: '', base_price: '', per_kg_price: '', free_shipping_min: '', max_weight_kg: '' });
      fetchAll();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(null); }
  };

  const deleteRate = async (id: string) => {
    if (!confirm('Eliminar esta tarifa?')) return;
    try { await fetch(`${API_URL}/shipping/rates/${id}/`, { method: 'DELETE', headers: apiHeaders() }); fetchAll(); }
    catch { alert('Erro ao eliminar.'); }
  };

  const tabs: { key: ActiveTab; label: string; icon: any; count: number }[] = [
    { key: 'zones', label: 'Zonas', icon: MapPin, count: zones.length },
    { key: 'methods', label: 'Métodos', icon: Truck, count: methods.length },
    { key: 'rates', label: 'Tarifas', icon: Coins, count: rates.length },
  ];

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={36} message="A carregar configurações de envio..." />
        </div>
      </SellerLayout>
    );
  }

  const hasZonesAndMethods = zones.length > 0 && methods.length > 0;

  return (
    <SellerLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-accent/10 rounded-full">
              <Truck size={28} className="text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configurar Envios</h1>
              <p className="text-sm text-muted-foreground">
                Configure onde e como entrega os seus produtos físicos
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* Setup Flow Guide */}
        <div className="mb-8 p-5 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Info size={16} className="text-accent shrink-0" /> Fluxo de configuração
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className={zones.length > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
              {zones.length > 0 ? '✓' : '①'} Zonas
            </span>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
            <span className={methods.length > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
              {methods.length > 0 ? '✓' : '②'} Métodos
            </span>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
            <span className={rates.length > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
              {rates.length > 0 ? '✓' : '③'} Tarifas
            </span>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Disponível no checkout</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === tab.key ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* ─── ZONES ─── */}
          {activeTab === 'zones' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <MapPin size={20} className="text-accent" /> Zonas de Entrega
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Defina as regiões para onde envia os seus produtos</p>
                </div>
                <button onClick={() => openZoneForm()}
                  className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Nova Zona
                </button>
              </div>

              {showZoneForm && (
                <form onSubmit={saveZone} className="mb-6 p-5 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{zoneForm.id ? 'Editar Zona' : 'Nova Zona'}</h3>
                    <button type="button" onClick={() => setShowZoneForm(false)} className="p-1 hover:bg-muted rounded"><X size={16} /></button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome da Zona *</label>
                    <input type="text" placeholder="Ex: Maputo Cidade, Zona Sul, Nacional"
                      value={zoneForm.name} onChange={e => setZoneForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      autoFocus required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Províncias incluídas *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PROVINCES.map(p => {
                        const checked = zoneForm.provinces.includes(p.value);
                        return (
                          <label key={p.value}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                              checked ? 'border-accent bg-accent/5 text-accent font-medium' : 'border-border hover:border-accent/30'
                            }`}>
                            <input type="checkbox" checked={checked}
                              onChange={e => setZoneForm(pv => ({ ...pv, provinces: e.target.checked ? [...pv.provinces, p.value] : pv.provinces.filter(v => v !== p.value) }))}
                              className="sr-only" />
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-accent bg-accent' : 'border-muted-foreground/30'}`}>
                              {checked && <CheckCircle2 size={12} className="text-accent-foreground" />}
                            </span>
                            {p.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving === 'zone'}
                      className="px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2 transition-colors">
                      {saving === 'zone' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {zoneForm.id ? 'Atualizar Zona' : 'Criar Zona'}
                    </button>
                    <button type="button" onClick={() => setShowZoneForm(false)}
                      className="px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancelar</button>
                  </div>
                </form>
              )}

              {zones.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe size={28} className="text-muted-foreground/40" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">Nenhuma zona criada</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    Crie zonas de entrega para definir as regiões onde os seus produtos podem ser entregues.
                  </p>
                  <button onClick={() => openZoneForm()}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 inline-flex items-center gap-2">
                    <Plus size={16} /> Criar Primeira Zona
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {zones.map((z: any) => (
                    <div key={z.id} className="border border-border rounded-xl p-4 hover:border-accent/30 hover:shadow-sm transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-green-50 rounded-lg">
                            <MapPin size={16} className="text-green-600" />
                          </div>
                          <h4 className="font-semibold text-sm">{z.name}</h4>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openZoneForm(z)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="Editar">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => deleteZone(z.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500" title="Eliminar">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(z.provinces_display || []).map((prov: string) => (
                          <span key={prov} className="px-2 py-0.5 bg-muted rounded-md text-[11px] text-muted-foreground">{prov}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── METHODS ─── */}
          {activeTab === 'methods' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Truck size={20} className="text-accent" /> Métodos de Envio
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Defina como entrega (Standard, Expresso, etc.)</p>
                </div>
                <button onClick={() => openMethodForm()}
                  className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Novo Método
                </button>
              </div>

              {showMethodForm && (
                <form onSubmit={saveMethod} className="mb-6 p-5 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{methodForm.id ? 'Editar Método' : 'Novo Método'}</h3>
                    <button type="button" onClick={() => setShowMethodForm(false)} className="p-1 hover:bg-muted rounded"><X size={16} /></button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome *</label>
                    <input type="text" placeholder="Ex: Standard, Expresso, Próprio"
                      value={methodForm.name} onChange={e => setMethodForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" autoFocus required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descrição (opcional)</label>
                    <input type="text" placeholder="Ex: Entrega porta-a-porta em Maputo"
                      value={methodForm.description} onChange={e => setMethodForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
                    <select value={methodForm.method_type}
                      onChange={e => setMethodForm(p => ({ ...p, method_type: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
                      <option value="delivery">🚚 Entrega ao Domicílio</option>
                      <option value="pickup">🏪 Levantamento em Loja</option>
                    </select>
                  </div>
                  {methodForm.method_type === 'pickup' && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Morada de Levantamento *</label>
                      <textarea rows={2} placeholder="Ex: Av. 24 de Julho, 1234, Maputo" value={methodForm.pickup_address}
                        onChange={e => setMethodForm(p => ({ ...p, pickup_address: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prazo mínimo (dias)</label>
                      <input type="number" min="1" value={methodForm.estimated_days_min}
                        onChange={e => setMethodForm(p => ({ ...p, estimated_days_min: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prazo máximo (dias)</label>
                      <input type="number" min="1" value={methodForm.estimated_days_max}
                        onChange={e => setMethodForm(p => ({ ...p, estimated_days_max: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving === 'method'}
                      className="px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2 transition-colors">
                      {saving === 'method' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {methodForm.id ? 'Atualizar Método' : 'Criar Método'}
                    </button>
                    <button type="button" onClick={() => setShowMethodForm(false)}
                      className="px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancelar</button>
                  </div>
                </form>
              )}

              {methods.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package size={28} className="text-muted-foreground/40" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">Nenhum método criado</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    Crie métodos de envio como "Standard" ou "Expresso" para oferecer opções aos seus clientes.
                  </p>
                  <button onClick={() => openMethodForm()}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 inline-flex items-center gap-2">
                    <Plus size={16} /> Criar Primeiro Método
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {methods.map((m: any) => {
                    const rateCount = rates.filter(r => r.method === m.id).length;
                    return (
                      <div key={m.id} className="border border-border rounded-xl p-4 hover:border-accent/30 hover:shadow-sm transition-all group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Truck size={16} className="text-blue-600" />
                            </div>
                            <h4 className="font-semibold text-sm">{m.name}</h4>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openMethodForm(m)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="Editar">
                              <Edit3 size={13} />
                            </button>
                            <button onClick={() => deleteMethod(m.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500" title="Eliminar">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock size={12} /> {m.estimated_days_display}</span>
                          <span className="flex items-center gap-1"><Layers size={12} /> {rateCount} tarifa{rateCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── RATES ─── */}
          {activeTab === 'rates' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Coins size={20} className="text-accent" /> Tarifas de Envio
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Associe preços a cada combinação de zona e método</p>
                </div>
                <button onClick={() => setShowRateForm(true)}
                  disabled={!hasZonesAndMethods}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    hasZonesAndMethods ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  title={!hasZonesAndMethods ? 'Crie pelo menos uma zona e um método primeiro' : ''}>
                  <Plus size={16} /> Nova Tarifa
                </button>
              </div>

              {!hasZonesAndMethods && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-center gap-2">
                  <Info size={16} className="shrink-0" />
                  Precisa de criar pelo menos uma zona e um método antes de adicionar tarifas.
                </div>
              )}

              {showRateForm && hasZonesAndMethods && (
                <form onSubmit={saveRate} className="mb-6 p-5 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Nova Tarifa</h3>
                    <button type="button" onClick={() => setShowRateForm(false)} className="p-1 hover:bg-muted rounded"><X size={16} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Método *</label>
                      <select value={rateForm.method} onChange={e => setRateForm(p => ({ ...p, method: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" required>
                        <option value="">Selecionar método...</option>
                        {methods.map(m => <option key={m.id} value={m.id}>{m.name} ({m.estimated_days_display})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Zona *</label>
                      <select value={rateForm.zone} onChange={e => setRateForm(p => ({ ...p, zone: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" required>
                        <option value="">Selecionar zona...</option>
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preço Base (MZN)</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={rateForm.base_price}
                        onChange={e => setRateForm(p => ({ ...p, base_price: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preço por kg (MZN)</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={rateForm.per_kg_price}
                        onChange={e => setRateForm(p => ({ ...p, per_kg_price: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Grátis acima de (MZN)</label>
                      <input type="number" step="0.01" min="0" placeholder="Opcional" value={rateForm.free_shipping_min}
                        onChange={e => setRateForm(p => ({ ...p, free_shipping_min: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Peso máximo (kg)</label>
                      <input type="number" step="0.01" min="0" placeholder="Sem limite" value={rateForm.max_weight_kg}
                        onChange={e => setRateForm(p => ({ ...p, max_weight_kg: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving === 'rate'}
                      className="px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2 transition-colors">
                      {saving === 'rate' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Criar Tarifa
                    </button>
                    <button type="button" onClick={() => setShowRateForm(false)}
                      className="px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancelar</button>
                  </div>
                </form>
              )}

              {rates.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coins size={28} className="text-muted-foreground/40" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">Nenhuma tarifa criada</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    {hasZonesAndMethods
                      ? 'Associe preços às combinações de zona e método para activar o cálculo de frete no checkout.'
                      : 'Crie zonas e métodos primeiro, depois configure os preços aqui.'}
                  </p>
                  {hasZonesAndMethods && (
                    <button onClick={() => setShowRateForm(true)}
                      className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 inline-flex items-center gap-2">
                      <Plus size={16} /> Criar Primeira Tarifa
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/30">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Método</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Zona</th>
                        <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Base</th>
                        <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">/kg</th>
                        <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Grátis ≥</th>
                        <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Peso Máx</th>
                        <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rates.map((r: any) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span className="font-medium">{r.method_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4"><span className="text-muted-foreground">{r.zone_name}</span></td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {Number(r.base_price).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">
                            {Number(r.per_kg_price).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                          </td>
                          <td className="py-3 px-4 text-right">
                            {r.free_shipping_min ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                                {Number(r.free_shipping_min).toLocaleString('pt-MZ')} MZN
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">
                            {r.max_weight_kg ? `${Number(r.max_weight_kg).toLocaleString('pt-MZ')} kg` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => deleteRate(r.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors" title="Eliminar tarifa">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
