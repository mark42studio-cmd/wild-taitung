'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Users, Compass, X, Flame,
  ChevronUp, ChevronDown, ArrowRight, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MOCK_CURATED_ROUTES } from '@/lib/mock/curatedRoutes';
import { useItineraryStore } from '@/store/useItineraryStore';
import { useBuilderStore } from '@/store/useBuilderStore';
import type { AdventureTheme, BuilderDay, CuratedRoute, CuratedStop, Event } from '@/types';
import SpotCard, { CATEGORY_EMOJI, type Spot, type SpotCategory } from '@/components/SpotCard';
import { submitSpotUgc, submitFoodUgc } from '@/app/actions/submitUgc';

const THEME_META: Record<AdventureTheme, {
  label: string; emoji: string; desc: string; photo_url: string;
}> = {
  foodie:      { label: '大胃王',   emoji: '🍜', desc: '夜市、漁港、在地小吃全制霸', photo_url: 'https://picsum.photos/seed/taitung-food2/120/120'     },
  mountain:    { label: '山大王',   emoji: '🏔️', desc: '野溪溫泉、溯溪、山林深呼吸', photo_url: 'https://picsum.photos/seed/taitung-mountain/120/120'  },
  ocean:       { label: '海公主',   emoji: '🌊', desc: '浮潛、衝浪、東海岸公路',     photo_url: 'https://picsum.photos/seed/taitung-ocean/120/120'    },
  editor_pick: { label: '小編私房', emoji: '📍', desc: '在地人才知道的私藏路線',     photo_url: 'https://picsum.photos/seed/taitung-local/120/120'    },
  hidden:      { label: '小編秘境', emoji: '🗺️', desc: '離開觀光線，找到真正的秘境', photo_url: 'https://picsum.photos/seed/taitung-secret/120/120'   },
};

const ALL_THEMES: AdventureTheme[] = ['ocean', 'mountain', 'foodie', 'editor_pick', 'hidden'];

