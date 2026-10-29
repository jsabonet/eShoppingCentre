'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Edit, Eye, MousePointer2, Plus, Trash2, X } from 'lucide-react';
import { adminAPI, getMediaUrl } from '@/src/lib/api';

type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
type DisplayStatus = CampaignStatus | 'scheduled' | 'published' | 'expired';

interface Campaign {
  id: string;
  internal_name: string;
  image: string;
  mobile_image: string | null;
  alt_text: string;
  title: string;
  subtitle: string;
  cta: string;
  target_url: string;
  starts_at: string;
  ends_at: string;
  priority: number;
  status: CampaignStatus;
  display_status: DisplayStatus;
  view_count: number;
  click_count: number;
  created_at: string;
}

interface CampaignForm {
  internal_name: string;
  alt_text: string;
  title: string;
  subtitle: string;
  cta: string;
  target_url: string;
  starts_at: string;
  ends_at: string;
  priority: string;
  status: CampaignStatus;
}

interface CampaignHistory {
  id: string;
  action: string;
  changes: Record<string, unknown>;
  actor_name: string;
  created_at: string;
}

const EMPTY_FORM: CampaignForm = {
  internal_name: '',
  alt_text: '',
  title: '',
  subtitle: '',
  cta: '',
  target_url: '/',
  starts_at: '',
  ends_at: '',
  priority: '0',
  status: 'draft',
};

const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa (fora do período)',
  scheduled: 'Agendada',
  published: 'Publicada',
  paused: 'Pausada',
  archived: 'Arquivada',
  expired: 'Expirada',
};

