'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Edit, Trash2, Home, Briefcase } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';
import { usersAPI } from '@/src/lib/api';

export default function AddressesPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', street: '', city: '', province: 'Maputo', phone: '', type: 'other' });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login?redirect=/account/addresses'); return; }
    if (isAuthenticated) { loadAddresses(); }
  }, [isAuthenticated, authLoading]);

  const loadAddresses = async () => {
    try {
      const { data } = await usersAPI.myAddresses();
      setAddresses(Array.isArray(data) ? data : (data as any).results || []);
    } catch {} finally { setLoading(false); }
  };

  const handleAddAddress = async () => {
    if (!form.street) { alert('Preencha o endereço.'); return; }
    try {
      await usersAPI.addAddress(form);
      setShowForm(false);
      setForm({ label: '', street: '', city: '', province: 'Maputo', phone: '', type: 'other' });
      loadAddresses();
    } catch { alert('Erro ao adicionar endereço.'); }
  };

  if (authLoading) {
    return <AccountLayout><LoadingSpinner size={32} message="A carregar endereços..." /></AccountLayout>;
  }

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Meus Endereços</h2>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
            <Plus size={16} /> Novo Endereço
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold mb-4">Adicionar Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Endereço</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ex: Casa, Trabalho" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input type="text" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Rua/Av, número" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cidade</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Província</label>
                <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option>Maputo</option><option>Gaza</option><option>Inhambane</option><option>Sofala</option>
                  <option>Manica</option><option>Tete</option><option>Zambézia</option><option>Nampula</option>
                  <option>Cabo Delgado</option><option>Niassa</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              {['home', 'work', 'other'].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="type" value={t} checked={form.type === t} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="accent-accent" />
                  {t === 'home' ? '🏠 Casa' : t === 'work' ? '💼 Trabalho' : '📍 Outro'}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleAddAddress} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90">Salvar</button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner size={24} message="A carregar..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.length === 0 && !loading && (
              <div className="col-span-2 text-center py-12 text-muted-foreground">Nenhum endereço cadastrado.</div>
            )}
            {addresses.map((addr: any) => (
              <div key={addr.id} className={`bg-card border ${addr.is_default ? 'border-accent' : 'border-border'} rounded-xl p-5 relative`}>
                {addr.is_default && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-medium">Padrão</span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${addr.type === 'home' ? 'bg-green-100' : addr.type === 'work' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {addr.type === 'home' ? <Home size={16} className="text-green-700" /> : addr.type === 'work' ? <Briefcase size={16} className="text-blue-700" /> : <MapPin size={16} className="text-gray-600" />}
                  </div>
                  <span className="font-medium">{addr.label || 'Endereço'}</span>
                </div>
                <p className="text-sm text-muted-foreground">{addr.street}</p>
                <p className="text-sm text-muted-foreground">{addr.city}, {addr.province}</p>
                <p className="text-sm text-muted-foreground">{addr.phone}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
