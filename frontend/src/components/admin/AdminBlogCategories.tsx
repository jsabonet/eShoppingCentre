'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Edit3, LoaderCircle, Plus, Tag, Trash2, X } from 'lucide-react';
import { adminAPI, type BlogCategory } from '@/src/lib/api';
import { toast } from '@/src/lib/toast';

const EMPTY_FORM = { name: '', description: '' };

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
    const message = Object.values(error.response.data as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .find((value): value is string => typeof value === 'string');
    if (message) return message;
  }
  return 'Não foi possível concluir a operação. Verifique a ligação e tente novamente.';
}

export default function AdminBlogCategories() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<BlogCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminAPI.listBlogCategories({ page_size: 100 });
      setCategories(data.results);
    } catch (loadError) {
      console.error('Não foi possível carregar as categorias do blog.', loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const openCreateForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError('');
  };

  const openEditForm = (category: BlogCategory) => {
    setEditing(category);
    setForm({ name: category.name, description: category.description });
    setFormOpen(true);
    setError('');
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() };
      if (editing) {
        await adminAPI.updateBlogCategory(editing.id, payload);
      } else {
        await adminAPI.createBlogCategory(payload);
      }
      setFormOpen(false);
      toast.success(editing ? 'Categoria atualizada' : 'Categoria criada');
      await loadCategories();
    } catch (saveError) {
      console.error('Não foi possível guardar a categoria do blog.', saveError);
      const message = getErrorMessage(saveError);
      setError(message);
      toast.error('Não foi possível guardar a categoria', message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: BlogCategory) => {
    if (!window.confirm(`Eliminar a categoria "${category.name}"?`)) return;
    setError('');
    try {
      await adminAPI.deleteBlogCategory(category.id);
      toast.success('Categoria eliminada');
      await loadCategories();
    } catch (deleteError) {
      console.error('Não foi possível eliminar a categoria do blog.', deleteError);
      const message = getErrorMessage(deleteError);
      setError(message);
      toast.error('Não foi possível eliminar a categoria', message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Categorias do blog</h3>
          <p className="text-sm text-slate-500">Organize os artigos sem alterar as categorias dos produtos.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
        >
          <Plus size={16} /> Nova categoria
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void loadCategories()} className="shrink-0 font-semibold underline">Tentar novamente</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500"><LoaderCircle size={22} className="animate-spin" /></div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Tag size={24} className="mx-auto text-slate-400" />
          <p className="mt-3 font-medium text-slate-700">Ainda não existem categorias do blog.</p>
          <p className="mt-1 text-sm text-slate-500">Crie uma categoria para a selecionar nos artigos.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <ul className="divide-y divide-slate-100">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{category.name}</p>
                  <p className="text-xs text-slate-500">
                    {category.post_count} {category.post_count === 1 ? 'artigo' : 'artigos'}
                    {category.description ? ` · ${category.description}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openEditForm(category)} aria-label={`Editar ${category.name}`} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    <Edit3 size={16} />
                  </button>
                  <button type="button" onClick={() => void deleteCategory(category)} aria-label={`Eliminar ${category.name}`} className="rounded p-2 text-red-600 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {formOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setFormOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="blog-category-form-title" className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 id="blog-category-form-title" className="font-bold">{editing ? 'Editar categoria do blog' : 'Nova categoria do blog'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={saveCategory} className="space-y-4 p-4">
              <label className="block text-sm font-medium">
                Nome *
                <input
                  autoFocus
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-medium">
                Descrição
                <textarea
                  maxLength={500}
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 font-normal"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={saving} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60">
                  {saving && <LoaderCircle size={16} className="animate-spin" />}
                  {editing ? 'Guardar alterações' : 'Criar categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