function dateTimeForMaputo(value: string) {
  if (!value) return '';
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Maputo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function maputoDateTimeToIso(value: string) {
  if (!value) return '';
  return new Date(`${value}:00+02:00`).toISOString();
}

function errorMessage(error: unknown) {
  const responseData = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (responseData) {
    return Object.entries(responseData)
      .map(([field, messages]) => {
        const detail = Array.isArray(messages) ? messages.join(' ') : String(messages);
        return field === 'detail' || field === 'non_field_errors' ? detail : `${field}: ${detail}`;
      })
      .join(' ');
  }
  return 'Não foi possível concluir a operação. Verifique a ligação e tente novamente.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-MZ', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Africa/Maputo',
  }).format(new Date(value));
}

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [desktopPreview, setDesktopPreview] = useState('');
  const [mobilePreview, setMobilePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<CampaignHistory[]>([]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminAPI.listCampaigns({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setCampaigns(Array.isArray(data) ? data : data.results || []);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCampaigns(), 250);
    return () => window.clearTimeout(timer);
  }, [loadCampaigns]);

  useEffect(() => {
    const desktopUrl = desktopFile
      ? URL.createObjectURL(desktopFile)
      : editing?.image ? getMediaUrl(editing.image) || editing.image : '';
    const mobileUrl = mobileFile
      ? URL.createObjectURL(mobileFile)
      : editing?.mobile_image ? getMediaUrl(editing.mobile_image) || editing.mobile_image : desktopUrl;
    setDesktopPreview(desktopUrl);
    setMobilePreview(mobileUrl);
    return () => {
      if (desktopFile && desktopUrl) URL.revokeObjectURL(desktopUrl);
      if (mobileFile && mobileUrl && mobileUrl !== desktopUrl) URL.revokeObjectURL(mobileUrl);
    };
  }, [desktopFile, mobileFile, editing]);

  const openNew = () => {
    setFormOpen(true);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDesktopFile(null);
    setMobileFile(null);
    setError('');
    setSuccess('');
  };

  const openEdit = (campaign: Campaign) => {
    setFormOpen(true);
    setEditing(campaign);
    setForm({
      internal_name: campaign.internal_name,
      alt_text: campaign.alt_text,
      title: campaign.title || '',
      subtitle: campaign.subtitle || '',
      cta: campaign.cta || '',
      target_url: campaign.target_url,
      starts_at: dateTimeForMaputo(campaign.starts_at),
      ends_at: dateTimeForMaputo(campaign.ends_at),
      priority: String(campaign.priority),
      status: campaign.status,
    });
    setDesktopFile(null);
    setMobileFile(null);
    setError('');
    setSuccess('');
  };

  const saveCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!editing && !desktopFile) {
      setError('Selecione a imagem principal do banner.');
      return;
    }
    if (!form.starts_at || !form.ends_at) {
      setError('Indique as datas de início e fim no horário de Moçambique.');
      return;
    }

    const payload = new FormData();
    payload.append('internal_name', form.internal_name.trim());
    payload.append('alt_text', form.alt_text.trim());
    payload.append('title', form.title.trim());
    payload.append('subtitle', form.subtitle.trim());
    payload.append('cta', form.cta.trim());
    payload.append('target_url', form.target_url.trim());
    payload.append('starts_at', maputoDateTimeToIso(form.starts_at));
    payload.append('ends_at', maputoDateTimeToIso(form.ends_at));
    payload.append('priority', String(Number(form.priority) || 0));
    payload.append('status', form.status);
    if (desktopFile) payload.append('image', desktopFile);
    if (mobileFile) payload.append('mobile_image', mobileFile);

    setSaving(true);
    try {
      if (editing) await adminAPI.updateCampaign(editing.id, payload);
      else await adminAPI.createCampaign(payload);
      setSuccess(editing ? 'Campanha atualizada.' : 'Campanha criada.');
      setFormOpen(false);
      setEditing(null);
      await loadCampaigns();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (campaign: Campaign, status: CampaignStatus) => {
    setError('');
    setSuccess('');
    try {
      await adminAPI.updateCampaign(campaign.id, { status });
      setSuccess(`Campanha ${STATUS_LABELS[status].toLowerCase()}.`);
      await loadCampaigns();
    } catch (statusError) {
      setError(errorMessage(statusError));
    }
  };

  const activateNow = async (campaign: Campaign) => {
    if (!window.confirm(`Ativar "${campaign.internal_name}" imediatamente? A campanha ficará visível até à data de fim configurada.`)) return;
    setError('');
    setSuccess('');
    try {
      await adminAPI.activateCampaignNow(campaign.id);
      setSuccess(`Campanha "${campaign.internal_name}" ativada imediatamente.`);
      await loadCampaigns();
    } catch (activationError) {
      setError(errorMessage(activationError));
    }
  };

  const removeCampaign = async (campaign: Campaign) => {
    if (!window.confirm(`Eliminar a campanha "${campaign.internal_name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await adminAPI.deleteCampaign(campaign.id);
      setSuccess('Campanha eliminada.');
      await loadCampaigns();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  const toggleHistory = async (campaignId: string) => {
    if (historyFor === campaignId) {
      setHistoryFor(null);
      return;
    }
    setError('');
    try {
      const { data } = await adminAPI.campaignHistory(campaignId);
      setHistory(Array.isArray(data) ? data : data.results || []);
      setHistoryFor(campaignId);
    } catch (historyError) {
      setError(errorMessage(historyError));
    }
  };

  const overlappingCampaigns = form.starts_at && form.ends_at
    ? campaigns.filter(campaign =>
        campaign.id !== editing?.id
        && campaign.status === 'active'
        && Date.parse(campaign.starts_at) < Date.parse(maputoDateTimeToIso(form.ends_at))
        && Date.parse(campaign.ends_at) > Date.parse(maputoDateTimeToIso(form.starts_at)),
      )
    : [];

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Banners e campanhas</h2>
          <p className="text-sm text-muted-foreground">Agende conteúdos da homepage no horário de Moçambique.</p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
          <Plus size={16} /> Nova campanha
        </button>
      </header>

      <details className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <summary className="cursor-pointer font-semibold">Como usar campanhas e preparar as imagens</summary>
        <div className="mt-3 space-y-3">
          <p>Crie uma campanha com destino e texto alternativo, escolha as datas no horário de Moçambique e guarde como rascunho ou agende como ativa. Use <strong>Ativar agora</strong> para publicar imediatamente; a data de fim continua válida. Todos os banners ativos aparecem no carrossel, ordenados pela prioridade.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <thead><tr className="border-b border-blue-200"><th className="py-1 pr-3">Formato</th><th className="py-1 pr-3">Tamanho recomendado</th><th className="py-1">Proporção</th></tr></thead>
              <tbody>
                <tr><td className="py-1 pr-3">Computador (imagem principal)</td><td className="py-1 pr-3">1920 × 640 px</td><td className="py-1">3:1</td></tr>
                <tr><td className="py-1 pr-3">Telemóvel (imagem alternativa)</td><td className="py-1 pr-3">900 × 600 px</td><td className="py-1">3:2</td></tr>
                <tr><td className="py-1 pr-3">Tablet (usa a imagem principal)</td><td className="py-1 pr-3">1920 × 640 px</td><td className="py-1">Cortada para 2:1</td></tr>
              </tbody>
            </table>
          </div>
          <p>JPG, PNG e WebP são aceites até 10 MB por imagem. O sistema redimensiona e converte as imagens para WebP. Como o banner pode ser recortado para caber, mantenha produtos e elementos importantes no centro. Título, descrição e botão são sobrepostos à imagem; não os grave também no ficheiro. Recomenda-se otimizar imagens para cerca de 300 KB para acelerar o envio e o carregamento em redes móveis.</p>
          <p>As alterações podem levar até 30 segundos a aparecer na homepage. Não existe uma imagem separada para tablet; a imagem principal é ajustada para esse formato.</p>
        </div>
      </details>

      {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={18} className="shrink-0" />{error}</div>}
      {success && <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</p>}

      {formOpen ? (
        <form onSubmit={saveCampaign} className="space-y-4 rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? 'Editar campanha' : 'Nova campanha'}</h3>
            <button type="button" onClick={() => { setFormOpen(false); setEditing(null); }} aria-label="Fechar formulário"><X size={18} /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">Nome interno *
              <input required maxLength={150} value={form.internal_name} onChange={event => setForm({ ...form, internal_name: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Destino do clique *
              <input required maxLength={1000} value={form.target_url} onChange={event => setForm({ ...form, target_url: event.target.value })} placeholder="/categoria/eletronicos" className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Imagem para computador {editing ? '(opcional para manter a atual)' : '*'}
              <input required={!editing} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setDesktopFile(event.target.files?.[0] || null)} className="block w-full rounded-md border border-border px-3 py-2" />
              <span className="block text-xs text-muted-foreground">Recomendado: 1920 × 640 px (3:1); até 10 MB. O sistema converte para WebP.</span>
              {editing?.image && <img src={getMediaUrl(editing.image) || editing.image} alt={editing.alt_text} className="mt-2 h-20 w-40 rounded object-cover" />}
            </label>
            <label className="space-y-1 text-sm">Imagem para telemóvel (opcional)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setMobileFile(event.target.files?.[0] || null)} className="block w-full rounded-md border border-border px-3 py-2" />
              <span className="block text-xs text-muted-foreground">Recomendado: 900 × 600 px (3:2); até 10 MB. Usada em ecrãs com menos de 640 px.</span>
              {editing?.mobile_image && <img src={getMediaUrl(editing.mobile_image) || editing.mobile_image} alt="" className="mt-2 h-20 w-24 rounded object-cover" />}
            </label>
            <label className="space-y-1 text-sm">Texto alternativo *
              <input required maxLength={300} value={form.alt_text} onChange={event => setForm({ ...form, alt_text: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Título
              <input maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Descrição
              <input maxLength={500} value={form.subtitle} onChange={event => setForm({ ...form, subtitle: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Texto do botão
              <input maxLength={80} value={form.cta} onChange={event => setForm({ ...form, cta: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Início (Africa/Maputo) *
              <input type="datetime-local" required value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Fim (Africa/Maputo) *
              <input type="datetime-local" required value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Prioridade
              <input type="number" value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })} className="w-full rounded-md border border-border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">Estado
              <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as CampaignStatus })} className="w-full rounded-md border border-border px-3 py-2">
                <option value="draft">Rascunho</option>
                <option value="active">Ativa / agendar</option>
                <option value="paused">Pausada</option>
                <option value="archived">Arquivada</option>
              </select>
            </label>
          </div>
          {overlappingCampaigns.length > 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este período sobrepõe-se a {overlappingCampaigns.length} campanha(s) ativa(s). A campanha elegível de maior prioridade será exibida.
            </p>
          )}
          {(desktopPreview || mobilePreview) && (
            <div className="rounded-lg border border-border bg-slate-50 p-4">
              <h4 className="mb-3 text-sm font-semibold">Pré-visualização</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Computador</p>
                  <div className="relative aspect-[3/1] overflow-hidden rounded-md bg-slate-200">
                    <img src={desktopPreview} alt={form.alt_text} className="h-full w-full object-cover" />
                    {(form.title || form.subtitle || form.cta) && <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/60 to-transparent p-4 text-white"><strong>{form.title}</strong><span className="text-sm">{form.subtitle}</span>{form.cta && <span className="mt-2 w-fit rounded bg-white px-3 py-1 text-xs text-slate-900">{form.cta}</span>}</div>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Telemóvel</p>
                  <div className="relative mx-auto aspect-[3/4] max-w-48 overflow-hidden rounded-md bg-slate-200">
                    <img src={mobilePreview} alt={form.alt_text} className="h-full w-full object-cover" />
                    {(form.title || form.subtitle || form.cta) && <div className="absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-black/70 to-transparent p-3 text-white"><strong className="text-sm">{form.title}</strong><span className="text-xs">{form.subtitle}</span>{form.cta && <span className="mt-2 w-fit rounded bg-white px-2 py-1 text-xs text-slate-900">{form.cta}</span>}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setFormOpen(false); setEditing(null); }} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60">{saving ? 'A guardar...' : 'Guardar campanha'}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 sm:flex-row">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar campanha..." className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm" />
          <select aria-label="Filtrar por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-md border border-border px-3 py-2 text-sm">
            <option value="">Todos os estados</option>
            <option value="draft">Rascunho</option>
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
            <option value="archived">Arquivada</option>
          </select>
        </div>
      )}

      {!formOpen && (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          {loading ? <p className="p-6 text-sm text-muted-foreground">A carregar campanhas...</p> : campaigns.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Ainda não existem campanhas. Crie uma para atualizar o banner da homepage.</p>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Campanha</th><th className="p-3">Estado</th><th className="p-3">Período (Maputo)</th><th className="p-3">Prioridade</th><th className="p-3">Resultados</th><th className="p-3">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map(campaign => (
                  <tr key={campaign.id}>
                    <td className="p-3"><div className="flex items-center gap-3"><img src={getMediaUrl(campaign.image) || campaign.image} alt="" className="h-12 w-20 rounded object-cover" /><div><p className="font-medium">{campaign.internal_name}</p><p className="max-w-52 truncate text-xs text-muted-foreground">{campaign.target_url}</p></div></div></td>
                    <td className="p-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{STATUS_LABELS[campaign.display_status]}</span></td>
                    <td className="p-3 text-xs">{formatDate(campaign.starts_at)}<br />até {formatDate(campaign.ends_at)}</td>
                    <td className="p-3">{campaign.priority}</td>
                    <td className="p-3"><span className="inline-flex items-center gap-1"><Eye size={14} />{campaign.view_count}</span><br /><span className="inline-flex items-center gap-1"><MousePointer2 size={14} />{campaign.click_count}</span><br /><span className="text-xs text-muted-foreground">CTR: {campaign.view_count ? ((campaign.click_count / campaign.view_count) * 100).toFixed(2) : '0.00'}%</span></td>
                    <td className="p-3"><div className="flex items-center gap-1">
                      <button type="button" title="Editar" onClick={() => openEdit(campaign)} className="rounded p-2 hover:bg-muted"><Edit size={16} /></button>
                      <button type="button" title="Histórico" onClick={() => void toggleHistory(campaign.id)} className="rounded p-2 hover:bg-muted"><CalendarClock size={16} /></button>
                      {campaign.status === 'active' && campaign.display_status !== 'scheduled' ? <button type="button" title="Pausar" onClick={() => void changeStatus(campaign, 'paused')} className="rounded px-2 py-1 text-xs hover:bg-muted">Pausar</button> : campaign.status === 'paused' || campaign.status === 'draft' || campaign.display_status === 'scheduled' ? <button type="button" title="Ativar imediatamente" onClick={() => void activateNow(campaign)} className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200">Ativar agora</button> : null}
                      <button type="button" title="Eliminar" onClick={() => void removeCampaign(campaign)} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
              {historyFor && <tfoot><tr><td colSpan={6} className="bg-slate-50 p-4"><div className="mb-2 flex items-center justify-between font-semibold">Histórico de alterações<button onClick={() => setHistoryFor(null)} aria-label="Fechar histórico"><X size={16} /></button></div>{history.length ? <ul className="space-y-1 text-xs">{history.map(item => <li key={item.id}>{formatDate(item.created_at)} — {item.actor_name} — {item.action} — {JSON.stringify(item.changes)}</li>)}</ul> : <p className="text-xs text-muted-foreground">Sem histórico disponível.</p>}</td></tr></tfoot>}
            </table>
          )}
        </div>
      )}
    </section>
  );
}
