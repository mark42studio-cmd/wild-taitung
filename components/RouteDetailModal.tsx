'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Users, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateHighlightFallback } from '@/app/actions/generateHighlightFallback';
import type { CuratedRoute } from '@/types';

const FALLBACK_IMAGE = '/images/taitung-fallback.svg';

// Phrases that indicate stale/low-quality AI-generated descriptions from old prompts.
// If a Supabase description contains any of these, treat it as absent and regenerate.
const BAD_DESC_PHRASES = ['融合', '人文風情', '自然生態', '值得一遊', '不容錯過'];
function isBadDescription(text: string): boolean {
  return BAD_DESC_PHRASES.some(p => text.includes(p));
}

interface HighlightMeta {
  image_url: string | null;
  description: string | null;
}

function stripEmojis(text: string): string {
  if (!text) return '';
  return text.replace(/\p{Emoji}/gu, '').replace(/\s+/g, ' ').trim();
}

const THEME_GRADIENT: Record<string, string> = {
  foodie:      'linear-gradient(160deg, #FDFBF6 0%, #FEF5E7 100%)',
  mountain:    'linear-gradient(160deg, #FDFBF6 0%, #F0F5EE 100%)',
  ocean:       'linear-gradient(160deg, #FDFBF6 0%, #EEF4F8 100%)',
  editor_pick: 'linear-gradient(160deg, #FDFBF6 0%, #FCF0EE 100%)',
  hidden:      'linear-gradient(160deg, #FDFBF6 0%, #F2EFF8 100%)',
};

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
  }
  return `${minutes}m`;
}

function DescSkeleton() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="h-2.5 w-full animate-pulse rounded-full bg-[#D7AF70]/18" />
      <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-[#D7AF70]/14" />
      <div className="h-2.5 w-4/6 animate-pulse rounded-full bg-[#D7AF70]/10" />
    </div>
  );
}

