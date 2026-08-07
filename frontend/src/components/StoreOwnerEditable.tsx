"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Pencil, Check, X, Store, Star, MapPin, Package, TrendingUp, Users, ChevronDown, ChevronUp } from "lucide-react";
import { storesAPI } from "@/src/lib/api";
import StoreActions from "./StoreActions";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8000";

function mediaUrl(path: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

interface StoreData {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logo: string | null;
  banner: string | null;
  theme_color: string;
  location: string;
  rating: number;
  total_products: number;
  total_sales: number;
  followers_count?: number;
  product_type?: string;
  review_count?: number;
}

interface Props {
  store: StoreData;
}

export default function StoreOwnerEditable({ store }: Props) {
  const [isOwner, setIsOwner] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingTagline, setEditingTagline] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [name, setName] = useState(store.name);
  const [tagline, setTagline] = useState(store.tagline);
  const [bannerUrl, setBannerUrl] = useState(mediaUrl(store.banner));
  const [logoUrl, setLogoUrl] = useState(mediaUrl(store.logo));
  const [saving, setSaving] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Check ownership on mount — runs in background, doesn't block rendering
  useEffect(() => {
    (async () => {
      try {
        const { data } = await storesAPI.myStore();
        if (data.id === store.id) setIsOwner(true);
      } catch {}
    })();
  }, []);

  // ─── Save helpers ───
  const saveField = useCallback(async (field: string, value: string) => {
    setSaving(true);
    try {
      await storesAPI.updateMyStore({ [field]: value });
    } catch { /* silent */ }
    setSaving(false);
  }, []);

  const uploadImage = useCallback(async (field: "logo" | "banner", file: File) => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append(field, file);
      const token = localStorage.getItem("access_token");
      await axios.patch(`${API_URL}/stores/me/`, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      // Refresh preview
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === "banner") setBannerUrl(reader.result as string);
        else setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch {}
    setSaving(false);
  }, [store.slug]);

  const themeColor = store.theme_color || "#2563eb";

  return (
    <>
      {/* Banner Section */}
      <div className={isOwner ? "relative group/banner" : "relative"}>
        {bannerUrl ? (
          <div className="w-full h-48 md:h-64 overflow-hidden">
            <img src={bannerUrl} alt={name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-48 md:h-64 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}22, ${themeColor}44)` }}>
            <Store size={64} className="text-muted-foreground/30" />
          </div>
        )}
        {/* Edit overlay — only for owner */}
        {isOwner && (
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover/banner:opacity-100 transition-opacity">
          <label className="px-3 py-1.5 bg-black/60 text-white text-xs rounded-lg hover:bg-black/80 cursor-pointer flex items-center gap-1.5">
            <Camera size={12} /> Alterar Capa
            <input ref={bannerRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("banner", f); }} />
          </label>
          {bannerUrl && (
            <button onClick={() => { setBannerUrl(""); saveField("banner", ""); }}
              className="px-3 py-1.5 bg-red-500/80 text-white text-xs rounded-lg hover:bg-red-600">
              Remover
            </button>
          )}
        </div>
        )}
      </div>

      {/* Logo + Info + Actions — Compact Header */}
      <div className="max-w-[1500px] mx-auto px-4 py-6">
        <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 ${bannerUrl ? "-mt-12" : ""} relative z-10`}>
          {/* Logo */}
          <div className={isOwner ? "relative group/logo shrink-0" : "relative shrink-0"}>
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-white">
              {logoUrl ? (
                <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: themeColor }}>
                  {name?.charAt(0) || "L"}
                </div>
              )}
            </div>
            {isOwner && (
            <label className="absolute inset-0 bg-black/50 text-white flex items-center justify-center rounded-xl opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer">
              <Camera size={18} />
              <input ref={logoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("logo", f); }} />
            </label>
            )}
          </div>

          {/* Name + Tagline + Stats + Description */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className={`flex items-center gap-2 ${isOwner ? "group/name" : ""}`}>
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="text-2xl md:text-3xl font-bold bg-background border border-border rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-md"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { saveField("name", name); setEditingName(false); }
                      if (e.key === "Escape") { setName(store.name); setEditingName(false); }
                    }} />
                  <button onClick={() => { saveField("name", name); setEditingName(false); }}
                    className="p-1.5 bg-green-500 text-white rounded-md"><Check size={14} /></button>
                  <button onClick={() => { setName(store.name); setEditingName(false); }}
                    className="p-1.5 bg-gray-300 text-gray-700 rounded-md"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl md:text-3xl font-bold">{name}</h1>
                  {isOwner && (
                  <button onClick={() => setEditingName(true)}
                    className="p-1 opacity-0 group-hover/name:opacity-100 hover:bg-muted rounded transition-all">
                    <Pencil size={14} className="text-muted-foreground" />
                  </button>
                  )}
                </>
              )}
            </div>

            {/* Tagline */}
            <div className={`flex items-center gap-2 mt-0.5 ${isOwner ? "group/tagline" : ""}`}>
              {editingTagline ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
                    placeholder="Slogan da loja..."
                    className="text-sm bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { saveField("tagline", tagline); setEditingTagline(false); }
                      if (e.key === "Escape") { setTagline(store.tagline); setEditingTagline(false); }
                    }} />
                  <button onClick={() => { saveField("tagline", tagline); setEditingTagline(false); }}
                    className="p-1 bg-green-500 text-white rounded-md"><Check size={12} /></button>
                  <button onClick={() => { setTagline(store.tagline); setEditingTagline(false); }}
                    className="p-1 bg-gray-300 text-gray-700 rounded-md"><X size={12} /></button>
                </div>
              ) : (
                <>
                  {tagline ? (
                    <p className="text-sm text-muted-foreground">{tagline}</p>
                  ) : (
                    isOwner ? <p className="text-sm text-muted-foreground/50 italic">Adicionar slogan...</p> : null
                  )}
                  {isOwner && (
                  <button onClick={() => setEditingTagline(true)}
                    className="p-0.5 opacity-0 group-hover/tagline:opacity-100 hover:bg-muted rounded transition-all">
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                  )}
                </>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Star size={14} className="text-amber-500 fill-amber-500" /> {store.rating.toFixed(1)}</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {store.location || "Moçambique"}</span>
              <span className="flex items-center gap-1"><Package size={14} /> {store.total_products || 0} produtos</span>
              <span className="flex items-center gap-1"><TrendingUp size={14} /> {store.total_sales || 0} vendas</span>
              <span className="flex items-center gap-1"><Users size={14} /> {store.followers_count ?? 0} seguidores</span>
              {(store.review_count ?? 0) > 0 && (
                <span className="flex items-center gap-1"><Star size={14} className="text-amber-500" /> {store.review_count} reviews</span>
              )}
            </div>

            {/* Description — collapsible */}
            {store.description && (
              <div className="mt-2">
                <button onClick={() => setShowFullDesc(!showFullDesc)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {showFullDesc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showFullDesc ? 'Menos informacoes' : 'Sobre a loja'}
                </button>
                {showFullDesc && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">{store.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Actions — only for visitors */}
          {!isOwner && (
            <div className="shrink-0 self-start mt-2 sm:mt-0">
              <StoreActions
                storeId={store.id}
                storeSlug={store.slug}
                storeName={store.name}
                storeType={(store.product_type as 'physical' | 'digital' | 'course') || 'physical'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-accent text-accent-foreground px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          A guardar...
        </div>
      )}
    </>
  );
}
