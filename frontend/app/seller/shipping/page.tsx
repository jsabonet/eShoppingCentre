'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit3, Save, X, Truck, MapPin, ChevronRight, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const PROVINCES = [
  { value: 'cabo_delgado', label: 'Cabo Delgado' },
  { value: 'gaza', label: 'Gaza' },
  { value: 'inhambane', label: 'Inhambane' },
  { value: 'manica', label: 'Manica' },
  { value: 'maputo_cidade', label: 'Maputo Cidade' },
  { value: 'maputo_provincia', label: 'Maputo Província' },
  { value: 'nampula', label: 'Nampula' },
  { value: 'niassa', label: 'Niassa' },
  { value: 'sofala', label: 'Sofala' },
  { value: 'tete', label: 'Tete' },
  { value: 'zambezia', label: 'Zambézia' },
];

export default function SellerShippingPage() {
  const router = useRouter();
  const [zones, setZones] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // New/edit form state
  const [editingZone, setEditingZone] = useState<any>(null);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ method: '', zone: '', base_price: '0', per_kg_price: '0', free_shipping_min: '', max_weight_kg: '' });

  // Redirect non-physical stores
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch(`${API}/stores/me/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.product_type !== 'physical') {
          router.replace('/seller/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  const apiHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
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
    } catch {
      setError('Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  }, [apiHeaders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Zone actions ───

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('zone');
    try {
      const body = JSON.stringify({ name: editingZone.name, provinces: editingZone.provinces, is_active: true });
      const url = editingZone.id
        ? `${API_URL}/shipping/zones/${editingZone.id}/`
        : `${API_URL}/shipping/zones/`;
      const method = editingZone.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: apiHeaders(), body });
      if (!res.ok) throw new Error('Erro ao guardar zona.');
      setEditingZone(null);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Eliminar esta zona? As tarifas associadas também serão removidas.')) return;
    try {
      await fetch(`${API_URL}/shipping/zones/${id}/`, { method: 'DELETE', headers: apiHeaders() });
      fetchAll();
    } catch { alert('Erro ao eliminar.'); }
  };

  // ─── Method actions ───

  const handleSaveMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('method');
    try {
      const body = JSON.stringify({
        name: editingMethod.name,
        description: editingMethod.description || '',
        estimated_days_min: parseInt(editingMethod.estimated_days_min) || 1,
        estimated_days_max: parseInt(editingMethod.estimated_days_max) || 7,
        is_active: true,
      });
      const url = editingMethod.id
        ? `${API_URL}/shipping/methods/${editingMethod.id}/`
        : `${API_URL}/shipping/methods/`;
      const method = editingMethod.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: apiHeaders(), body });
      if (!res.ok) throw new Error('Erro ao guardar método.');
      setEditingMethod(null);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!confirm('Eliminar este método? As tarifas associadas também serão removidas.')) return;
    try {
      await fetch(`${API_URL}/shipping/methods/${id}/`, { method: 'DELETE', headers: apiHeaders() });
      fetchAll();
    } catch { alert('Erro ao eliminar.'); }
  };

  // ─── Rate actions ───

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('rate');
    try {
      const body = JSON.stringify({
        method: rateForm.method,
        zone: rateForm.zone,
        base_price: rateForm.base_price || '0',
        per_kg_price: rateForm.per_kg_price || '0',
        free_shipping_min: rateForm.free_shipping_min || null,
        max_weight_kg: rateForm.max_weight_kg || null,
        is_active: true,
      });
      const res = await fetch(`${API_URL}/shipping/rates/`, { method: 'POST', headers: apiHeaders(), body });
      if (!res.ok) throw new Error('Erro ao criar tarifa.');
      setShowRateForm(false);
      setRateForm({ method: '', zone: '', base_price: '0', per_kg_price: '0', free_shipping_min: '', max_weight_kg: '' });
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (!confirm('Eliminar esta tarifa?')) return;
    try {
      await fetch(`${API_URL}/shipping/rates/${id}/`, { method: 'DELETE', headers: apiHeaders() });
      fetchAll();
    } catch { alert('Erro ao eliminar.'); }
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={32} message="A carregar..." />
        </div>
      </SellerLayout>
    );
  }

  const totalRatesForMethod = (methodId: string) => rates.filter(r => r.method === methodId).length;

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Configurar Envios</h1>
            <p className="text-sm text-muted-foreground">Defina zonas, métodos e preços de entrega</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Zonas */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2"><MapPin size={18} className="text-accent" /> Zonas de Entrega</h2>
              <button onClick={() => setEditingZone({ name: '', provinces: [] })}
                className="p-1.5 hover:bg-muted rounded-lg text-accent"><Plus size={18} /></button>
            </div>
            {/* Zone form */}
            {editingZone && (
              <form onSubmit={handleSaveZone} className="mb-4 p-3 bg-muted/50 rounded-lg space-y-3">
                <input type="text" placeholder="Nome (ex: Maputo Cidade)" value={editingZone.name}
                  onChange={e => setEditingZone({ ...editingZone, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" required />
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                  {PROVINCES.map(p => (
                    <label key={p.value} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={editingZone.provinces?.includes(p.value)}
                        onChange={e => {
                          const provs = e.target.checked
                            ? [...(editingZone.provinces || []), p.value]
                            : (editingZone.provinces || []).filter((v: string) => v !== p.value);
                          setEditingZone({ ...editingZone, provinces: provs });
                        }} />
                      {p.label}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving === 'zone'}
                    className="px-3 py-1.5 bg-accent text-accent-foreground rounded text-xs font-medium flex items-center gap-1">
                    {saving === 'zone' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                  </button>
                  <button type="button" onClick={() => setEditingZone(null)}
                    className="px-3 py-1.5 border rounded text-xs"><X size={12} /> Cancelar</button>
                </div>
              </form>
            )}
            {/* Zone list */}
            {zones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma zona criada.</p>
            ) : (
              zones.map((z: any) => (
                <div key={z.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{z.name}</p>
                    <p className="text-xs text-muted-foreground">{z.provinces_display?.join(', ')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingZone(z)} className="p-1 hover:bg-muted rounded text-muted-foreground"><Edit3 size={14} /></button>
                    <button onClick={() => handleDeleteZone(z.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Métodos */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2"><Truck size={18} className="text-accent" /> Métodos de Envio</h2>
              <button onClick={() => setEditingMethod({ name: '', description: '', estimated_days_min: '1', estimated_days_max: '7' })}
                className="p-1.5 hover:bg-muted rounded-lg text-accent"><Plus size={18} /></button>
            </div>
            {editingMethod && (
              <form onSubmit={handleSaveMethod} className="mb-4 p-3 bg-muted/50 rounded-lg space-y-3">
                <input type="text" placeholder="Nome (ex: Standard)" value={editingMethod.name}
                  onChange={e => setEditingMethod({ ...editingMethod, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" required />
                <input type="text" placeholder="Descrição (opcional)" value={editingMethod.description || ''}
                  onChange={e => setEditingMethod({ ...editingMethod, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Prazo mínimo (dias)</label>
                    <input type="number" min="1" value={editingMethod.estimated_days_min}
                      onChange={e => setEditingMethod({ ...editingMethod, estimated_days_min: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Prazo máximo (dias)</label>
                    <input type="number" min="1" value={editingMethod.estimated_days_max}
                      onChange={e => setEditingMethod({ ...editingMethod, estimated_days_max: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving === 'method'}
                    className="px-3 py-1.5 bg-accent text-accent-foreground rounded text-xs font-medium flex items-center gap-1">
                    {saving === 'method' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                  </button>
                  <button type="button" onClick={() => setEditingMethod(null)}
                    className="px-3 py-1.5 border rounded text-xs"><X size={12} /> Cancelar</button>
                </div>
              </form>
            )}
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum método criado.</p>
            ) : (
              methods.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.estimated_days_display} · {totalRatesForMethod(m.id)} tarifa(s)</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingMethod(m)} className="p-1 hover:bg-muted rounded text-muted-foreground"><Edit3 size={14} /></button>
                    <button onClick={() => handleDeleteMethod(m.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tarifas */}
        <div className="mt-6 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Tarifas de Envio</h2>
            <button onClick={() => setShowRateForm(true)}
              className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium flex items-center gap-1">
              <Plus size={14} /> Nova Tarifa
            </button>
          </div>

          {showRateForm && (
            <form onSubmit={handleSaveRate} className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Método *</label>
                  <select value={rateForm.method} onChange={e => setRateForm({ ...rateForm, method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" required>
                    <option value="">Selecionar...</option>
                    {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Zona *</label>
                  <select value={rateForm.zone} onChange={e => setRateForm({ ...rateForm, zone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" required>
                    <option value="">Selecionar...</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Preço Base (MZN)</label>
                  <input type="number" step="0.01" min="0" value={rateForm.base_price}
                    onChange={e => setRateForm({ ...rateForm, base_price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Preço por kg (MZN)</label>
                  <input type="number" step="0.01" min="0" value={rateForm.per_kg_price}
                    onChange={e => setRateForm({ ...rateForm, per_kg_price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Grátis acima de (MZN)</label>
                  <input type="number" step="0.01" min="0" value={rateForm.free_shipping_min}
                    onChange={e => setRateForm({ ...rateForm, free_shipping_min: e.target.value })}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Peso máximo (kg)</label>
                  <input type="number" step="0.01" min="0" value={rateForm.max_weight_kg}
                    onChange={e => setRateForm({ ...rateForm, max_weight_kg: e.target.value })}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving === 'rate'}
                  className="px-3 py-1.5 bg-accent text-accent-foreground rounded text-xs font-medium flex items-center gap-1">
                  {saving === 'rate' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Criar Tarifa
                </button>
                <button type="button" onClick={() => setShowRateForm(false)}
                  className="px-3 py-1.5 border rounded text-xs"><X size={12} /> Cancelar</button>
              </div>
            </form>
          )}

          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarifa criada. Crie zonas e métodos primeiro, depois associe tarifas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground text-xs">
                    <th className="py-2 px-2">Método</th>
                    <th className="py-2 px-2">Zona</th>
                    <th className="py-2 px-2">Base</th>
                    <th className="py-2 px-2">/kg</th>
                    <th className="py-2 px-2">Grátis ≥</th>
                    <th className="py-2 px-2">Peso Máx</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r: any) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{r.method_name}</td>
                      <td className="py-2 px-2">{r.zone_name}</td>
                      <td className="py-2 px-2">{Number(r.base_price).toLocaleString()} MZN</td>
                      <td className="py-2 px-2">{Number(r.per_kg_price).toLocaleString()} MZN</td>
                      <td className="py-2 px-2">{r.free_shipping_min ? `${Number(r.free_shipping_min).toLocaleString()} MZN` : '—'}</td>
                      <td className="py-2 px-2">{r.max_weight_kg ? `${r.max_weight_kg} kg` : '—'}</td>
                      <td className="py-2 px-2">
                        <button onClick={() => handleDeleteRate(r.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
