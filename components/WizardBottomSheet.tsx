'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Users, ChevronUp, Compass, Sparkles, Zap } from 'lucide-react';
import { MOCK_CURATED_ROUTES } from '@/lib/mock/curatedRoutes';
import type { AdventureTheme, CuratedRoute } from '@/types';

// ─── Theme metadata ────────────────────────────────────────────────────────

const THEME_META: Record<AdventureTheme, {
  label: string; emoji: string; accent: string; glow: string;
  heroGrad: string; desc: string;
}> = {
  foodie:      { label: '大胃王',   emoji: '🍜', accent: '#c4956a', glow: 'rgba(196,149,106,0.3)',
                 heroGrad: 'linear-gradient(140deg, #3a1808 0%, #1a0d05 55%, #080f0b 100%)',
                 desc: '夜市、漁港、在地小吃全制霸' },
  mountain:    { label: '山大王',   emoji: '🏔️', accent: '#4a8f5f', glow: 'rgba(74,143,95,0.3)',
                 heroGrad: 'linear-gradient(140deg, #0a2a14 0%, #061a0c 55%, #040c08 100%)',
                 desc: '野溪溫泉、溯溪、山林深呼吸' },
  ocean:       { label: '海公主',   emoji: '🌊', accent: '#2dd4bf', glow: 'rgba(45,212,191,0.3)',
                 heroGrad: 'linear-gradient(140deg, #072a2e 0%, #041a1c 55%, #030d0e 100%)',
                 desc: '浮潛、衝浪、東海岸公路' },
  editor_pick: { label: '小編私房', emoji: '📍', accent: '#FF6B35', glow: 'rgba(255,107,53,0.3)',
                 heroGrad: 'linear-gradient(140deg, #2a1005 0%, #180a03 55%, #090e06 100%)',
                 desc: '在地人才知道的私藏路線' },
  hidden:      { label: '小編秘境', emoji: '🗺️', accent: '#8a9e8f', glow: 'rgba(138,158,143,0.3)',
                 heroGrad: 'linear-gradient(140deg, #181f1a 0%, #0e1410 55%, #080c09 100%)',
                 desc: '離開觀光線，找到真正的秘境' },
};

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const REGION_PILLS = ['全區', '東海岸', '縱谷', '台東市', '離島'];
const TYPE_PILLS   = ['全部', '美食', '秘境', '山林', '海洋', '文化'];

// ─── Featured route card ───────────────────────────────────────────────────

