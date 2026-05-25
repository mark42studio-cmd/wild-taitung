'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AffiliatePackage } from '@/types';

const REGION_OPTIONS = [
  { value: 'mtn', label: '山' },
  { value: 'sea', label: '海' },
  { value: 'city', label: '市' },
  { value: 'rail', label: '南' },
  { value: 'islands', label: '離' },
] as const;

type PackageDraft = {
  id?: string;
  title: string;
  image_url: string;
  link_url: string;
  category_match: string;
};

const emptyDraft: PackageDraft = {
  title: '',
  image_url: '',
  link_url: '',
  category_match: 'sea',
};

export default function AdminAffiliatesPage() {
  const [packages, setPackages] = useState<AffiliatePackage[]>([]);
  const [draft, setDraft] = useState<PackageDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadPackages() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('affiliate_packages')
      .select('id, title, image_url, link_url, category_match')
      .order('title', { ascending: true });

    if (error) setError(error.message);
    else setPackages((data ?? []) as AffiliatePackage[]);
    setLoading(false);
  }

  useEffect(() => {
    loadPackages();
  }, []);

  async function savePackage() {
    if (!draft.title.trim() || !draft.link_url.trim()) {
      setError('請填寫標題與跳轉連結。');
      return;
    }

    setSaving(true);
    setError('');
    const payload = {
      title: draft.title.trim(),
      image_url: draft.image_url.trim() || null,
      link_url: draft.link_url.trim(),
      category_match: draft.category_match,
    };

    const result = draft.id
      ? await supabase.from('affiliate_packages').update(payload).eq('id', draft.id)
      : await supabase.from('affiliate_packages').insert([payload]);

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setDraft(emptyDraft);
    loadPackages();
  }

  async function deletePackage(id: string) {
    setError('');
    const { error } = await supabase.from('affiliate_packages').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    if (draft.id === id) setDraft(emptyDraft);
    loadPackages();
  }

  return (
    <main className="min-h-screen bg-[#F5F5DC] px-5 py-8 text-[#1B2E26]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-[#8d5a2b]">
              <ArrowLeft size={13} /> 返回後台
            </Link>
            <h1 className="font-serif text-3xl font-black">旅遊套裝管理</h1>
          </div>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft)}
            className="inline-flex items-center gap-2 rounded-full bg-[#1B2E26] px-4 py-2 text-sm font-black text-[#F5F5DC]"
          >
            <Plus size={15} /> 新增
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        <section className="mb-6 rounded-2xl border border-[#d8cda5] bg-white/75 p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.title}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              placeholder="標題"
              className="rounded-xl border border-[#d8cda5] bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#8d5a2b]"
            />
            <select
              value={draft.category_match}
              onChange={(event) => setDraft((value) => ({ ...value, category_match: event.target.value }))}
              className="rounded-xl border border-[#d8cda5] bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#8d5a2b]"
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={draft.image_url}
              onChange={(event) => setDraft((value) => ({ ...value, image_url: event.target.value }))}
              placeholder="圖片連結"
              className="rounded-xl border border-[#d8cda5] bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#8d5a2b]"
            />
            <input
              value={draft.link_url}
              onChange={(event) => setDraft((value) => ({ ...value, link_url: event.target.value }))}
              placeholder="跳轉連結"
              className="rounded-xl border border-[#d8cda5] bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#8d5a2b]"
            />
          </div>
          <button
            type="button"
            onClick={savePackage}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-800 px-5 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            儲存套裝
          </button>
        </section>

        {loading ? (
          <div className="flex items-center gap-2 text-sm font-black text-[#8d5a2b]"><Loader2 size={16} className="animate-spin" /> 載入中</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {packages.map((pkg) => (
              <article key={pkg.id} className="rounded-2xl border border-[#d8cda5] bg-white/80 p-4 shadow-sm">
                {pkg.image_url && <img src={pkg.image_url} alt={pkg.title} className="mb-3 h-36 w-full rounded-xl object-cover" />}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-black">{pkg.title}</h2>
                    <p className="text-xs font-bold text-[#8d5a2b]">{pkg.category_match}</p>
                  </div>
                </div>
                <p className="mb-3 truncate text-xs font-semibold text-[#5f654f]">{pkg.link_url}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({
                      id: pkg.id,
                      title: pkg.title,
                      image_url: pkg.image_url ?? '',
                      link_url: pkg.link_url,
                      category_match: pkg.category_match,
                    })}
                    className="rounded-full bg-[#1B2E26] px-4 py-2 text-xs font-black text-[#F5F5DC]"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePackage(pkg.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-600"
                  >
                    <Trash2 size={13} /> 刪除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