/* ─── Category Pill — Photo-circle + label capsule ─── */
function CategoryPill({
  label, emoji, photo_url, active, onClick,
}: {
  label: string;
  emoji?: string;
  photo_url?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      className="flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-1.5 transition-all duration-200"
      style={{
        background: active ? '#005FB8' : '#ffffff',
        color: active ? '#ffffff' : '#111827',
        boxShadow: active ? '0 4px 12px rgba(0,95,184,0.32)' : '0 1px 4px rgba(0,0,0,0.10)',
        border: active ? '1.5px solid transparent' : '1px solid rgba(0,0,0,0.10)',
      }}
    >
      {/* Photo circle — real image if available, emoji circle fallback */}
      {photo_url ? (
        <div
          className="h-9 w-9 shrink-0 overflow-hidden rounded-full"
          style={{
            border: active ? '2px solid rgba(255,255,255,0.55)' : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <img src={photo_url} alt={label} className="h-full w-full object-cover" draggable={false} />
        </div>
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
          style={{
            background: active ? 'rgba(255,255,255,0.18)' : 'rgba(0,95,184,0.06)',
            border: active ? '2px solid rgba(255,255,255,0.30)' : '1px solid rgba(0,95,184,0.12)',
          }}
        >
          {emoji}
        </div>
      )}
      <span className="text-[12px] font-semibold tracking-wide">{label}</span>
    </motion.button>
  );
}

/* ─── Route Card — Modern soft card ─── */
function RouteCard({ route, index, onClick }: { route: CuratedRoute; index: number; onClick: () => void }) {
  const meta = THEME_META[route.theme];

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className="relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-left [scroll-snap-align:start]"
      style={{ width: 172, height: 236, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
    >
      {/* Photo hero zone */}
      <div className="relative flex-1 overflow-hidden">
        <img
          src={meta.photo_url}
          alt={meta.label}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* Divider */}
      <div className="border-b border-gray-100" />

      {/* Info zone */}
      <div className="bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[13px] font-bold leading-tight tracking-wide text-gray-900">{meta.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{meta.desc}</p>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#005FB8]">
            <ArrowRight size={11} className="text-white" />
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2 border-t border-gray-100 pt-2.5 text-xs text-gray-500">
          <div className="flex items-center gap-0.5">
            <Star size={10} fill="#005FB8" color="#005FB8" />
            <span className="font-bold text-[#005FB8]">{route.rating}</span>
          </div>
          <span className="text-gray-300">·</span>
          <div className="flex items-center gap-1">
            <Users size={9} />
            <span>{route.completion_count.toLocaleString()} 人</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Spot → Event conversion ─── */
function spotToEvent(spot: Spot): Event {
  return {
    id: `spot-${spot.id}`,
    title: spot.name,
    description: spot.quote ?? '',
    venue_name: spot.name,
    latitude: spot.lat ?? undefined,
    longitude: spot.lng ?? undefined,
    vibe_tags: spot.tags ?? [],
    category: spot.category === '縱谷線' || spot.category === '南迴線' ? 'mtn' : spot.category === '海線' ? 'sea' : 'city',
    start_time: '2020-01-01T00:00:00+08:00',
    end_date: '2099-12-31',
    is_free: true,
    weather_resilience: 1,
  };
}

/** Map Supabase places.category → SpotCategory tab */
function mapDbCategory(cat: string | null | undefined): SpotCategory {
  if (cat === 'mtn' || cat === 'valley' || cat === 'mountain' || cat === 'rail') return '縱谷線';
  if (cat === 'south') return '南迴線';
  if (cat === 'sea' || cat === 'islands' || cat === 'ocean') return '海線';
  return '市區';
}

const SPOT_CAT_BG: Record<SpotCategory, string> = {
  縱谷線: 'linear-gradient(160deg, #2d5016 0%, #1a3a2a 100%)',
  南迴線: 'linear-gradient(160deg, #4a2800 0%, #3a1800 100%)',
  海線:   'linear-gradient(160deg, #0c2a4a 0%, #0f3d5a 100%)',
  市區:   'linear-gradient(160deg, #3a1a2a 0%, #4a2a1a 100%)',
};
const SPOT_CAT_LABEL: Record<SpotCategory, string> = { 縱谷線: '縱谷線', 南迴線: '南迴線', 海線: '海線', 市區: '市區' };

/* ─── Date Range Picker ─── */
function DateRangePicker({
  startDate,
  endDate,
  onChange,
  onClear,
  onOpen,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  onClear?: () => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return d.getMonth();
  });

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

  const displayText = startDate && endDate
    ? `${startDate.replace(/-/g, '/')}  →  ${endDate.replace(/-/g, '/')}`
    : startDate
    ? `${startDate.replace(/-/g, '/')} 出發`
    : '選擇旅遊日期範圍';

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: Array<string | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }

  const rangeStart = pendingStart ?? startDate;
  const rangeEnd = pendingStart ? null : endDate;

  function handleDayClick(dateStr: string) {
    if (dateStr < today) return;
    if (!pendingStart) {
      setPendingStart(dateStr);
    } else if (dateStr >= pendingStart) {
      onChange(pendingStart, dateStr);
      setPendingStart(null);
      setOpen(false);
    } else {
      setPendingStart(dateStr);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

  return (
    <div>
      <motion.button
        onClick={() => { setOpen((v) => !v); if (!open) onOpen?.(); }}
        whileTap={{ scale: 0.97 }}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all"
        style={{
          background: '#FDFBF6',
          border: open ? '1.5px solid #D7AF70' : '1px solid rgba(90,100,90,0.15)',
          boxShadow: open ? '0 4px 16px rgba(215,175,112,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base leading-none">📅</span>
          <span
            className="text-xs font-semibold"
            style={{ color: startDate ? '#5A645A' : '#A09488' }}
          >
            {displayText}
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className="text-[#8E8377]" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="calendar-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-2xl p-4"
              style={{
                background: '#FDFBF6',
                border: '1px solid rgba(215,175,112,0.28)',
                boxShadow: '0 4px 20px rgba(90,100,90,0.10)',
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={prevMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold text-[#5A645A] transition-colors hover:bg-[#F0EDE7]"
                >
                  ‹
                </button>
                <span className="text-xs font-black text-[#5A645A]">
                  {viewYear} 年 {MONTH_NAMES[viewMonth]}
                </span>
                <button
                  onClick={nextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold text-[#5A645A] transition-colors hover:bg-[#F0EDE7]"
                >
                  ›
                </button>
              </div>

              <div className="mb-1.5 grid grid-cols-7 text-center">
                {['日','一','二','三','四','五','六'].map((w) => (
                  <span key={w} className="text-[9px] font-bold text-[#A09488]">{w}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((dateStr, i) => {
                  if (!dateStr) return <div key={`blank-${i}`} />;
                  const isPast = dateStr < today;
                  const isStart = dateStr === rangeStart;
                  const isEnd = dateStr === rangeEnd;
                  const inRange = rangeStart && rangeEnd
                    ? dateStr > rangeStart && dateStr < rangeEnd
                    : false;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDayClick(dateStr)}
                      disabled={isPast}
                      className="flex items-center justify-center rounded-lg py-1.5 text-[11px] transition-all"
                      style={{
                        background: isStart || isEnd ? '#D7AF70' : inRange ? 'rgba(215,175,112,0.20)' : 'transparent',
                        color: isStart || isEnd ? 'white' : isPast ? '#C8BFB5' : inRange ? '#5A645A' : '#3D3530',
                        fontWeight: isStart || isEnd ? 800 : 600,
                        cursor: isPast ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {Number(dateStr.split('-')[2])}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 text-center">
                {pendingStart ? (
                  <p className="text-[9px] font-bold tracking-wide" style={{ color: '#D7AF70' }}>
                    ✓ 出發日已選 · 請點選回程日
                  </p>
                ) : (
                  <p className="text-[9px] tracking-wide text-[#A09488]">
                    {startDate && endDate ? '再次點擊可重新選擇' : '點選出發日開始'}
                  </p>
                )}
              </div>

              {startDate && !pendingStart && (
                <button
                  onClick={() => { onClear ? onClear() : onChange('', ''); setOpen(false); }}
                  className="mt-2 w-full rounded-xl py-1.5 text-[10px] font-bold text-[#8E8377] transition-colors hover:bg-[#F0EDE7]"
                >
                  清除日期
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Spot Detail Modal ─── */
function SpotDetailModal({
  spot,
  days,
  onClose,
  onAddToDay,
}: {
  spot: Spot;
  days: BuilderDay[];
  onClose: () => void;
  onAddToDay: (dayIndex: number) => void;
}) {
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [coverError, setCoverError] = useState(false);

  // 直接讀取 places.affiliate_link (text 欄位)
  const klookLink = spot.affiliate_link || null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="spot-backdrop"
        className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="spot-sheet"
        className="fixed inset-x-0 bottom-0 z-[55] mx-auto flex flex-col overflow-hidden"
        style={{ maxWidth: 520, maxHeight: '88dvh', borderRadius: '24px 24px 0 0' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
      >
        {/* Cover */}
        <div className="relative shrink-0 overflow-hidden" style={{ height: 260, borderRadius: '24px 24px 0 0' }}>
          {/* 1. 純色漸層背景（最底層，無圖時作為 fallback） */}
          <div className="absolute inset-0" style={{ background: SPOT_CAT_BG[spot.category as SpotCategory] ?? SPOT_CAT_BG['市區'] }} />
          {/* 2. 封面圖片（疊在背景上，出錯時自動回到純色 fallback） */}
          {spot.image_url && !coverError && (
            <img
              src={spot.image_url}
              alt={spot.name}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              onError={() => setCoverError(true)}
            />
          )}
          {/* 3. 漸層遮罩（最頂層，確保文字可讀性） */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm"
          >
            <X size={15} color="white" />
          </button>

          {/* Identity overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <span className="mb-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              {CATEGORY_EMOJI[spot.category as SpotCategory] ?? '📍'} {SPOT_CAT_LABEL[spot.category as SpotCategory] ?? spot.category}
            </span>
            <h2 className="font-serif text-xl font-bold leading-tight text-white drop-shadow-md">
              {spot.name}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white px-5 pb-40 pt-5">
          {spot.quote && (
            <p className="text-sm leading-relaxed text-[#5A645A] italic">
              「{spot.quote}」
            </p>
          )}
          {spot.tags && spot.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {spot.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Fixed CTA */}
        <div className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-5 pb-8 pt-4">
          {/* Klook 訂票按鈕 — 僅在 affiliate_link 有值且日程選擇器未展開時顯示 */}
          {klookLink && !showDayPicker && (
            <a
              href={klookLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
              }}
            >
              🎫 線上訂票/查方案
            </a>
          )}
          <AnimatePresence mode="wait">
            {!showDayPicker ? (
              <motion.button
                key="add-btn"
                onClick={() => {
                  if (days.length > 0) setShowDayPicker(true);
                  else onAddToDay(-1);
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                className="w-full rounded-2xl py-4 text-sm font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, #005FB8 0%, #1a7fd4 100%)',
                  boxShadow: '0 4px 20px rgba(0,95,184,0.35)',
                }}
              >
                ➕ 加入至行程中
              </motion.button>
            ) : (
              <motion.div
                key="day-picker"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <p className="mb-2.5 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                  加入哪一天？
                </p>
                <div className="flex max-h-[36dvh] flex-col gap-1.5 overflow-y-auto pb-1">
                  {days.map((day, i) => (
                    <motion.button
                      key={day.day}
                      onClick={() => onAddToDay(i)}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div>
                        <p className="text-xs font-bold text-gray-800">
                          Day {day.day}
                          {day.label && day.label !== `Day ${day.day}` ? ` · ${day.label}` : ''}
                        </p>
                        {day.date && (
                          <p className="mt-0.5 text-[10px] text-gray-400">{day.date}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-[#005FB8]">
                        {day.stops.length} 站
                      </span>
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDayPicker(false)}
                  className="mt-2 w-full rounded-xl py-2 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-50"
                >
                  ← 返回
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

/* ─── UGC: Shared Itinerary ─── */

interface SharedItinerary {
  id: string;
  adventure_name: string;
  days_count: number;
  stops_count: number;
  adopted_count: number;
  theme: string | null;
  created_at: string;
  days_data?: BuilderDay[] | null;
}

const UGC_THEME_ACCENT: Record<string, string> = {
  foodie: '#d97706', mountain: '#4a8f5f', ocean: '#0284c7',
  editor_pick: '#b91c1c', hidden: '#7c3aed',
};

const UGC_THEME_GRADIENT: Record<string, string> = {
  foodie:      'linear-gradient(160deg, #92400e 0%, #b45309 60%, #d97706 100%)',
  mountain:    'linear-gradient(160deg, #14532d 0%, #166534 60%, #4a8f5f 100%)',
  ocean:       'linear-gradient(160deg, #0c4a6e 0%, #075985 60%, #0284c7 100%)',
  editor_pick: 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 60%, #dc2626 100%)',
  hidden:      'linear-gradient(160deg, #4c1d95 0%, #5b21b6 60%, #7c3aed 100%)',
};

const UGC_THEME_EMOJI: Record<string, string> = {
  foodie: '🍜', mountain: '🏔️', ocean: '🌊', editor_pick: '📍', hidden: '🗺️',
};

const UGC_THEME_LABEL: Record<string, string> = {
  foodie: '大胃王', mountain: '山大王', ocean: '海公主', editor_pick: '小編私房', hidden: '秘境探索',
};

/* ─── UGC Overview Modal ─── */
function UgcOverviewModal({
  item,
  onClose,
  onEnterPreview,
  isLoading,
}: {
  item: SharedItinerary;
  onClose: () => void;
  onEnterPreview: () => void;
  isLoading: boolean;
}) {
  const accent = UGC_THEME_ACCENT[item.theme ?? ''] ?? '#005FB8';
  const gradient = UGC_THEME_GRADIENT[item.theme ?? ''] ?? 'linear-gradient(160deg, #1a2e1a 0%, #2d4a2d 100%)';
  const emoji = UGC_THEME_EMOJI[item.theme ?? ''] ?? '🗺️';
  const themeLabel = UGC_THEME_LABEL[item.theme ?? ''] ?? '探索';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="ugc-modal-backdrop"
        className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="ugc-modal-sheet"
        className="fixed inset-x-0 bottom-0 z-[55] mx-auto flex flex-col overflow-hidden"
        style={{ maxWidth: 520, maxHeight: '80dvh', borderRadius: '24px 24px 0 0' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
      >
        {/* Hero header */}
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ height: 200, background: gradient, borderRadius: '24px 24px 0 0' }}
        >
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.3) 20px,rgba(255,255,255,0.3) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,0.3) 20px,rgba(255,255,255,0.3) 21px)',
            }}
          />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
          >
            <X size={15} color="white" />
          </button>

          {/* Identity */}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <span
              className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              {emoji} {themeLabel}
            </span>
            <h2 className="font-serif text-xl font-black leading-tight text-white drop-shadow-md">
              {item.adventure_name}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white px-5 pb-36 pt-5">
          {/* Stats row */}
          <div className="mb-5 flex gap-4">
            {[
              { label: '天數', value: `${item.days_count} 天` },
              { label: '景點', value: `${item.stops_count} 站` },
              { label: '已採用', value: `${item.adopted_count.toLocaleString()} 人` },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 rounded-xl bg-gray-50 px-3 py-3 text-center">
                <p className="text-xs font-black text-gray-800">{value}</p>
                <p className="mt-0.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* Popularity badge */}
          {item.adopted_count > 0 && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: '#e45c1c0d', border: '1px solid #e45c1c20' }}
            >
              <Flame size={14} style={{ color: '#e45c1c' }} />
              <p className="text-xs text-[#e45c1c]">
                已有 <strong>{item.adopted_count.toLocaleString()}</strong> 位冒險者採用此行程
              </p>
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            這是一位社群冒險者精心規劃的 {item.days_count} 天台東旅程，共涵蓋 {item.stops_count} 個精選地點。點擊下方按鈕可在工作台上免費預覽，不會影響你目前的行程。
          </p>
        </div>

        {/* Fixed CTA */}
        <div className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-5 pb-8 pt-4">
          <motion.button
            onClick={onEnterPreview}
            disabled={isLoading}
            whileHover={isLoading ? {} : { scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="w-full rounded-2xl py-4 text-sm font-black text-white disabled:opacity-60"
            style={{
              background: isLoading
                ? '#e45c1c80'
                : 'linear-gradient(135deg, #e45c1c 0%, #f97316 100%)',
              boxShadow: isLoading ? 'none' : '0 4px 20px rgba(228,92,28,0.35)',
            }}
          >
            {isLoading ? '載入行程中…' : '🛠️ 進入工作台試玩 / 微調'}
          </motion.button>
          <p className="mt-2.5 text-center text-[9px] text-gray-400">
            預覽模式 · 不影響你目前的行程 · 隨時可放棄
          </p>
        </div>
      </motion.div>
    </>
  );
}

function UgcCard({ item, index, onClick }: { item: SharedItinerary; index: number; onClick: () => void }) {
  const accent = item.theme && UGC_THEME_ACCENT[item.theme] ? UGC_THEME_ACCENT[item.theme] : '#005FB8';
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="relative flex shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-left [scroll-snap-align:start]"
      style={{ width: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
    >
      {/* Colour accent header */}
      <div
        className="relative flex items-center justify-center px-3 py-4"
        style={{ background: `${accent}12`, minHeight: 80 }}
      >
        {item.adopted_count > 0 && (
          <span
            className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold shadow-sm"
            style={{ color: '#e45c1c' }}
          >
            <Flame size={9} /> {item.adopted_count}
          </span>
        )}
        <p className="line-clamp-2 text-center font-serif text-sm font-bold leading-snug text-gray-900">
          {item.adventure_name}
        </p>
      </div>

      {/* Stats */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-bold text-gray-700">{item.days_count} 天</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{item.stops_count} 站</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
          <Flame size={9} style={{ color: '#e45c1c' }} />
          <span>{item.adopted_count.toLocaleString()} 人採用</span>
        </div>
      </div>
    </motion.button>
  );
}

function UgcSection({ onCardClick }: { onCardClick: (item: SharedItinerary) => void }) {
  const [items, setItems] = useState<SharedItinerary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('shared_itineraries')
      .select('id, adventure_name, days_count, stops_count, adopted_count, theme, created_at')
      .eq('is_public', true)
      .order('adopted_count', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setItems(data as SharedItinerary[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-1" style={{ background: '#e45c1c' }} />
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-900">冒險者推薦旅程</p>
        <span className="ml-auto text-[9px] font-bold text-gray-400">依熱度排序</span>
      </div>

      {loading && (
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[148px] w-40 shrink-0 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center">
          <p className="mb-2 text-2xl">🗺️</p>
          <p className="text-xs text-gray-400">尚無冒險者分享行程</p>
          <p className="mt-0.5 text-[10px] text-gray-300">完成規劃後點「分享旅程」，成為第一個！</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div
            className="-mx-5 flex flex-nowrap gap-3 overflow-x-auto px-5 pb-3"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory' }}
          >
            {items.map((item, i) => (
              <UgcCard key={item.id} item={item} index={i} onClick={() => onCardClick(item)} />
            ))}
            <div className="w-2 shrink-0" />
          </div>
          <p className="mt-0.5 text-center text-[9px] tracking-widest text-[#A09488]">
            左右滑動 · 點擊預覽行程 👁️
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Food Section ─── */
type FoodCategory = '在地小吃' | '特色風味' | '甜點冰品' | '咖啡茶飲';

interface FoodItem {
  id: string;
  name: string;
  quote?: string | null;
  category: FoodCategory;
  tags?: string[] | null;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  popularity?: number;
}

const FOOD_CATS: Array<FoodCategory | '全部'> = ['全部', '在地小吃', '特色風味', '甜點冰品', '咖啡茶飲'];
const FOOD_CAT_META: Record<FoodCategory | '全部', { emoji: string; gradient: string }> = {
  全部:   { emoji: '🍽️', gradient: 'linear-gradient(160deg, #7c2d12 0%, #9a3412 100%)' },
  在地小吃: { emoji: '🍱', gradient: 'linear-gradient(160deg, #7c2d12 0%, #b45309 100%)' },
  特色風味: { emoji: '🌶️', gradient: 'linear-gradient(160deg, #991b1b 0%, #b91c1c 100%)' },
  甜點冰品: { emoji: '🍧', gradient: 'linear-gradient(160deg, #86198f 0%, #a21caf 100%)' },
  咖啡茶飲: { emoji: '☕', gradient: 'linear-gradient(160deg, #451a03 0%, #78350f 100%)' },
};

function mapFoodCategory(cat: string | null | undefined): FoodCategory {
  if (cat === 'local' || cat === 'snack' || cat === '在地小吃') return '在地小吃';
  if (cat === 'specialty' || cat === '特色風味') return '特色風味';
  if (cat === 'dessert' || cat === 'sweet' || cat === '甜點冰品') return '甜點冰品';
  if (cat === 'coffee' || cat === 'tea' || cat === '咖啡茶飲') return '咖啡茶飲';
  return '在地小吃';
}

function FoodSection() {
  const [allFoods, setAllFoods] = useState<FoodItem[]>([]);
  const [activeCat, setActiveCat] = useState<FoodCategory | '全部'>('全部');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('food')
      .select('id, name, description, lat, lng, category, image_url, popularity')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[野台東] food fetch 失敗:', error.message); }
        const foods: FoodItem[] = (data ?? []).map((row) => ({
          id: String(row.id),
          name: row.name ?? '',
          quote: row.description ?? null,
          category: mapFoodCategory(row.category),
          image_url: row.image_url ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          popularity: (row.popularity as number) ?? 0,
        }));
        foods.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        setAllFoods(foods);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = activeCat === '全部' ? allFoods : allFoods.filter((f) => f.category === activeCat);

  function handleFoodClick(food: FoodItem) {
    supabase.from('food').update({ popularity: (food.popularity ?? 0) + 1 }).eq('id', food.id).then(() => {});
  }

  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-1" style={{ background: '#e45c1c' }} />
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-900">美食指南</p>
        <span className="ml-auto text-[9px] font-bold text-gray-400">依熱度排序</span>
      </div>

      {/* Food category filter pills */}
      <div
        className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {FOOD_CATS.map((cat) => (
          <motion.button
            key={cat}
            onClick={() => setActiveCat(cat)}
            whileTap={{ scale: 0.93 }}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 transition-all duration-150"
            style={{
              background: activeCat === cat ? '#e45c1c' : '#ffffff',
              color: activeCat === cat ? '#ffffff' : '#374151',
              boxShadow: activeCat === cat ? '0 2px 8px rgba(228,92,28,0.28)' : '0 1px 4px rgba(0,0,0,0.10)',
              border: activeCat === cat ? 'none' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <span className="text-sm leading-none">{FOOD_CAT_META[cat].emoji}</span>
            <span className="text-[11px] font-semibold">{cat}</span>
          </motion.button>
        ))}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-60 w-40 shrink-0 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      )}

      {/* Swipeable food card deck */}
      {!loading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCat}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="-mx-5 flex flex-nowrap overflow-x-auto snap-x snap-mandatory pb-5 pt-3 pl-5 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {filtered.length === 0 ? (
              <div className="ml-0 flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-gray-200">
                <p className="text-xs text-gray-400">此分類暫無美食資料</p>
              </div>
            ) : filtered.map((food, i) => (
              <SpotCard
                key={food.id}
                spot={food as Spot}
                index={i}
                mode={activeCat === '全部' ? 'all' : 'single'}
                isFirst={i === 0}
                stackZ={filtered.length - i}
                overrideEmoji={FOOD_CAT_META[food.category]?.emoji}
                overrideGradient={FOOD_CAT_META[food.category]?.gradient}
                overrideLabel={food.category}
                onClick={() => handleFoodClick(food)}
              />
            ))}
            <div className="w-8 shrink-0" />
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && filtered.length > 0 && (
        <p className="mt-0.5 text-center text-[9px] tracking-widest text-[#A09488]">
          左右滑動 · 輕觸探索
        </p>
      )}

    </div>
  );
}

/* ─── Spot Category Pill ─── */
const SPOT_CATS: Array<SpotCategory | '全部'> = ['全部', '縱谷線', '南迴線', '海線', '市區'];
const SPOT_CAT_META: Record<SpotCategory | '全部', { emoji: string }> = {
  全部:  { emoji: '🗺️' },
  縱谷線: { emoji: '🏔️' },
  南迴線: { emoji: '🌄' },
  海線:  { emoji: '🌊' },
  市區:  { emoji: '🏮' },
};

// 地區過濾雙軌對照表
// ─ wildTag : wild_tags 陣列中的中文標籤（scraper 寫入）
// ─ cats    : category 欄位的英文代碼（admin UI / Maps_scraper 寫入）
const AREA_DB_MAP: Record<SpotCategory, { wildTag: string; cats: string[]; nameKws: string[] }> = {
  縱谷線: { wildTag: '縱谷線', cats: ['mtn', 'valley', 'mountain', 'rail'],                        nameKws: ['鹿野', '初鹿', '延平', '關山', '池上', '海端', '布農', '鸞山', '錦屏', '縱谷'] },
  南迴線: { wildTag: '南迴線', cats: ['south'],                                                     nameKws: ['大武', '達仁', '金峰', '太麻里', '多良', '南迴'] },
  海線:   { wildTag: '海線',   cats: ['sea', 'islands', 'ocean'],                                   nameKws: ['綠島', '蘭嶼', '三仙台', '加路蘭', '東河', '成功', '長濱', '石梯坪'] },
  市區:   { wildTag: '市區',   cats: ['city', 'attraction', 'cultural', 'food', 'spring', 'hidden'], nameKws: [] },
};


function SpotSection({
  activeSpotCat,
  onCatChange,
  onSpotClick,
  onSubmitSpot,
}: {
  activeSpotCat: SpotCategory | '全部';
  onCatChange: (c: SpotCategory | '全部') => void;
  onSpotClick: (spot: Spot) => void;
  onSubmitSpot?: () => void;
}) {
  const [spots,       setSpots]       = useState<Spot[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [keyword,     setKeyword]     = useState('');
  const [debouncedKw, setDebouncedKw] = useState('');

  // 300ms debounce，避免每次按鍵都打 DB
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKw(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // ── 基礎查詢，affiliate_link 為 text 欄位（單數），供卡片顯示訂票按鈕 ──
    let req = supabase
      .from('places')
      .select('id, name, description, lat, lng, wild_tags, category, quote, image_url, popularity, affiliate_link')
      .order('popularity', { ascending: false });

    // ── 地區過濾：三軌並聯 — wild_tags 中文標籤 OR category 英文代碼 OR 地名關鍵字 ──
    if (activeSpotCat !== '全部') {
      const { wildTag, cats, nameKws } = AREA_DB_MAP[activeSpotCat];
      const conditions = [
        `wild_tags.cs.{${wildTag}}`,
        ...cats.map(c => `category.eq.${c}`),
        ...nameKws.map(kw => `name.ilike.%${kw}%`),
      ].join(',');
      req = req.or(conditions);
    }

    // ── 關鍵字搜尋：name / quote / description 模糊比對 ────────────────────
    if (debouncedKw.trim()) {
      const kw = debouncedKw.trim().replace(/[%_\\]/g, c => `\\${c}`);
      req = req.or(`name.ilike.%${kw}%,quote.ilike.%${kw}%,description.ilike.%${kw}%`);
    }

    req.then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        // 查詢失敗時不清空現有景點，維持上一次可見狀態
        console.error('[野台東] places fetch 失敗:', error.message);
        setLoading(false);
        return;
      }
      const mapped: Spot[] = (data ?? []).map((row) => ({
        id:             String(row.id),
        name:           row.name ?? '',
        quote:          row.quote ?? row.description ?? null,
        category:       mapDbCategory(row.category),
        tags:           Array.isArray(row.wild_tags) ? (row.wild_tags as string[]) : [],
        image_url:      row.image_url ?? null,
        lat:            row.lat ?? null,
        lng:            row.lng ?? null,
        popularity:     (row.popularity as number) ?? 0,
        affiliate_link: typeof row.affiliate_link === 'string' && row.affiliate_link ? row.affiliate_link : null,
      }));
      setSpots(mapped);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSpotCat, debouncedKw]);

  const mode = activeSpotCat === '全部' ? 'all' : 'single';

  function handleSpotClick(spot: Spot) {
    supabase.from('places').update({ popularity: (spot.popularity ?? 0) + 1 }).eq('id', spot.id).then(() => {});
    onSpotClick(spot);
  }

  return (
    <div className="mb-7">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-1 bg-[#005FB8]" />
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-900">秘境景點手札</p>
      </div>

      {/* Spot category filter pills */}
      <div
        className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {SPOT_CATS.map((cat) => (
          <motion.button
            key={cat}
            onClick={() => onCatChange(cat)}
            whileTap={{ scale: 0.93 }}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 transition-all duration-150"
            style={{
              background: activeSpotCat === cat ? '#16a34a' : '#ffffff',
              color: activeSpotCat === cat ? '#ffffff' : '#374151',
              boxShadow: activeSpotCat === cat ? '0 2px 8px rgba(22,163,74,0.28)' : '0 1px 4px rgba(0,0,0,0.10)',
              border: activeSpotCat === cat ? 'none' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <span className="text-sm leading-none">{SPOT_CAT_META[cat].emoji}</span>
            <span className="text-[11px] font-semibold">{cat}</span>
          </motion.button>
        ))}
      </div>

      {/* ── 關鍵字搜尋框 ────────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <Search
          size={13}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜尋景點名稱，如：布農、利嘉、金樽..."
          className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#005FB8]/25"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => setKeyword('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-60 w-40 shrink-0 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      )}

      {/* Swipeable card deck */}
      {!loading && (
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeSpotCat}-${debouncedKw}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="-mx-5 flex flex-nowrap overflow-x-auto snap-x snap-mandatory pb-5 pt-3 pl-5 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {spots.length === 0 ? (
            <div className="ml-0 flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">
                {debouncedKw ? `找不到「${debouncedKw}」相關景點` : '此分類暫無景點資料'}
              </p>
            </div>
          ) : spots.map((spot, i) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              index={i}
              mode={mode}
              isFirst={i === 0}
              stackZ={spots.length - i}
              onClick={() => handleSpotClick(spot)}
            />
          ))}
          <div className="w-8 shrink-0" />
        </motion.div>
      </AnimatePresence>
      )}

      {!loading && mode === 'all' && spots.length > 0 && (
        <p className="mt-0.5 text-center text-[9px] tracking-widest text-[#A09488]">
          左右滑動 · 輕觸探索
        </p>
      )}

      {/* 秘境上架申請 */}
      <motion.button
        onClick={onSubmitSpot}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 24 }}
        className="mt-3 w-full rounded-2xl border-2 border-dashed px-4 py-3 text-center text-[11px] font-semibold leading-snug transition-colors"
        style={{
          borderColor: 'rgba(160,148,136,0.40)',
          background: 'rgba(255,255,255,0.50)',
          color: '#5A645A',
        }}
      >
        ✨ 你們的秘境不夠看？我要上架新景點
      </motion.button>
    </div>
  );
}

/* ─── Submit Spot Modal ─── */
function SubmitSpotModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [route, setRoute] = useState('縱谷線');
  const [quote, setQuote] = useState('');
  const [guide, setGuide] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const ok = name.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitSpotUgc({ name, route, quote, guide, tags, email: email || undefined, image_url: imageUrl || null });
      if (result.error) { setSubmitError(result.error); setSubmitting(false); return; }
      fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new_spot', spot_name: name, category: route, quote, image_url: imageUrl || null }),
      });
      onSuccess();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '提交失敗，請稍後再試');
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div key="ss-backdrop" className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onClick={onClose} />
      <motion.div key="ss-sheet"
        className="fixed inset-x-0 bottom-0 z-[55] mx-auto flex flex-col overflow-hidden"
        style={{ maxWidth: 520, maxHeight: '90dvh', borderRadius: '24px 24px 0 0' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
      >
        {/* Header */}
        <div className="relative shrink-0 px-5 pb-4 pt-5"
          style={{ background: 'linear-gradient(160deg, #2d5016 0%, #1a3a2a 100%)' }}>
          <button onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30">
            <X size={15} color="white" />
          </button>
          <span className="mb-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            🌿 秘境共創計畫
          </span>
          <h2 className="font-serif text-lg font-black leading-tight text-white">探險家，分享你的秘境吧</h2>
          <p className="mt-1 text-[10px] text-white/60">由主理人審核後，將正式收入台東手札</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-40 pt-5" style={{ background: '#FDFBF6' }}>

          <Field label="景點名稱 *" accent="#16a34a">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="例：都蘭某處沒有名字的浪"
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(90,100,90,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="旅行路線" accent="#16a34a">
            <div className="flex flex-wrap gap-2">
              {(['縱谷線','南迴線','海線','市區'] as const).map((r) => (
                <motion.button
                  key={r}
                  type="button"
                  onClick={() => setRoute(r)}
                  whileTap={{ scale: 0.93 }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
                  style={{
                    background: route === r ? '#16a34a' : '#fff',
                    color: route === r ? '#fff' : '#3D3530',
                    border: route === r ? '1.5px solid transparent' : '1px solid rgba(90,100,90,0.18)',
                    boxShadow: route === r ? '0 2px 8px rgba(22,163,74,0.28), inset 0 1px 2px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {r}
                </motion.button>
              ))}
            </div>
          </Field>

          <Field label="探險家短評" accent="#16a34a" count={quote.length} max={40}>
            <textarea value={quote} onChange={(e) => setQuote(e.target.value.slice(0, 40))}
              placeholder="用一句富有詩意的話，形容你被這片土地擁抱的瞬間..."
              rows={2} className="w-full resize-none rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(90,100,90,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="詳細探索指南" accent="#16a34a">
            <textarea value={guide} onChange={(e) => setGuide(e.target.value)}
              placeholder="告訴大家怎麼走、有什麼需要注意的防防呆防護..."
              rows={3} className="w-full resize-none rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(90,100,90,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="秘境印記 (Tags)" accent="#16a34a">
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="用逗號分隔標籤，例：野溪, 沖瀑, 無訊號"
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(90,100,90,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="📸 秘境實景連結" accent="#16a34a">
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="例：請貼上 IG 貼文、FB 或公開相簿的照片網址..."
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(90,100,90,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="聯絡 Email（選填）" accent="#16a34a">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="若希望收到通過或不通過的回覆，請留下您的 Email"
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(90,100,90,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>
        </div>

        {/* CTAs */}
        <ModalFooter onClose={onClose} onAction={handleSubmit} ok={ok}
          submitting={submitting} error={submitError}
          accent="linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
          shadow="0 4px 16px rgba(22,163,74,0.30)"
          bg="#FDFBF6" border="rgba(90,100,90,0.10)" hoverBg="#F0EDE7" />
      </motion.div>
    </>
  );
}

/* ─── Submit Food Modal ─── */
function SubmitFoodModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [route, setRoute] = useState('縱谷線');
  const [foodCat, setFoodCat] = useState('在地小吃');
  const [quote, setQuote] = useState('');
  const [desc, setDesc] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const ok = name.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitFoodUgc({ name, route, food_cat: foodCat, quote, desc, email: email || undefined, image_url: imageUrl || null });
      if (result.error) { setSubmitError(result.error); setSubmitting(false); return; }
      fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new_food', spot_name: name, category: `${route} · ${foodCat}`, quote, image_url: imageUrl || null }),
      });
      onSuccess();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '提交失敗，請稍後再試');
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div key="sf-backdrop" className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onClick={onClose} />
      <motion.div key="sf-sheet"
        className="fixed inset-x-0 bottom-0 z-[55] mx-auto flex flex-col overflow-hidden"
        style={{ maxWidth: 520, maxHeight: '90dvh', borderRadius: '24px 24px 0 0' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
      >
        {/* Header */}
        <div className="relative shrink-0 px-5 pb-4 pt-5"
          style={{ background: 'linear-gradient(160deg, #7c2d12 0%, #b45309 100%)' }}>
          <button onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30">
            <X size={15} color="white" />
          </button>
          <span className="mb-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            🎪 店家自主上架計畫
          </span>
          <h2 className="font-serif text-lg font-black leading-tight text-white">端出你家的驕傲</h2>
          <p className="mt-1 text-[10px] text-white/60">由主理人審核後，正式登上台東美食指南</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-40 pt-5" style={{ background: '#FFFBF5' }}>

          <Field label="店名 / 攤位名稱 *" accent="#e45c1c">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="例：蓋在太平洋眉毛上的焢肉飯"
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(180,83,9,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="所在區域" accent="#e45c1c">
            <div className="flex flex-wrap gap-2">
              {(['縱谷線','南迴線','海線','市區'] as const).map((r) => (
                <motion.button
                  key={r}
                  type="button"
                  onClick={() => setRoute(r)}
                  whileTap={{ scale: 0.93 }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
                  style={{
                    background: route === r ? '#e45c1c' : '#fff',
                    color: route === r ? '#fff' : '#3D3530',
                    border: route === r ? '1.5px solid transparent' : '1px solid rgba(180,83,9,0.18)',
                    boxShadow: route === r ? '0 2px 8px rgba(228,92,28,0.28), inset 0 1px 2px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {r}
                </motion.button>
              ))}
            </div>
          </Field>

          <Field label="美食分類" accent="#e45c1c">
            <div className="flex flex-wrap gap-2">
              {(['在地小吃','特色風味','甜點冰品','咖啡茶飲'] as const).map((c) => (
                <motion.button
                  key={c}
                  type="button"
                  onClick={() => setFoodCat(c)}
                  whileTap={{ scale: 0.93 }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
                  style={{
                    background: foodCat === c ? '#e45c1c' : '#fff',
                    color: foodCat === c ? '#fff' : '#3D3530',
                    border: foodCat === c ? '1.5px solid transparent' : '1px solid rgba(180,83,9,0.18)',
                    boxShadow: foodCat === c ? '0 2px 8px rgba(228,92,28,0.28), inset 0 1px 2px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {c}
                </motion.button>
              ))}
            </div>
          </Field>

          <Field label="主理人情懷" accent="#e45c1c" count={quote.length} max={40}>
            <textarea value={quote} onChange={(e) => setQuote(e.target.value.slice(0, 40))}
              placeholder="例：我們不只顧飯，還賣台東最純粹的驕傲..."
              rows={2} className="w-full resize-none rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(180,83,9,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="特色描述" accent="#e45c1c">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="介紹一下你們家的拿手好菜、招牌美味與營業時間..."
              rows={3} className="w-full resize-none rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(180,83,9,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="🍱 招牌美味連結" accent="#e45c1c">
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="例：請貼上餐點照片的公開網址..."
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(180,83,9,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>

          <Field label="聯絡 Email（選填）" accent="#e45c1c">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="若希望收到通過或不通過的回覆，請留下您的 Email"
              className="w-full rounded-xl border px-4 py-3 text-xs outline-none placeholder:text-[#C8BFB5]"
              style={{ borderColor: 'rgba(180,83,9,0.15)', background: '#fff', color: '#3D3530' }} />
          </Field>
        </div>

        {/* CTAs */}
        <ModalFooter onClose={onClose} onAction={handleSubmit} ok={ok}
          submitting={submitting} error={submitError}
          accent="linear-gradient(135deg, #e45c1c 0%, #f97316 100%)"
          shadow="0 4px 16px rgba(228,92,28,0.30)"
          bg="#FFFBF5" border="rgba(180,83,9,0.10)" hoverBg="#FEF3C7" />
      </motion.div>
    </>
  );
}

/* ─── Shared micro-components for modals ─── */
function Field({ label, accent, count, max, children }: {
  label: string; accent: string; count?: number; max?: number; children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest"
        style={{ color: accent }}>
        <span>{label}</span>
        {max !== undefined && <span className="font-normal text-[#A09488]">{count}/{max}</span>}
      </label>
      {children}
    </div>
  );
}


function ModalFooter({ onClose, onAction, ok, submitting, error, accent, shadow, bg, border, hoverBg }: {
  onClose: () => void; onAction: () => void; ok: boolean;
  submitting?: boolean; error?: string | null;
  accent: string; shadow: string; bg: string; border: string; hoverBg: string;
}) {
  const canSubmit = ok && !submitting;
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 border-t px-5 pb-8 pt-4"
      style={{ background: bg, borderColor: border }}>
      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] leading-relaxed text-red-600">
          ⚠️ {error}
        </p>
      )}
      <div className="flex gap-2.5">
        <button onClick={onClose} disabled={submitting}
          className="flex-1 rounded-xl border py-3 text-[11px] font-bold text-[#8E8377] transition-colors disabled:opacity-40"
          style={{ borderColor: border }}
          onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
          先這樣，回手札
        </button>
        <motion.button
          onClick={canSubmit ? onAction : undefined}
          whileHover={canSubmit ? { scale: 1.03, y: -1 } : {}}
          whileTap={canSubmit ? { scale: 0.97 } : {}}
          disabled={!canSubmit}
          className="flex-[2] rounded-xl py-3 text-[11px] font-black text-white disabled:opacity-40"
          style={{ background: accent, boxShadow: canSubmit ? shadow : 'none' }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          {submitting ? '提交中…' : '🔥 蓋上印章，提交審查'}
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
interface Props {
  onRouteClick: (route: CuratedRoute) => void;
  onCustomBuilder: () => void;
  expanded?: boolean;
  onExpandChange?: (v: boolean) => void;
  onEnterPreview?: () => void;
}

export default function ExploreSheet({
  onRouteClick, onCustomBuilder, expanded: controlledExpanded, onExpandChange, onEnterPreview,
}: Props) {
  const router = useRouter();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [activeTheme, setActiveTheme] = useState<AdventureTheme | 'all'>('all');
  const [activeSpotCat, setActiveSpotCat] = useState<SpotCategory | '全部'>('全部');
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedUgcItem, setSelectedUgcItem] = useState<SharedItinerary | null>(null);
  const [enteringPreview, setEnteringPreview] = useState(false);
  const [isSubmitSpotOpen, setIsSubmitSpotOpen] = useState(false);
  const [isSubmitFoodOpen, setIsSubmitFoodOpen] = useState(false);

  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const scrollRef = useRef<HTMLDivElement>(null);

  const setExpanded = (v: boolean) => {
    setInternalExpanded(v);
    onExpandChange?.(v);
  };

  // Reset scroll to top whenever the sheet collapses
  useEffect(() => {
    if (!expanded && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [expanded]);

  const { tripStartDate, tripEndDate, setTripDates, clearTrip, enterPreviewMode, setBuilderDays: setItineraryBuilderDays, currentChallengeName } = useItineraryStore();
  const { days: builderDays, setDays: setBuilderDays, setAdventureName: setBuilderAdventureName } = useBuilderStore();

  async function handleEnterPreview() {
    if (!selectedUgcItem || enteringPreview) return;
    setEnteringPreview(true);
    try {
      const { data } = await supabase
        .from('shared_itineraries')
        .select('days_data')
        .eq('id', selectedUgcItem.id)
        .single();
      if (data?.days_data) {
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
        const builderDays = data.days_data as BuilderDay[];
        setBuilderDays(builderDays);
        setBuilderAdventureName(selectedUgcItem.adventure_name);
        enterPreviewMode(
          builderDays,
          selectedUgcItem.adventure_name,
          selectedUgcItem.id,
          selectedUgcItem.adopted_count,
          tripStartDate || today,
        );
      }
      setSelectedUgcItem(null);
      setExpanded(false);
      onEnterPreview?.();
      router.push('/itinerary/builder');
    } finally {
      setEnteringPreview(false);
    }
  }

  function handleAddToDay(dayIndex: number) {
    if (!selectedSpot) return;
    const spot = selectedSpot;
    const stop: CuratedStop = {
      id: spot.id,
      name: spot.name,
      category: 'attraction',
      latitude: spot.lat ?? 22.7583,
      longitude: spot.lng ?? 121.1443,
      stay_duration: 90,
    };

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    const effectiveStart = tripStartDate || today;

    let newDays: BuilderDay[];
    let toastMsg: string;
    let toastMs: number;

    if (dayIndex === -1 || builderDays.length === 0) {
      newDays = [{
        day: 1,
        label: 'Day 1',
        has_island: false,
        stops: [stop],
        date: effectiveStart,
        departureTime: '09:00',
      }];
      toastMsg = `已將「${spot.name}」加入 Day 1，請至工作台調整日期 ✓`;
      toastMs  = 3200;
    } else {
      const alreadyInDay = builderDays[dayIndex]?.stops.some(s => s.id === stop.id);
      if (alreadyInDay) {
        setToast(`「${spot.name}」已在 Day ${builderDays[dayIndex].day} 中，略過重複加入`);
        setTimeout(() => setToast(null), 2000);
        setSelectedSpot(null);
        return;
      }
      newDays = builderDays.map((d, i) =>
        i === dayIndex ? { ...d, stops: [...d.stops, stop] } : d,
      );
      toastMsg = `已將「${spot.name}」加入 Day ${builderDays[dayIndex].day} ✓`;
      toastMs  = 2800;
    }

    // 同步寫入兩個 Store：builder（編輯狀態）+ itinerary（主地圖 MapDayFilter 讀取來源）
    setBuilderDays(newDays);
    setItineraryBuilderDays(newDays, effectiveStart);

    setSelectedSpot(null);
    setToast(toastMsg);
    setTimeout(() => setToast(null), toastMs);
  }

  const allFeatured = ALL_THEMES
    .map((t) => {
      const candidates = MOCK_CURATED_ROUTES.filter((r) => r.theme === t);
      return candidates.sort((a, b) => b.rating - a.rating)[0];
    })
    .filter(Boolean) as CuratedRoute[];

  const filteredRoutes = activeTheme === 'all'
    ? allFeatured
    : allFeatured.filter((r) => r.theme === activeTheme);

  const tripDays = tripStartDate && tripEndDate
    ? Math.ceil((new Date(tripEndDate).getTime() - new Date(tripStartDate).getTime()) / 86_400_000)
    : null;

  const innerContent = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8" style={{ scrollbarWidth: 'none' }}>

      {/* ── Section 1: 旅遊日期 ── */}
      <div className="mb-7 pt-2">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-1 bg-[#005FB8]" />
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-900">旅遊日期</p>
        </div>

        <DateRangePicker
          startDate={tripStartDate}
          endDate={tripEndDate}
          onChange={(start, end) => setTripDates(start, end)}
          onClear={() => { clearTrip(); setBuilderDays([]); }}
          onOpen={() => { if (!expanded) setExpanded(true); }}
        />

        <AnimatePresence>
          {tripDays !== null && tripDays > 0 && (
            <motion.div
              key="trip-days"
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-3 text-center text-[11px] font-black text-gray-600">
                共 <span className="font-black text-[#005FB8]">{tripDays}</span> 天的台東旅程
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Section 2: 推薦遊玩方式 ── */}
      <div className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-1 bg-[#005FB8]" />
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-900">推薦遊玩方式</p>
        </div>
        <div
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <CategoryPill label="全部" emoji="⚔️" active={activeTheme === 'all'} onClick={() => setActiveTheme('all')} />
          {ALL_THEMES.map((t) => (
            <CategoryPill
              key={t}
              label={THEME_META[t].label}
              photo_url={THEME_META[t].photo_url}
              active={activeTheme === t}
              onClick={() => setActiveTheme(t)}
            />
          ))}
        </div>
      </div>

      {/* ── Section 2b: Quest Deck Carousel ── */}
      <div className="mb-7">
        <div
          className="-mx-5 flex flex-nowrap gap-3 overflow-x-auto px-5 pb-3"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
          }}
        >
          {filteredRoutes.map((route, i) => (
            <RouteCard
              key={`${activeTheme}-${route.id}`}
              route={route}
              index={i}
              onClick={() => onRouteClick(route)}
            />
          ))}
          <div className="w-2 shrink-0" />
        </div>
        {filteredRoutes.length > 1 && (
          <p className="mt-0.5 text-center text-[9px] tracking-widest text-[#A09488]">左右滑動</p>
        )}
      </div>

      {/* ── Section 3: 冒險者推薦旅程 ── */}
      <UgcSection onCardClick={setSelectedUgcItem} />

      {/* ── Section 4: 秘境景點手札 ── */}
      <SpotSection
        activeSpotCat={activeSpotCat}
        onCatChange={setActiveSpotCat}
        onSpotClick={setSelectedSpot}
        onSubmitSpot={() => setIsSubmitSpotOpen(true)}
      />

      {/* ── Section 5: 美食指南 ── */}
      <FoodSection />

      {/* ── 店家上架申請 ── */}
      <div className="mt-4">
        <motion.button
          onClick={() => setIsSubmitFoodOpen(true)}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          className="w-full rounded-2xl border-2 border-dashed px-4 py-3 text-center text-[11px] font-semibold leading-snug transition-colors"
          style={{
            borderColor: 'rgba(228,92,28,0.35)',
            background: 'rgba(254,243,199,0.45)',
            color: '#b45309',
          }}
        >
          🎪 我是店家，我家的東西更好吃！我要上架
        </motion.button>
      </div>

      {/* ── 質感分隔線 ── */}
      <div className="mx-5 my-8 border-t border-[#A09488]/20" />

      {/* ── Section 6: CTA ── */}
      <div>
        <motion.button
          onClick={onCustomBuilder}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="w-full rounded-2xl bg-[#005FB8] py-4 text-sm font-bold tracking-wide text-white"
          style={{ boxShadow: '0 4px 20px rgba(0,95,184,0.30)' }}
        >
          <span className="flex items-center justify-center gap-2 font-serif">
            <Compass size={14} />
            自定義冒險遊程
          </span>
        </motion.button>
        <p className="mt-3 text-center text-[10px] font-bold tracking-wide text-gray-500">
          多天行程 · 自由規劃 · 一鍵匯出
        </p>
      </div>

      {/* ── Studio Credit Footer ── */}
      <div className="mt-8 border-t border-[#A09488]/20 pt-6 pb-8 text-center font-mono text-[10px] tracking-widest text-[#A09488]/60">
        <p>ONE CIRCLE STUDIO · 一圈工作室 © 2026</p>
        <p className="mt-1 text-[8px] opacity-70">WILD TAITUNG PROJECT · MADE IN TAITUNG</p>
      </div>

    </div>
  );

  return (
    <>
      {/* ── UGC Overview Modal ── */}
      <AnimatePresence>
        {selectedUgcItem && (
          <UgcOverviewModal
            key={`ugc-modal-${selectedUgcItem.id}`}
            item={selectedUgcItem}
            onClose={() => setSelectedUgcItem(null)}
            onEnterPreview={handleEnterPreview}
            isLoading={enteringPreview}
          />
        )}
      </AnimatePresence>

      {/* ── Submit Spot Modal ── */}
      <AnimatePresence>
        {isSubmitSpotOpen && (
          <SubmitSpotModal
            key="submit-spot-modal"
            onClose={() => setIsSubmitSpotOpen(false)}
            onSuccess={() => {
              setIsSubmitSpotOpen(false);
              setToast('印章已蓋上！主理人正騎著摩托車趕往審查路上... 🏍️');
              setTimeout(() => setToast(null), 3500);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Submit Food Modal ── */}
      <AnimatePresence>
        {isSubmitFoodOpen && (
          <SubmitFoodModal
            key="submit-food-modal"
            onClose={() => setIsSubmitFoodOpen(false)}
            onSuccess={() => {
              setIsSubmitFoodOpen(false);
              setToast('印章已蓋上！主理人正騎著摩托車趕往審查路上... 🏍️');
              setTimeout(() => setToast(null), 3500);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Spot Detail Modal ── */}
      <AnimatePresence>
        {selectedSpot && (
          <SpotDetailModal
            key={`spot-modal-${selectedSpot.id}`}
            spot={selectedSpot}
            days={builderDays}
            onClose={() => setSelectedSpot(null)}
            onAddToDay={handleAddToDay}
          />
        )}
      </AnimatePresence>

      {/* ── Add-to-itinerary Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="spot-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-8 left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold"
            style={{
              background: 'rgba(0,95,184,0.96)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0,95,184,0.30)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop: Left panel ── */}
      <aside
        className="absolute left-0 top-0 z-[30] hidden h-full w-[380px] flex-col overflow-hidden border-r border-gray-100 bg-white/95 shadow-xl backdrop-blur-xl lg:flex"
      >
        <div className="h-[88px] shrink-0" />
        {innerContent}
      </aside>

      {/* ── Mobile: Backdrop — 展開時攔截地圖點擊，讓 sheet 收合 ── */}
      {expanded && (
        <div
          className="fixed inset-0 z-[20] lg:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* ── Mobile: Bottom sheet ── */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[30] mx-auto flex flex-col bg-white/95 shadow-2xl backdrop-blur-xl lg:hidden"
        style={{
          maxWidth: 560,
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(0,0,0,0.06)',
          borderBottom: 'none',
        }}
        animate={{ height: expanded ? '85dvh' : 72 }}
        transition={{ type: 'spring', stiffness: 280, damping: 34 }}
        onPanEnd={(_, info) => {
          if (info.offset.y < -40) setExpanded(true);
          if (info.offset.y > 40)  setExpanded(false);
        }}
      >
        {/* Drag handle */}
        <button
          id="tour-explore-handle"
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full shrink-0 flex-col items-center justify-center gap-2 pb-2 pt-4"
          aria-label={expanded ? '收合面板' : '展開面板'}
        >
          <div className="h-1 w-9 rounded-full bg-[#5A645A]/20" />
          <AnimatePresence mode="wait">
            {expanded ? (
              <motion.div
                key="collapse"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                <ChevronDown size={11} className="text-[#8E8377]" />
                <span className="text-[9px] tracking-widest text-[#8E8377]">收合</span>
              </motion.div>
            ) : (
              <motion.div
                key="nudge"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-0.5"
              >
                <span
                  className="text-[10px] font-bold tracking-[0.18em]"
                  style={{ color: '#D4A373' }}
                >
                  開始旅程
                </span>
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ChevronDown size={14} strokeWidth={2} style={{ color: '#D4A373' }} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {innerContent}
      </motion.div>
    </>
  );
}