function ThemeCard({
  route,
  onClick,
}: {
  route: CuratedRoute;
  onClick: () => void;
}) {
  const meta   = THEME_META[route.theme];
  const accent = meta.accent;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="relative flex shrink-0 flex-col overflow-hidden text-left"
      style={{
        width: 172,
        height: 220,
        borderRadius: 20,
        background: meta.heroGrad,
        border: `1px solid ${accent}28`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Glow orb */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl"
        style={{ background: meta.glow }}
      />

      {/* Hero emoji area */}
      <div className="flex flex-1 items-center justify-center">
        <motion.span
          className="select-none text-[62px] leading-none"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {meta.emoji}
        </motion.span>
      </div>

      {/* Bottom info */}
      <div
        className="relative px-4 pb-4"
        style={{
          background: 'linear-gradient(to top, rgba(4,8,6,0.96) 0%, rgba(4,8,6,0.6) 60%, transparent 100%)',
          paddingTop: 32,
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Star size={9} style={{ color: '#f5c842', fill: '#f5c842' }} />
          <span className="text-[10px] font-bold" style={{ color: 'var(--foreground)' }}>{route.rating}</span>
          <span className="text-[9px] opacity-35" style={{ color: 'var(--wild-mist)' }}>
            ({route.rating_count})
          </span>
        </div>

        <p className="text-[13px] font-bold leading-tight mb-1" style={{ color: 'var(--foreground)' }}>
          {meta.label}
        </p>
        <p className="text-[10px] leading-tight" style={{ color: meta.accent, opacity: 0.85 }}>
          {meta.desc}
        </p>

        <div className="mt-2 flex items-center gap-1 text-[9px]" style={{ color: 'var(--wild-mist)', opacity: 0.45 }}>
          <Users size={8} />
          {route.completion_count.toLocaleString()} 人通關
        </div>
      </div>

      {/* Tap hint arrow */}
      <div
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
      >
        <span className="text-[9px]" style={{ color: accent }}>→</span>
      </div>
    </motion.button>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200"
      style={active ? {
        background: accent ? `${accent}22` : 'rgba(45,212,191,0.18)',
        color: accent ?? 'var(--wild-ocean)',
        border: `1px solid ${accent ? `${accent}45` : 'rgba(45,212,191,0.45)'}`,
        boxShadow: `0 0 12px ${accent ? `${accent}30` : 'rgba(45,212,191,0.25)'}`,
      } : {
        background: 'rgba(255,255,255,0.05)',
        color: 'var(--wild-mist)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {label}
    </motion.button>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  days: number | null;
  theme: AdventureTheme | null;
  onDaysChange: (days: number) => void;
  onThemeChange: (theme: AdventureTheme) => void;
  onRouteClick: (route: CuratedRoute) => void;
  onCustomBuilder: () => void;
}

// ─── Main component ────────────────────────────────────────────────────────

export default function WizardBottomSheet({
  days,
  theme,
  onDaysChange,
  onThemeChange,
  onRouteClick,
  onCustomBuilder,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [region, setRegion] = useState('全區');
  const [type, setType] = useState('全部');

  // Pick one featured route per theme (best-rated)
  const featuredRoutes = (['ocean', 'mountain', 'foodie', 'editor_pick', 'hidden'] as AdventureTheme[])
    .map((t) => {
      const candidates = MOCK_CURATED_ROUTES.filter(
        (r) => r.theme === t && (days === null || r.days === days || true)
      );
      return candidates.sort((a, b) => b.rating - a.rating)[0];
    })
    .filter(Boolean) as CuratedRoute[];

  const PEEK_H  = '52vh';
  const FULL_H  = '84vh';

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex flex-col"
      style={{
        maxWidth: 560,
        borderRadius: '24px 24px 0 0',
        background: 'rgba(8,14,10,0.88)',
        backdropFilter: 'blur(28px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottom: 'none',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.6)',
      }}
      animate={{ height: expanded ? FULL_H : PEEK_H }}
      transition={{ type: 'spring', stiffness: 280, damping: 34 }}
      // Swipe up/down to expand/collapse
      onPanEnd={(_, info) => {
        if (info.offset.y < -40) setExpanded(true);
        if (info.offset.y > 40) setExpanded(false);
      }}
    >
      {/* ── Drag handle ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-center pb-2 pt-3.5 focus:outline-none"
        aria-label={expanded ? '收合面板' : '展開面板'}
      >
        <div className="h-1 w-10 rounded-full bg-white/20" />
      </button>

      {/* ── Scrollable inner ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">

        {/* ── Section 1: 選擇天數 ── */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.45em] opacity-50" style={{ color: 'var(--wild-mist)' }}>
              旅遊天數
            </p>
            {days && (
              <AnimatePresence>
                <motion.span
                  key={days}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-bold"
                  style={{ color: 'var(--wild-ocean)' }}
                >
                  已選 {days} 天
                </motion.span>
              </AnimatePresence>
            )}
          </div>
          <div className="flex gap-2">
            {DAY_OPTIONS.map((n) => {
              const active = days === n;
              return (
                <motion.button
                  key={n}
                  onClick={() => onDaysChange(n)}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl font-bold"
                  style={active ? {
                    background: 'rgba(45,212,191,0.14)',
                    border: '1.5px solid rgba(45,212,191,0.55)',
                    color: 'var(--wild-ocean)',
                    boxShadow: '0 0 16px rgba(45,212,191,0.28)',
                  } : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'var(--wild-mist)',
                  }}
                >
                  <span className="text-[14px] leading-none">{n}</span>
                  <span className="mt-0.5 text-[8px] opacity-45">天</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: 推薦遊玩方式 (horizontal scroll) ── */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={11} className="opacity-50" style={{ color: 'var(--wild-mist)' }} />
            <p className="text-[9px] uppercase tracking-[0.45em] opacity-50" style={{ color: 'var(--wild-mist)' }}>
              推薦遊玩方式
            </p>
          </div>
          {/* Horizontal scroll — negative margin trick to reach edge */}
          <div
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {featuredRoutes.map((route) => (
              <ThemeCard
                key={route.id}
                route={route}
                onClick={() => {
                  onThemeChange(route.theme);
                  onRouteClick(route);
                }}
              />
            ))}
            {/* End spacer */}
            <div className="w-1 shrink-0" />
          </div>
        </div>

        {/* ── Section 3: 篩選器 (只在展開時顯示) ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="filters"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28 }}
              className="mb-6"
            >
              {/* Region pills */}
              <div className="mb-2.5 flex items-center gap-1.5">
                <p className="text-[9px] uppercase tracking-[0.4em] opacity-45 shrink-0" style={{ color: 'var(--wild-mist)' }}>
                  地區
                </p>
              </div>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {REGION_PILLS.map((r) => (
                  <Pill
                    key={r}
                    label={r}
                    active={region === r}
                    accent="var(--wild-ocean)"
                    onClick={() => setRegion(r)}
                  />
                ))}
              </div>

              {/* Type pills */}
              <div className="mb-2.5 flex items-center gap-1.5">
                <p className="text-[9px] uppercase tracking-[0.4em] opacity-45 shrink-0" style={{ color: 'var(--wild-mist)' }}>
                  類型
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {TYPE_PILLS.map((t) => (
                  <Pill
                    key={t}
                    label={t}
                    active={type === t}
                    accent="var(--wild-earth)"
                    onClick={() => setType(t)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Section 4: 自定義冒險入口 ── */}
        <div className="relative">
          {/* Expand nudge (only when collapsed) */}
          {!expanded && (
            <motion.div
              animate={{ opacity: [0.45, 0.7, 0.45] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="mb-3 flex items-center justify-center gap-1.5"
              style={{ color: 'var(--wild-mist)' }}
            >
              <ChevronUp size={12} className="opacity-50" />
              <span className="text-[9px] tracking-widest opacity-45">上滑查看更多篩選</span>
            </motion.div>
          )}

          {/* Glowing CTA button */}
          <motion.button
            onClick={onCustomBuilder}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="relative w-full overflow-hidden rounded-2xl py-4 text-sm font-black tracking-wide"
            style={{ color: '#0a1510' }}
          >
            {/* Gradient background */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, #c4956a 0%, #daa870 35%, #e8c48a 65%, #c4956a 100%)',
                backgroundSize: '200% 100%',
              }}
            />
            {/* Animated shimmer */}
            <motion.div
              className="absolute inset-0"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
              }}
            />
            {/* Outer glow */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ boxShadow: '0 0 40px rgba(196,149,106,0.6), 0 4px 20px rgba(196,149,106,0.35)' }}
            />
            {/* Label */}
            <span className="relative z-10 flex items-center justify-center gap-2.5">
              <Compass size={15} />
              自定義冒險・拖拉規劃行程
              <Zap size={13} />
            </span>
          </motion.button>

          {/* Sub-label */}
          <p className="mt-2.5 text-center text-[10px] opacity-30" style={{ color: 'var(--wild-mist)' }}>
            多天行程・自由拖拉・一鍵匯出
          </p>
        </div>

      </div>
    </motion.div>
  );
}
