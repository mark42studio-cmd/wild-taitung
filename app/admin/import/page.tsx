'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sparkles, MapPin, Utensils, Loader2,
  CheckCircle2, AlertTriangle, Trash2, ChevronDown, Save, Link as LinkIcon,
} from 'lucide-react';

type ParsedItem = {
  name: string;
  tableType: 'places' | 'food';
  category: string;
  description: string;
  quote: string;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
};

type EditableItem = ParsedItem & { _id: string };
type FailedItem = ParsedItem & { reason: string };

type CommitResult = {
  inserted: ParsedItem[];
  failed: FailedItem[];
};

type Status = 'idle' | 'parsing' | 'review' | 'committing' | 'done' | 'error';

const PLACES_CATEGORIES = ['縱谷線', '南迴線', '海線', '市區'] as const;
const FOOD_CATEGORIES = ['在地小吃', '特色風味', '甜點冰品', '咖啡茶飲'] as const;

const TYPE_LABEL: Record<string, string> = { places: '景點', food: '美食' };

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Editable Card ─────────────────────────────────────────────────────────────
function ItemCard({
  item,
  index,
  onChange,
  onDelete,
}: {
  item: EditableItem;
  index: number;
  onChange: (id: string, patch: Partial<ParsedItem>) => void;
  onDelete: (id: string) => void;
}) {
  const isPlace = item.tableType === 'places';
  const categories = isPlace ? PLACES_CATEGORIES : FOOD_CATEGORIES;

  function field(key: keyof ParsedItem, value: string) {
    onChange(item._id, { [key]: value });
  }

  function switchType(newType: 'places' | 'food') {
    const defaultCat = newType === 'places' ? '縱谷線' : '在地小吃';
    onChange(item._id, { tableType: newType, category: defaultCat });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.04 }}
      className="relative rounded-3xl p-5"
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: `1.5px solid ${isPlace ? 'rgba(0,95,184,0.18)' : 'rgba(228,92,28,0.18)'}`,
        boxShadow: '0 2px 16px rgba(27,46,38,0.06)',
      }}
    >
      {/* Delete button */}
      <button
        onClick={() => onDelete(item._id)}
        title="移除此項目"
        className="absolute right-4 top-4 rounded-xl p-1.5 transition-colors hover:bg-red-50"
        style={{ color: '#C0AFA8' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#C0AFA8')}
      >
        <Trash2 size={14} />
      </button>

      {/* Type + Category badges */}
      <div className="mb-4 flex flex-wrap items-center gap-2 pr-8">
        {/* Type toggle */}
        <div className="relative flex overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(27,46,38,0.12)' }}>
          {(['places', 'food'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-black transition-colors"
              style={{
                background: item.tableType === t
                  ? (t === 'places' ? '#005FB8' : '#e45c1c')
                  : 'transparent',
                color: item.tableType === t ? '#fff' : '#A09488',
              }}
            >
              {t === 'places' ? <MapPin size={10} /> : <Utensils size={10} />}
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Category select */}
        <div className="relative flex items-center gap-1">
          <select
            value={item.category}
            onChange={e => field('category', e.target.value)}
            className="appearance-none rounded-xl px-3 py-1.5 pr-7 text-[11px] font-black outline-none"
            style={{
              background: isPlace ? 'rgba(0,95,184,0.08)' : 'rgba(228,92,28,0.08)',
              color: isPlace ? '#005FB8' : '#e45c1c',
              border: `1px solid ${isPlace ? 'rgba(0,95,184,0.20)' : 'rgba(228,92,28,0.20)'}`,
            }}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={10} className="pointer-events-none absolute right-2" style={{ color: isPlace ? '#005FB8' : '#e45c1c' }} />
        </div>

        {/* Coords chip */}
        {item.lat && item.lng ? (
          <span className="rounded-xl px-2.5 py-1.5 text-[10px] font-bold" style={{ background: 'rgba(22,163,74,0.08)', color: '#15803d' }}>
            📍 {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
          </span>
        ) : (
          <span className="rounded-xl px-2.5 py-1.5 text-[10px] font-bold" style={{ background: 'rgba(217,119,6,0.07)', color: '#b45309' }}>
            ⚠ 座標待補
          </span>
        )}
      </div>

      {/* Name */}
      <input
        value={item.name}
        onChange={e => field('name', e.target.value)}
        placeholder="名稱"
        className="mb-3 w-full rounded-2xl px-4 py-2.5 font-serif text-base font-black outline-none transition-all"
        style={{
          background: '#FDFBF6',
          border: '1.5px solid rgba(160,148,136,0.20)',
          color: '#1B2E26',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(141,90,43,0.40)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(160,148,136,0.20)')}
      />

      {/* Description */}
      <textarea
        value={item.description}
        onChange={e => field('description', e.target.value)}
        placeholder="地點描述（2-4句話）"
        rows={2}
        className="mb-3 w-full resize-none rounded-2xl px-4 py-2.5 text-sm leading-relaxed outline-none transition-all"
        style={{
          background: '#FDFBF6',
          border: '1.5px solid rgba(160,148,136,0.20)',
          color: '#1B2E26',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(141,90,43,0.40)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(160,148,136,0.20)')}
      />

      {/* Quote */}
      <input
        value={item.quote}
        onChange={e => field('quote', e.target.value)}
        placeholder="風格標語（25字以內，帶有具體感知對象）"
        className="mb-3 w-full rounded-2xl px-4 py-2.5 text-sm italic outline-none transition-all"
        style={{
          background: '#FDFBF6',
          border: '1.5px solid rgba(160,148,136,0.20)',
          color: '#8d5a2b',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(141,90,43,0.40)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(160,148,136,0.20)')}
      />

      {/* Image URL */}
      <div>
        <label
          className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em]"
          style={{ color: '#A09488' }}
        >
          <LinkIcon size={10} /> 圖片網址
        </label>
        <div className="flex items-center gap-2">
          <input
            value={item.image_url ?? ''}
            onChange={e => onChange(item._id, { image_url: e.target.value || null })}
            placeholder="貼上 IG、Google 或 Supabase 圖片連結…"
            className="flex-1 rounded-2xl px-4 py-2.5 text-[12px] outline-none transition-all"
            style={{
              background: '#FDFBF6',
              border: '1.5px solid rgba(160,148,136,0.20)',
              color: '#1B2E26',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(141,90,43,0.40)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(160,148,136,0.20)')}
          />
          {item.image_url && (
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(160,148,136,0.20)' }}>
              <img
                src={item.image_url}
                alt=""
                className="h-full w-full object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminImportPage() {
  const [rawText, setRawText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [duplicates, setDuplicates] = useState<ParsedItem[]>([]);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Step 1: Parse + 前置去重 ─────────────────────────────────────────────
  async function handleParse() {
    if (!rawText.trim() || status === 'parsing') return;
    setStatus('parsing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/auto-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? '解析失敗，請稍後再試');
        setStatus('error');
        return;
      }

      const newItems: ParsedItem[] = data.newItems ?? [];
      const duplicateItems: ParsedItem[] = data.duplicateItems ?? [];

      if (newItems.length === 0 && duplicateItems.length === 0) {
        setErrorMsg(data.message ?? 'AI 未能識別出任何地點，請補充更多描述後重試');
        setStatus('error');
        return;
      }

      setDuplicates(duplicateItems);
      setItems(newItems.map(i => ({ ...i, _id: genId() })));
      setStatus('review');
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  }

  // ── Step 2: Commit ───────────────────────────────────────────────────────
  async function handleCommit() {
    if (items.length === 0 || status === 'committing') return;
    setStatus('committing');

    try {
      const payload = items.map(({ _id: _unused, ...rest }) => rest);
      const res = await fetch('/api/admin/auto-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? '寫入失敗');
        setStatus('error');
        return;
      }

      setCommitResult(data as CommitResult);
      setStatus('done');
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  }

  function handleItemChange(id: string, patch: Partial<ParsedItem>) {
    setItems(prev => prev.map(i => (i._id === id ? { ...i, ...patch } : i)));
  }

  function handleItemDelete(id: string) {
    setItems(prev => prev.filter(i => i._id !== id));
  }

  function handleReset() {
    setStatus('idle');
    setRawText('');
    setItems([]);
    setDuplicates([]);
    setCommitResult(null);
    setErrorMsg('');
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen px-5 py-8" style={{ background: '#F5F5DC', color: '#1B2E26' }}>
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-xs font-black hover:underline"
            style={{ color: '#8d5a2b' }}
          >
            <ArrowLeft size={13} /> 返回後台
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-black leading-tight">AI 批次文字匯入</h1>
            <p className="mt-0.5 text-[11px] font-semibold tracking-widest opacity-50 uppercase">
              Auto Import · Powered by Gemini
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[
            { label: '1. 貼入文字', active: status === 'idle' || status === 'parsing' || status === 'error' },
            { label: '2. 審閱編輯', active: status === 'review' || status === 'committing' },
            { label: '3. 完成建檔', active: status === 'done' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-current opacity-20" />}
              <span
                className="rounded-full px-3 py-1 text-[10px] font-black tracking-widest"
                style={{
                  background: step.active ? '#1B2E26' : 'rgba(27,46,38,0.08)',
                  color: step.active ? '#F5F5DC' : '#A09488',
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── STEP 1: Text Input ── */}
        <AnimatePresence mode="wait">
          {(status === 'idle' || status === 'parsing') && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                className="mb-6 rounded-3xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(27,46,38,0.10)',
                  boxShadow: '0 4px 24px rgba(27,46,38,0.07)',
                }}
              >
                <label
                  className="mb-2 block text-[10px] font-black uppercase tracking-[0.4em]"
                  style={{ color: '#5a6a5a' }}
                >
                  原始筆記 / 破碎資料
                </label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  disabled={status === 'parsing'}
                  rows={12}
                  placeholder={'請貼上任何未整理的筆記、網頁摘錄、IG 截圖文字...\n\nAI 將自動識別景點與美食、補全短評與座標，先呈現預覽讓您確認後再寫入。'}
                  className="w-full resize-none rounded-2xl px-5 py-4 text-sm leading-relaxed outline-none transition-all placeholder:text-[#A09488] disabled:opacity-60"
                  style={{
                    background: '#FDFBF6',
                    border: '1.5px solid rgba(160,148,136,0.25)',
                    color: '#1B2E26',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(141,90,43,0.45)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(160,148,136,0.25)'; }}
                />

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-[10px] text-[#A09488]">
                    {rawText.length > 0 ? `${rawText.length} 字元` : '支援中英文混合輸入'}
                  </p>
                  <motion.button
                    onClick={handleParse}
                    disabled={!rawText.trim() || status === 'parsing'}
                    whileHover={rawText.trim() ? { y: -2, scale: 1.02 } : {}}
                    whileTap={rawText.trim() ? { scale: 0.97 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-black text-white disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, #1B2E26 0%, #2d5016 100%)',
                      boxShadow: rawText.trim() ? '0 4px 20px rgba(27,46,38,0.28)' : 'none',
                    }}
                  >
                    {status === 'parsing' ? (
                      <><Loader2 size={15} className="animate-spin" /> Gemini 解析中…</>
                    ) : (
                      <><Sparkles size={15} /> AI 解析預覽</>
                    )}
                  </motion.button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] tracking-widest text-[#A09488]">
                解析完成後會先呈現可編輯卡片，確認無誤再批次寫入資料庫
              </p>
            </motion.div>
          )}

          {/* ── STEP 2: Review Cards ── */}
          {(status === 'review' || status === 'committing') && (
            <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Toolbar */}
              <div
                className="mb-3 flex items-center justify-between rounded-2xl px-5 py-3"
                style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(27,46,38,0.10)' }}
              >
                <div>
                  <p className="text-sm font-black" style={{ color: '#1B2E26' }}>
                    AI 解析完成
                    {items.length > 0 && (
                      <> · <span style={{ color: '#2d5016' }}>{items.length}</span> 筆全新資料待確認</>
                    )}
                    {items.length === 0 && duplicates.length > 0 && (
                      <> · <span style={{ color: '#b45309' }}>全部重複</span>，無需建檔</>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: '#A09488' }}>
                    可修改分類、名稱、描述，或刪除誤判項目
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="rounded-xl px-4 py-2 text-xs font-black transition-colors hover:bg-white/60"
                  style={{ color: '#8d5a2b', border: '1px solid rgba(141,90,43,0.20)' }}
                >
                  重新輸入
                </button>
              </div>

              {/* Duplicates banner */}
              {duplicates.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-2xl px-4 py-3"
                  style={{
                    background: 'rgba(217,119,6,0.06)',
                    border: '1px solid rgba(217,119,6,0.20)',
                  }}
                >
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: '#b45309' }}>
                    <AlertTriangle size={11} /> 已自動過濾 {duplicates.length} 筆重複資料
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: '#92400e' }}>
                    {duplicates.map(d => d.name).join('、')}
                  </p>
                </motion.div>
              )}

              {/* Cards */}
              <AnimatePresence>
                {items.length > 0 ? (
                  <div className="mb-6 flex flex-col gap-4">
                    {items.map((item, i) => (
                      <ItemCard
                        key={item._id}
                        item={item}
                        index={i}
                        onChange={handleItemChange}
                        onDelete={handleItemDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-6 rounded-3xl py-16 text-center text-sm"
                    style={{ background: 'rgba(255,255,255,0.5)', border: '1.5px dashed rgba(160,148,136,0.30)', color: '#A09488' }}
                  >
                    <p className="text-2xl mb-2">{duplicates.length > 0 ? '✅' : '🗑'}</p>
                    <p>{duplicates.length > 0 ? '所有資料庫中皆已存在，無需重複建檔' : '已全部刪除，請重新輸入文字'}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Commit button */}
              <motion.button
                onClick={handleCommit}
                disabled={items.length === 0 || status === 'committing'}
                whileHover={items.length > 0 ? { y: -2, scale: 1.01 } : {}}
                whileTap={items.length > 0 ? { scale: 0.98 } : {}}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                className="w-full flex items-center justify-center gap-3 rounded-3xl py-4 text-base font-black text-white disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #15803d 0%, #1B2E26 100%)',
                  boxShadow: items.length > 0 ? '0 6px 28px rgba(21,128,61,0.30)' : 'none',
                }}
              >
                {status === 'committing' ? (
                  <><Loader2 size={17} className="animate-spin" /> 寫入中…</>
                ) : (
                  <><Save size={17} /> 確認批次建檔 {items.length} 筆</>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ── STEP 3: Done ── */}
          {status === 'done' && commitResult && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              {/* Summary */}
              <div className={`mb-5 grid gap-4 ${commitResult.failed.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div
                  className="rounded-2xl px-5 py-4 text-center"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.20)' }}
                >
                  <p className="font-serif text-3xl font-black" style={{ color: '#15803d' }}>
                    {commitResult.inserted.length}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-green-700">成功建檔</p>
                </div>
                {commitResult.failed.length > 0 && (
                  <div
                    className="rounded-2xl px-5 py-4 text-center"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                  >
                    <p className="font-serif text-3xl font-black text-red-600">
                      {commitResult.failed.length}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-red-500">寫入失敗</p>
                  </div>
                )}
              </div>

              {/* Inserted list */}
              {commitResult.inserted.length > 0 && (
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-600" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-green-700">已寫入資料庫</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {commitResult.inserted.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3"
                        style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(22,163,74,0.15)' }}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ background: item.tableType === 'places' ? 'rgba(0,95,184,0.10)' : 'rgba(228,92,28,0.10)' }}
                        >
                          {item.tableType === 'places'
                            ? <MapPin size={13} style={{ color: '#005FB8' }} />
                            : <Utensils size={13} style={{ color: '#e45c1c' }} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-sm font-black text-[#1B2E26]">{item.name}</p>
                          <p className="text-[10px] text-[#A09488]">{item.category}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed list (write errors only, not duplicates) */}
              {commitResult.failed.length > 0 && (
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-red-600">寫入失敗</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {commitResult.failed.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-2xl px-4 py-3"
                        style={{ background: 'rgba(254,226,226,0.5)', border: '1px solid rgba(239,68,68,0.15)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-red-700">{item.name}</p>
                          <p className="mt-0.5 text-[10px] text-red-500">{item.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleReset}
                  className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-colors hover:bg-white/60"
                  style={{ color: '#8d5a2b', border: '1px solid rgba(141,90,43,0.20)' }}
                >
                  再次匯入
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-start gap-3 rounded-2xl px-5 py-4"
              style={{ background: 'rgba(254,226,226,0.7)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-xs font-black text-red-700">操作失敗</p>
                <p className="mt-0.5 text-[11px] text-red-600">{errorMsg}</p>
              </div>
              <button
                onClick={handleReset}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black text-red-600 hover:bg-red-100"
              >
                重試
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
