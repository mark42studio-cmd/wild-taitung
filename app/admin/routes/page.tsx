'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const THEME_OPTIONS = [
  { value: 'ocean',    label: '🌊 海洋' },
  { value: 'mountain', label: '🏔️ 山林' },
  { value: 'city',     label: '🌆 城市' },
  { value: 'rail',     label: '🚂 南迴' },
  { value: 'islands',  label: '⛴️ 離島' },
] as const;

type RouteDraft = {
  id?: string;
  title: string;
  cover_image: string;
  theme: string;
  days: string;
  affiliate_link: string;
  description: string;
};

const emptyDraft: RouteDraft = {
  title: '', cover_image: '', theme: 'ocean', days: '3', affiliate_link: '', description: '',
};

type RouteRecord = {
  id: string;
  title: string;
  cover_image: string | null;
  theme: string;
  days: number;
  affiliate_link: string | null;
  description: string | null;
};

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [draft, setDraft] = useState<RouteDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('curated_routes')
      .select('id,title,cover_image,theme,days,affiliate_link,description')
      .order('title');
    if (error) {
      setError(error.message);
    } else {
      setRoutes((data ?? []) as RouteRecord[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft.title.trim() || !draft.theme) { setError('請填寫標題與主題。'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title:         draft.title.trim(),
      cover_image:   draft.cover_image.trim() || null,
      theme:         draft.theme,
      days:          parseInt(draft.days, 10) || 3,
      affiliate_link: draft.affiliate_link.trim() || null,
      description:   draft.description.trim() || null,
    };
    const result = draft.id
      ? await supabase.from('curated_routes').update(payload).eq('id', draft.id)
      : await supabase.from('curated_routes').insert([payload]);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setDraft(emptyDraft);
    load();
  }

  async function del(id: string) {
    if (!window.confirm('確定刪除此遊程？')) return;
    const { error } = await supabase.from('curated_routes').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    if (draft.id === id) setDraft(emptyDraft);
    load();
  }

  const themeEmoji: Record<string, string> = {
    ocean: '🌊', mountain: '🏔️', city: '🌆', rail: '🚂', islands: '⛴️',
  };

  return (
    <div className="text-[#1B2E26]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-black">冒險遊程管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理「命運三選一」的策畫遊程與分潤連結</p>
        </div>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft)}
            className="inline-flex items-center gap-2 rounded-full bg-[#1B2E26] px-4 py-2 text-sm font-black text-[#F5F5DC] hover:bg-[#2d3a30] transition-colors"
          >
            <Plus size={15} /> 新增遊程
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {/* Draft Form */}
        <section className="mb-6 rounded-2xl border border-[#d8cda5] bg-white/75 p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-700 text-sm">{draft.id ? '編輯遊程' : '新增遊程'}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.title}
              onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
              placeholder="遊程標題（例：海岸三日野放）"
              className="rounded-xl border border-[#d8cda5] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#8d5a2b]"
            />
            <div className="flex gap-3">
              <select
                value={draft.theme}
                onChange={e => setDraft(p => ({ ...p, theme: e.target.value }))}
                className="flex-1 rounded-xl border border-[#d8cda5] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#8d5a2b]"
              >
                {THEME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={14}
                value={draft.days}
                onChange={e => setDraft(p => ({ ...p, days: e.target.value }))}
                placeholder="天數"
                className="w-24 rounded-xl border border-[#d8cda5] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#8d5a2b]"
              />
            </div>
            <input
              value={draft.cover_image}
              onChange={e => setDraft(p => ({ ...p, cover_image: e.target.value }))}
              placeholder="封面圖片 URL（https://...）"
              className="rounded-xl border border-[#d8cda5] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#8d5a2b]"
            />
            <input
              value={draft.affiliate_link}
              onChange={e => setDraft(p => ({ ...p, affiliate_link: e.target.value }))}
              placeholder="🔗 統包分潤連結（Klook / KKday 等）"
              className="rounded-xl border border-amber-200 bg-amber-50/30 px-3 py-2.5 text-sm font-bold outline-none focus:border-amber-400 text-amber-800 placeholder:text-amber-400/60"
            />
            <textarea
              value={draft.description}
              onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
              placeholder="遊程簡介（選填）"
              rows={2}
              className="md:col-span-2 rounded-xl border border-[#d8cda5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8d5a2b] resize-none"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-5 py-2 text-sm font-black text-white disabled:opacity-50 hover:bg-stone-700 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {draft.id ? '更新遊程' : '建立遊程'}
          </button>
        </section>

        {/* Route List */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm font-black text-[#8d5a2b]">
            <Loader2 size={16} className="animate-spin" /> 載入中
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-2xl mb-2">🗺️</p>
            <p className="font-bold">尚無遊程資料</p>
            <p className="text-sm mt-1">點擊「新增遊程」開始建立冒險行程</p>
            <p className="text-xs mt-3 text-gray-300">提示：需在 Supabase 建立 <code className="bg-gray-100 px-1 rounded">curated_routes</code> 資料表</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {routes.map(route => (
              <article key={route.id} className="rounded-2xl border border-[#d8cda5] bg-white/80 p-4 shadow-sm">
                {route.cover_image && (
                  <img src={route.cover_image} alt={route.title} className="mb-3 h-36 w-full rounded-xl object-cover" />
                )}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{themeEmoji[route.theme] ?? '🗺️'}</span>
                    <h2 className="font-serif text-lg font-black">{route.title}</h2>
                  </div>
                  <p className="text-xs text-gray-500">{route.days} 天行程 · {route.theme}</p>
                  {route.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{route.description}</p>
                  )}
                </div>
                {route.affiliate_link && (
                  <a
                    href={route.affiliate_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:underline mb-3 truncate"
                  >
                    <ExternalLink size={10} /> {route.affiliate_link.replace('https://', '')}
                  </a>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({
                      id: route.id,
                      title: route.title,
                      cover_image: route.cover_image ?? '',
                      theme: route.theme,
                      days: String(route.days),
                      affiliate_link: route.affiliate_link ?? '',
                      description: route.description ?? '',
                    })}
                    className="flex-1 rounded-full bg-[#1B2E26] px-4 py-2 text-xs font-black text-[#F5F5DC] hover:bg-[#2d3a30] transition-colors"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={() => del(route.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={13} /> 刪除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
    </div>
  );
}
