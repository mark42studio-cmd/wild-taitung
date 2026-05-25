'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Users, Zap } from 'lucide-react';
import { useWizardStore } from '@/store/useWizardStore';
import { getRecommendedRoutes } from '@/lib/mock/curatedRoutes';
import type { AdventureTheme, CuratedRoute } from '@/types';

const THEME_LABEL: Record<AdventureTheme, string> = {
  foodie:      '大胃王',
  mountain:    '山大王',
  ocean:       '海公主',
  editor_pick: '小編私房',
  hidden:      '小編秘境',
};

const THEME_ACCENT: Record<AdventureTheme, string> = {
  foodie:      '#c4956a',
  mountain:    '#4a8f5f',
  ocean:       '#2dd4bf',
  editor_pick: '#FF6B35',
  hidden:      '#8a9e8f',
};

const THEME_EMOJI: Record<AdventureTheme, string> = {
  foodie: '🍜', mountain: '🏔️', ocean: '🌊', editor_pick: '📍', hidden: '🗺️',
};

const RANK_LABEL = ['✦ 最佳匹配', '推薦備選', '其他選項'];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 36, scale: 0.96 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function WizardRoutesPage() {
  const router = useRouter();
  const { days, theme, selectRoute } = useWizardStore();

  useEffect(() => {
    if (!days || !theme) router.replace('/wizard');
  }, [days, theme, router]);

  if (!days || !theme) return null;

  const routes = getRecommendedRoutes(theme, days);

  function handleImport(route: CuratedRoute) {
    selectRoute(route.id);
    router.push('/itinerary/builder');
  }

  return (
    <main className="min-h-screen px-4 py-12 max-w-5xl mx-auto">

      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        onClick={() => router.back()}
        className="flex items-center gap-2 mb-12 group"
        style={{ color: 'var(--wild-mist)' }}
      >
        <ArrowLeft
          size={14}
          className="group-hover:-translate-x-1 transition-transform duration-200"
        />
        <span className="text-sm hover:text-[var(--foreground)] transition-colors duration-200">
          重新選擇
        </span>
      </motion.button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="mb-12"
      >
        <p className="text-[9px] tracking-[0.55em] uppercase mb-4" style={{ color: 'var(--wild-mist)' }}>
          為你量身策劃
        </p>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight" style={{ color: 'var(--foreground)' }}>
          {days} 天 · {THEME_EMOJI[theme]} {THEME_LABEL[theme]}
        </h1>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight mt-1" style={{ color: 'var(--wild-ocean)' }}>
          命運三選一
        </h1>
      </motion.div>

      {/* Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {routes.map((route, i) => (
          <motion.div key={route.id} variants={cardVariants} className="flex">
            <RouteCard
              route={route}
              rank={i}
              onImport={() => handleImport(route)}
              onFreeStyle={() => router.push('/itinerary/builder')}
            />
          </motion.div>
        ))}
      </motion.div>

    </main>
  );
}

function RouteCard({
  route,
  rank,
  onImport,
  onFreeStyle,
}: {
  route: CuratedRoute;
  rank: number;
  onImport: () => void;
  onFreeStyle: () => void;
}) {
  const accent = THEME_ACCENT[route.theme];

  return (
    <motion.div
      whileHover={{ y: -7, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="flex flex-col w-full rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Cinematic cover */}
      <div
        className="relative h-44 flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${accent}25 0%, ${accent}08 55%, transparent 100%)`,
        }}
      >
        {/* Rank badge */}
        <div className="absolute top-3.5 left-4">
          <span
            className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
            style={{
              background: `${accent}18`,
              color: accent,
              border: `1px solid ${accent}30`,
            }}
          >
            {RANK_LABEL[rank] ?? RANK_LABEL[2]}
          </span>
        </div>

        {/* Floating emoji */}
        <motion.span
          className="text-[72px] select-none"
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: rank * 0.4 }}
        >
          {THEME_EMOJI[route.theme]}
        </motion.span>

        {/* Bottom fade into body */}
        <div
          className="absolute bottom-0 left-0 right-0 h-14"
          style={{ background: 'linear-gradient(to top, rgba(8,15,11,0.9) 0%, transparent 100%)' }}
        />
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 gap-4">

        <div>
          <h2 className="font-serif text-xl leading-snug" style={{ color: 'var(--foreground)' }}>
            {route.title}
          </h2>
          <p className="text-[11px] mt-1 opacity-50" style={{ color: 'var(--wild-mist)' }}>
            {route.days} 天行程
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--wild-mist)' }}>
          <span className="flex items-center gap-1.5">
            <Users size={10} className="opacity-50" />
            {route.completion_count.toLocaleString()} 人通關
          </span>
          <span className="flex items-center gap-1.5">
            <Star size={10} className="opacity-50" />
            {route.rating}
            <span className="opacity-35">({route.rating_count})</span>
          </span>
        </div>

        {/* Highlight badges */}
        <div className="flex flex-wrap gap-1.5">
          {route.highlights.map((h) => (
            <span
              key={h}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: `${accent}12`,
                color: accent,
                border: `1px solid ${accent}22`,
              }}
            >
              <span
                className="w-1 h-1 rounded-full shrink-0"
                style={{ background: accent }}
              />
              {h}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div
          className="flex gap-2 mt-auto pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onFreeStyle}
            className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all duration-200"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--wild-mist)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--wild-mist)';
            }}
          >
            自由規劃
          </button>

          <motion.button
            onClick={onImport}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="flex-1 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-opacity duration-200"
            style={{
              background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
              color: '#0a1510',
              boxShadow: `0 0 22px ${accent}45`,
            }}
          >
            <Zap size={11} />
            直接出發
          </motion.button>
        </div>

      </div>
    </motion.div>
  );
}
