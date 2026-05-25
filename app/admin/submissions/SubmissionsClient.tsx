'use client'

import { useState, useTransition, useMemo } from 'react'
import Image from 'next/image'
import { CheckCircle, XCircle, Loader2, MapPin, Clock, Tag, MessageSquare, Mail, X, Pencil } from 'lucide-react'
import { approveSubmission, rejectSubmission } from './actions'

// ─── Types ───────────────────────────────────────────────────────────────────

type Submission = {
  id: string
  type: string | null
  name: string
  category: string | null
  time: string | null
  location: string | null
  description: string | null
  image_url: string | null
  comments: string | null
  status: string | null
  created_at: string
  email: string | null
}

type ApproveOverrides = {
  name: string
  description: string | null
  image_url: string | null
  quote: string | null
  tags: string[]
}

type ParsedComments = {
  quote?: string | null
  tags?: string[]
  food_category?: string | null
}

type StatusBadge  = 'pending' | 'approved' | 'rejected'
type StatusFilter = 'all' | StatusBadge
type CatFilter    = 'all' | 'spot' | 'food'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseComments(raw: string | null): ParsedComments {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return { quote: raw } }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; emoji: string; bg: string; color: string }> = {
  spot: { label: '秘境景點', emoji: '🌿', bg: '#dcfce7', color: '#15803d' },
  food: { label: '美食店家', emoji: '🎪', bg: '#fff7ed', color: '#c2410c' },
}

const STATUS_META: Record<StatusBadge, { label: string; badgeBg: string; badgeColor: string }> = {
  pending:  { label: '待審核', badgeBg: '#fef9c3', badgeColor: '#a16207' },
  approved: { label: '已核准', badgeBg: '#dcfce7', badgeColor: '#15803d' },
  rejected: { label: '已拒絕', badgeBg: '#f1f5f9', badgeColor: '#64748b' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ImageHero({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className="flex h-44 items-center justify-center bg-[#f5f0e8] text-4xl select-none">
        🖼️
      </div>
    )
  }
  return (
    <div className="relative h-44 bg-[#f5f0e8]">
      <Image src={src} alt={alt} fill className="object-cover" sizes="400px" unoptimized onError={() => setBroken(true)} />
    </div>
  )
}

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: bg, color }}>
      {children}
    </span>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