export default function RouteDetailModal({
  route,
  onClose,
  onAcceptChallenge,
  onAdjust,
}: {
  route: CuratedRoute | null;
  onClose: () => void;
  onAcceptChallenge: (route: CuratedRoute) => void;
  onAdjust: (route: CuratedRoute) => void;
}) {
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);
  const [highlightMeta, setHighlightMeta] = useState<Record<string, HighlightMeta>>({});
  // generated[name] = undefined → not attempted; '' → attempted, empty; 'text' → success
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  // guard against stale closures on fast clicks
  const generatingRef = useRef<Set<string>>(new Set());

  // Batch-fetch Supabase meta when modal opens
  useEffect(() => {
    if (!route) return;
    setHighlightMeta({});
    setGenerated({});

    const names = route.highlights.map(h => stripEmojis(h)).filter(Boolean);
    if (names.length === 0) return;

    (async () => {
      const [{ data: places }, { data: foods }] = await Promise.all([
        supabase.from('places').select('name, image_url, description, quote').in('name', names),
        supabase.from('foods').select('name, image_url, description').in('name', names),
      ]);

      const meta: Record<string, HighlightMeta> = {};
      for (const p of (places ?? [])) {
        meta[p.name] = {
          image_url:   p.image_url ?? null,
          description: (p.description ?? p.quote ?? null) as string | null,
        };
      }
      for (const f of (foods ?? [])) {
        if (!meta[f.name]) {
          meta[f.name] = { image_url: f.image_url ?? null, description: f.description ?? null };
        }
      }
      setHighlightMeta(meta);
    })();
  }, [route?.id]);

  // Trigger Gemini generation when a highlight with no description is clicked
  useEffect(() => {
    if (!selectedHighlight) return;
    const existingDesc = highlightMeta[selectedHighlight]?.description;
    if (existingDesc && !isBadDescription(existingDesc)) return;  // valid real data exists
    if (generated[selectedHighlight] !== undefined) return;       // already attempted
    if (generatingRef.current.has(selectedHighlight)) return;    // in flight

    const name = selectedHighlight;
    generatingRef.current.add(name);
    setGeneratingFor(name);

    generateHighlightFallback(name)
      .then(text => {
        setGenerated(prev => ({ ...prev, [name]: text }));
        // 同步更新 highlightMeta，讓後續同一 session 的 description 檢查能命中
        if (text) {
          setHighlightMeta(prev => ({
            ...prev,
            [name]: { ...prev[name], description: text },
          }));
        }
      })
      .catch(() => {
        setGenerated(prev => ({ ...prev, [name]: '' }));
      })
      .finally(() => {
        generatingRef.current.delete(name);
        setGeneratingFor(v => v === name ? null : v);
      });
  }, [selectedHighlight, highlightMeta]);

  return (
    <AnimatePresence>
      {route && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 310, damping: 34, mass: 0.9 }}
            className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex flex-col overflow-hidden"
            style={{
              maxWidth: 520,
              height: '92dvh',
              borderRadius: '12px 12px 0 0',
              background: THEME_GRADIENT[route.theme] ?? '#FDFBF6',
              border: '1px solid rgba(90,100,90,0.12)',
              borderBottom: 'none',
            }}
          >
            {/* ── TOP 1/3: Hero photo ── */}
            <div
              className="relative shrink-0 overflow-hidden"
              style={{ height: '33.333%', borderRadius: '12px 12px 0 0' }}
            >
              <img
                src={route.cover_image || FALLBACK_IMAGE}
                alt={route.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20" />
              <div
                className="absolute bottom-0 left-0 right-0 h-14"
                style={{ background: 'linear-gradient(to top, rgba(253,251,246,1) 0%, transparent 100%)' }}
              />
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm"
              >
                <X size={15} color="white" />
              </button>
            </div>

            {/* ── MIDDLE: Scrollable info + itinerary ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-36 pt-3">

              <div className="mb-4">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.5em] text-[#B89050]/70">
                  {route.days} 天精選路線
                </p>
                <h2 className="font-serif text-[22px] leading-snug tracking-wider text-[#5A645A]">
                  {stripEmojis(route.title)}
                </h2>
              </div>

              <div className="mb-5 flex gap-5 text-[#8E8377]">
                <div className="flex items-center gap-1.5 text-xs">
                  <Star size={11} style={{ color: '#D7AF70', fill: '#D7AF70' }} />
                  <span className="font-bold text-[#D7AF70]">{route.rating}</span>
                  <span className="opacity-45">({route.rating_count} 評)</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Users size={11} className="opacity-40" />
                  <span>{route.completion_count.toLocaleString()} 人通關</span>
                </div>
              </div>

              {/* ── Activity Highlights (clickable) ── */}
              <div className="mb-6">
                <p className="mb-2.5 text-[9px] uppercase tracking-[0.4em] text-[#8E8377]/70">
                  活動亮點
                </p>
                <div className="flex flex-wrap gap-2">
                  {route.highlights.map((h, i) => {
                    const clean = stripEmojis(h);
                    const isPrimary = i === 0;
                    return (
                      <button
                        key={h}
                        onClick={() => setSelectedHighlight(clean)}
                        className={[
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-all duration-150',
                          isPrimary
                            ? 'bg-[#D7AF70]/10 border-[#D7AF70]/55 text-[#D7AF70]'
                            : 'bg-white border-[#D7AF70]/25 text-[#D7AF70] hover:bg-[#D7AF70]/5',
                        ].join(' ')}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isPrimary ? 'bg-[#D7AF70]' : 'bg-[#D7AF70]/50'}`} />
                        {clean}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Day-by-day itinerary ── */}
              <div className="mb-6">
                <p className="mb-2.5 text-[9px] uppercase tracking-[0.4em] text-[#8E8377]/70">
                  每日行程預覽
                </p>
                <div className="space-y-2.5">
                  {route.days_plan.map((day) => (
                    <div key={day.day} className="rounded-xl border border-[#5A645A]/10 bg-white/80 p-3.5">
                      <p className="mb-2 font-serif text-[11px] font-bold tracking-wide text-[#D7AF70]">
                        {stripEmojis(day.label)}
                        {day.has_island && day.island_name && (
                          <span className="ml-2 rounded-md border border-[#D7AF70]/25 bg-[#F8F5EE] px-2 py-0.5 text-[9px] text-[#D7AF70]/70">
                            離島 · {day.island_name}
                          </span>
                        )}
                      </p>
                      <div className="space-y-1.5">
                        {day.stops.map((stop) => (
                          <div key={stop.id} className="flex items-center gap-2 text-[11px] text-[#8E8377]">
                            <MapPin size={8} className="shrink-0 opacity-35" />
                            <span className="flex-1">{stripEmojis(stop.name)}</span>
                            <span className="flex shrink-0 items-center gap-0.5 text-[#A09488]">
                              <Clock size={8} />
                              {formatDuration(stop.stay_duration)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-2 rounded-xl border border-dashed border-[#D7AF70]/25 bg-[#F8F5EE]/50 p-4 text-center">
                <p className="text-[10px] text-[#A09488]">·&ensp;旅客評價即將上線&ensp;·</p>
              </div>

            </div>

            {/* ── BOTTOM: Horizontal buttons ── */}
            <div
              className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2.5 border-t border-[#5A645A]/10 px-5 pb-7 pt-3.5"
              style={{
                background: 'linear-gradient(to top, rgba(253,251,246,0.98) 65%, transparent 100%)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <div className="flex w-full gap-2.5">
                <motion.button
                  onClick={() => onAcceptChallenge(route)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#D7AF70]/40 bg-gradient-to-r from-[#D7AF70] to-[#E5C992] px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-[#D7AF70]/25"
                >
                  ⚔️ 接受挑戰
                </motion.button>
                <motion.button
                  onClick={() => onAdjust(route)}
                  whileHover={{ scale: 1.02, y: -0.5 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#5A645A]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#8E8377] hover:border-[#5A645A]/40 hover:text-[#5A645A]"
                >
                  🛠️ 調整行程
                </motion.button>
              </div>
              <span className="select-none font-serif text-sm font-black tracking-[0.35em] text-[#5A645A]/25">
                N
              </span>
            </div>

            {/* ── Highlight Info Overlay ── */}
            <AnimatePresence>
              {selectedHighlight && (
                <motion.div
                  key="highlight-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-[80] flex items-center justify-center p-5"
                  style={{ backdropFilter: 'blur(14px)', background: 'rgba(10,20,10,0.45)' }}
                  onClick={() => setSelectedHighlight(null)}
                >
                  <motion.div
                    initial={{ y: 24, scale: 0.95, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={{ y: 24, scale: 0.95, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
                    style={{ background: '#FDFBF6', border: '1px solid rgba(215,175,112,0.25)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Highlight photo — real or brand fallback, always full layout */}
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={highlightMeta[selectedHighlight]?.image_url ?? FALLBACK_IMAGE}
                        alt={selectedHighlight}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <p className="absolute bottom-3 left-4 font-serif text-base font-bold text-white drop-shadow-sm">
                        {selectedHighlight}
                      </p>
                      <button
                        onClick={() => setSelectedHighlight(null)}
                        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                      >
                        <X size={13} color="white" />
                      </button>
                    </div>

                    {/* Description — real data, AI-generated, or skeleton */}
                    <div className="px-4 pb-5 pt-3.5">
                      {(() => {
                        const rawDesc   = highlightMeta[selectedHighlight]?.description;
                        const validDesc = rawDesc && !isBadDescription(rawDesc) ? rawDesc : null;
                        const aiDesc    = generated[selectedHighlight];
                        const isLoading = generatingFor === selectedHighlight;

                        if (validDesc) {
                          return (
                            <p className="text-[12px] leading-[1.75] text-[#8E8377]">{validDesc}</p>
                          );
                        }
                        if (isLoading) {
                          return <DescSkeleton />;
                        }
                        if (aiDesc) {
                          return (
                            <p className="text-[12px] leading-[1.75] text-[#8E8377]">{aiDesc}</p>
                          );
                        }
                        // generation attempted but returned empty — show nothing
                        return null;
                      })()}
                      <button
                        onClick={() => setSelectedHighlight(null)}
                        className="mt-3.5 w-full rounded-xl border border-[#5A645A]/15 bg-[#F5F2EC] py-2 text-[11px] font-bold text-[#8E8377] hover:bg-[#EEE8DD]"
                      >
                        關閉
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