function SubmissionCard({
  item,
  effectiveStatus,
  isPending,
  onReviewClick,
  onReject,
  actionResult,
}: {
  item: Submission
  effectiveStatus: string
  isPending: boolean
  onReviewClick: () => void
  onReject: () => void
  actionResult?: string
}) {
  const catMeta = CAT_META[item.category ?? ''] ?? CAT_META.spot
  const statusMeta = STATUS_META[effectiveStatus as StatusBadge] ?? STATUS_META.pending
  const parsed = parseComments(item.comments)
  const isError = actionResult?.startsWith('error:')
  const isDone = effectiveStatus === 'approved' || effectiveStatus === 'rejected'

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-[#e2d5bb] bg-white shadow-sm transition-opacity"
      style={{ opacity: isDone ? 0.72 : 1 }}
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <ImageHero src={item.image_url} alt={item.name} />
        {/* Badges overlay */}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <Badge bg={catMeta.bg} color={catMeta.color}>{catMeta.emoji} {catMeta.label}</Badge>
        </div>
        <div className="absolute right-2.5 top-2.5">
          <Badge bg={statusMeta.badgeBg} color={statusMeta.badgeColor}>{statusMeta.label}</Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Name */}
        <h3 className="font-serif text-base font-bold leading-snug text-[#1B2E26]">{item.name}</h3>

        {/* Location */}
        {item.location && (
          <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
            <MapPin size={11} />
            <span>{item.location}</span>
            {parsed.food_category && (
              <><span className="text-[#d1d5db]">·</span><span>{parsed.food_category}</span></>
            )}
          </div>
        )}

        {/* Quote */}
        {parsed.quote && (
          <blockquote
            className="rounded-xl px-3 py-2 text-xs italic leading-relaxed"
            style={{ background: item.category === 'food' ? '#fff7ed' : '#f0fdf4', color: item.category === 'food' ? '#c2410c' : '#15803d' }}
          >
            <MessageSquare size={10} className="mb-0.5 mr-1 inline" />
            {parsed.quote}
          </blockquote>
        )}

        {/* Tags */}
        {parsed.tags && parsed.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parsed.tags.map((t) => (
              <span key={t} className="flex items-center gap-0.5 rounded-full bg-[#f0fdf4] px-2 py-0.5 text-[10px] font-medium text-[#15803d]">
                <Tag size={8} />#{t}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-[#6b7280]">{item.description}</p>
        )}

        {/* Date */}
        <div className="mt-auto flex items-center gap-1 pt-1 text-[10px] text-[#9ca3af]">
          <Clock size={9} />
          {fmtDate(item.created_at)}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#f0ebe0] p-3">
        {isError ? (
          <p className="text-center text-xs text-red-500">{actionResult!.replace('error:', '')}</p>
        ) : effectiveStatus === 'approved' ? (
          <p className="text-center text-sm font-bold text-[#15803d]">✅ 已核准上架</p>
        ) : effectiveStatus === 'rejected' ? (
          <p className="text-center text-sm font-bold text-[#64748b]">❌ 已拒絕</p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onReviewClick} disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#16a34a] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#15803d] disabled:opacity-40"
            >
              <Pencil size={12} />
              審核與編輯
            </button>
            <button
              onClick={onReject} disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#fef2f2] py-2.5 text-xs font-bold text-[#dc2626] transition-colors hover:bg-[#fee2e2] disabled:opacity-40"
            >
              <XCircle size={12} />
              拒絕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewField({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[9px] font-black uppercase tracking-widest" style={{ color: accent }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ReviewModal({
  item,
  onClose,
  onConfirm,
  isPending,
}: {
  item: Submission
  onClose: () => void
  onConfirm: (overrides: ApproveOverrides) => void
  isPending: boolean
}) {
  const parsed = parseComments(item.comments)
  const isSpot = item.category === 'spot'
  const accent = isSpot ? '#16a34a' : '#e45c1c'

  const [name, setName]               = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [imageUrl, setImageUrl]       = useState(item.image_url ?? '')
  const [quote, setQuote]             = useState(parsed.quote ?? '')
  const [tags, setTags]               = useState(parsed.tags?.join(', ') ?? '')

  function handleConfirm() {
    onConfirm({
      name:        name.trim() || item.name,
      description: description.trim() || null,
      image_url:   imageUrl.trim() || null,
      quote:       quote.trim() || null,
      tags:        tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
  }

  const fieldStyle = {
    borderColor: 'rgba(0,0,0,0.1)',
    background: '#fafafa',
    color: '#3D3530',
  }
  const inputClass = 'w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:ring-1'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ maxWidth: 460, maxHeight: '88dvh' }}
        >
          {/* Header */}
          <div
            className="shrink-0 px-5 py-4 border-b"
            style={{ background: isSpot ? '#f0fdf4' : '#fff7ed' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: accent }}>
                  {isSpot ? '🌿 景點審核' : '🎪 美食審核'}
                </p>
                <h3 className="font-serif text-base font-black text-[#1B2E26] leading-snug">審核與編輯</h3>
                <p className="text-[10px] text-[#8E8377] mt-0.5">補齊或修改後，確認上架至正式資料庫</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-black/8 hover:bg-black/12 transition-colors mt-0.5"
              >
                <X size={13} color="#5A645A" />
              </button>
            </div>
          </div>

          {/* Email strip */}
          <div
            className="shrink-0 mx-5 mt-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
            style={{
              background:   item.email ? '#f0f9ff' : '#f8f8f8',
              border:       `1px solid ${item.email ? '#bae6fd' : '#e5e7eb'}`,
            }}
          >
            <Mail size={13} style={{ color: item.email ? '#0284c7' : '#9ca3af', flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: item.email ? '#0369a1' : '#9ca3af' }}>
                投稿者 Email
              </p>
              <p className="text-xs truncate" style={{ color: item.email ? '#0c4a6e' : '#9ca3af' }}>
                {item.email ?? '未提供 Email'}
              </p>
            </div>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
            <ReviewField label="名稱 *" accent={accent}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </ReviewField>

            <ReviewField label="介紹說明" accent={accent}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                style={fieldStyle}
                placeholder="（選填）"
              />
            </ReviewField>

            <ReviewField label="短評金句（最多 40 字）" accent={accent}>
              <input
                value={quote}
                onChange={e => setQuote(e.target.value.slice(0, 40))}
                className={inputClass}
                style={fieldStyle}
                placeholder="（選填）"
              />
            </ReviewField>

            <ReviewField label="標籤（逗號分隔）" accent={accent}>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                className={inputClass}
                style={fieldStyle}
                placeholder="例：野溪, 日落, 無訊號"
              />
            </ReviewField>

            <ReviewField label="圖片連結" accent={accent}>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className={inputClass}
                style={fieldStyle}
                placeholder="（選填）圖片公開網址"
              />
            </ReviewField>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t px-5 py-4 flex gap-2.5" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl border py-3 text-xs font-bold text-[#8E8377] hover:bg-[#f5f0e8] transition-colors disabled:opacity-40"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!name.trim() || isPending}
              className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-black text-white transition-colors disabled:opacity-40"
              style={{ background: !name.trim() || isPending ? '#9ca3af' : accent }}
            >
              {isPending
                ? <><Loader2 size={12} className="animate-spin" /> 上架中…</>
                : <><CheckCircle size={12} /> 確認核准上架</>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SubmissionsClient({ items }: { items: Submission[] }) {
  const [results, setResults]       = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [catFilter, setCatFilter]   = useState<CatFilter>('all')
  const [reviewItem, setReviewItem] = useState<Submission | null>(null)

  function effectiveStatus(item: Submission): string {
    const r = results[item.id]
    if (r === 'approved' || r === 'rejected') return r
    return item.status ?? 'pending'
  }

  function handleReviewConfirm(overrides: ApproveOverrides) {
    if (!reviewItem) return
    startTransition(async () => {
      const res = await approveSubmission(reviewItem.id, overrides)
      setResults(prev => ({ ...prev, [reviewItem.id]: res.error ? `error:${res.error}` : 'approved' }))
      if (!res.error) setReviewItem(null)
    })
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const res = await rejectSubmission(id)
      setResults(prev => ({ ...prev, [id]: res.error ? `error:${res.error}` : 'rejected' }))
    })
  }

  const counts = useMemo(() => ({
    pending:  items.filter(i => effectiveStatus(i) === 'pending').length,
    approved: items.filter(i => effectiveStatus(i) === 'approved').length,
    rejected: items.filter(i => effectiveStatus(i) === 'rejected').length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, results])

  const displayed = useMemo(() => items.filter(item => {
    if (statusFilter !== 'all' && effectiveStatus(item) !== statusFilter) return false
    if (catFilter !== 'all' && item.category !== catFilter) return false
    return true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, results, statusFilter, catFilter])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([
          { key: 'pending',  emoji: '⏳', label: '待審核', count: counts.pending,  color: '#a16207', bg: '#fef9c3' },
          { key: 'approved', emoji: '✅', label: '已核准', count: counts.approved, color: '#15803d', bg: '#dcfce7' },
          { key: 'rejected', emoji: '❌', label: '已拒絕', count: counts.rejected, color: '#64748b', bg: '#f1f5f9' },
        ] as const).map(({ key, emoji, label, count, color, bg }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className="rounded-xl px-4 py-3 text-left transition-all"
            style={{
              background: statusFilter === key ? bg : 'rgba(255,255,255,0.55)',
              border: statusFilter === key ? `1.5px solid ${color}40` : '1px solid rgba(90,80,60,0.12)',
              boxShadow: statusFilter === key ? `0 2px 8px ${color}22` : 'none',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
              {emoji} {label}
            </p>
            <p className="mt-1 text-2xl font-black" style={{ color }}>{count}</p>
          </button>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="pt-2 space-y-2.5">
        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#8E8377]">狀態篩選</span>
          {([
            { key: 'all',      label: '全部',      color: '#1B2E26' },
            { key: 'pending',  label: '⏳ 待審核',  color: '#a16207' },
            { key: 'approved', label: '✅ 已核准',  color: '#15803d' },
            { key: 'rejected', label: '❌ 已拒絕',  color: '#64748b' },
          ] as const).map(({ key, label, color }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold transition-all"
              style={{
                background: statusFilter === key ? color : 'white',
                color:      statusFilter === key ? 'white' : '#5A645A',
                border:     statusFilter === key ? 'none' : '1px solid rgba(90,80,60,0.15)',
                boxShadow:  statusFilter === key ? `0 2px 6px ${color}44` : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#8E8377]">分類篩選</span>
          {([
            { key: 'all',  label: '全部' },
            { key: 'spot', label: '🌿 秘境景點' },
            { key: 'food', label: '🎪 美食店家' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setCatFilter(key)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all"
              style={{
                background: catFilter === key ? '#1B2E26' : 'white',
                color:      catFilter === key ? 'white' : '#5A645A',
                border:     catFilter === key ? 'none' : '1px solid rgba(90,80,60,0.15)',
                boxShadow:  catFilter === key ? '0 2px 6px rgba(27,46,38,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-[#9ca3af]">共 {displayed.length} 筆</span>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="py-6">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#c8b99a] py-24 text-center">
            <span className="mb-3 text-5xl">📭</span>
            <p className="font-semibold text-[#8E8377]">
              {statusFilter === 'all'
                ? '目前沒有任何投稿記錄'
                : statusFilter === 'pending'
                  ? '目前沒有待審核的投稿'
                  : `沒有${STATUS_META[statusFilter].label}的記錄`}
            </p>
            {statusFilter === 'pending' && (
              <p className="mt-1 text-xs text-[#B0A898]">新投稿會在這裡出現</p>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {displayed.map(item => (
              <SubmissionCard
                key={item.id}
                item={item}
                effectiveStatus={effectiveStatus(item)}
                isPending={isPending}
                onReviewClick={() => setReviewItem(item)}
                onReject={() => handleReject(item.id)}
                actionResult={results[item.id]}
              />
            ))}
          </div>
        )}
      </div>

      {reviewItem && (
        <ReviewModal
          item={reviewItem}
          onClose={() => setReviewItem(null)}
          onConfirm={handleReviewConfirm}
          isPending={isPending}
        />
      )}
    </div>
  )
}
