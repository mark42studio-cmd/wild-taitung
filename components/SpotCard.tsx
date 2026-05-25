'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export type SpotCategory = '縱谷線' | '南迴線' | '海線' | '市區';

export interface Spot {
  id: string;
  name: string;
  quote?: string | null;
  category: SpotCategory | string;
  tags?: string[] | null;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  popularity?: number;
  /** Klook 分潤連結 */
  affiliate_link?: string | null;
}

export const CATEGORY_LABEL: Record<SpotCategory, string> = {
  縱谷線: '縱谷線',
  南迴線: '南迴線',
  海線:   '海線',
  市區:   '市區',
};

export const CATEGORY_EMOJI: Record<SpotCategory, string> = {
  縱谷線: '🏔️',
  南迴線: '🌄',
  海線:   '🌊',
  市區:   '🏮',
};

const CATEGORY_GRADIENT: Record<SpotCategory, string> = {
  縱谷線: 'linear-gradient(160deg, #2d5016 0%, #1a3a2a 100%)',
  南迴線: 'linear-gradient(160deg, #4a2800 0%, #3a1800 100%)',
  海線:   'linear-gradient(160deg, #0c2a4a 0%, #0f3d5a 100%)',
  市區:   'linear-gradient(160deg, #3a1a2a 0%, #4a2a1a 100%)',
};

// 4 torn-edge clip-path variants — irregular hand-cut paper feel
const TORN_CLIPS = [
  'polygon(1% 2%, 4% 0%, 8% 1.5%, 16% 0%, 24% 1%, 36% 0%, 49% 1.5%, 62% 0%, 74% 1%, 86% 0%, 94% 1.5%, 99% 0%, 100% 2%, 98.5% 8%, 100% 18%, 99% 30%, 100% 43%, 99% 56%, 100% 69%, 99% 81%, 100% 93%, 99% 98%, 96% 100%, 86% 99%, 73% 100%, 60% 99%, 47% 100%, 34% 99%, 21% 100%, 8% 99%, 2% 100%, 0% 97%, 1.5% 88%, 0% 76%, 1% 63%, 0% 50%, 1% 37%, 0% 24%, 1.5% 11%, 1% 2%)',
  'polygon(2% 0%, 9% 1.5%, 19% 0%, 32% 1%, 46% 0%, 59% 1.5%, 71% 0%, 83% 1%, 91% 0%, 98% 1.5%, 100% 3%, 99% 11%, 100% 24%, 99% 37%, 100% 51%, 99% 65%, 100% 78%, 99% 91%, 97% 100%, 83% 99%, 68% 100%, 53% 99%, 38% 100%, 23% 99%, 9% 100%, 1% 98%, 0% 87%, 1.5% 74%, 0% 61%, 1% 48%, 0% 34%, 1.5% 20%, 0% 7%, 2% 0%)',
  'polygon(0% 3%, 6% 0%, 14% 1.5%, 27% 0%, 40% 1%, 54% 0%, 67% 1.5%, 80% 0%, 89% 1%, 96% 0%, 100% 2.5%, 99% 13%, 100% 27%, 99% 40%, 100% 54%, 99% 67%, 100% 80%, 98% 96%, 100% 100%, 84% 99%, 69% 100%, 54% 99%, 39% 100%, 24% 99%, 9% 100%, 1% 97%, 0% 85%, 1.5% 72%, 0% 59%, 1% 46%, 0% 32%, 1.5% 19%, 0% 6%, 0% 3%)',
  'polygon(3% 0%, 11% 1%, 22% 0%, 35% 1.5%, 49% 0%, 62% 1%, 75% 0%, 87% 1.5%, 96% 0%, 100% 2%, 99% 10%, 100% 23%, 99% 38%, 100% 52%, 99% 66%, 100% 79%, 99% 93%, 96% 100%, 81% 99%, 66% 100%, 51% 98%, 36% 100%, 21% 99%, 6% 100%, 0% 96%, 1% 82%, 0% 68%, 1.5% 55%, 0% 41%, 1% 27%, 0% 14%, 3% 0%)',
];

interface Props {
  spot: Spot;
  index: number;
  mode: 'all' | 'single';
  onClick?: () => void;
  isFirst?: boolean;
  stackZ?: number;
  overrideEmoji?: string;
  overrideGradient?: string;
  overrideLabel?: string;
}

export default function SpotCard({
  spot,
  index,
  onClick,
  isFirst = false,
  stackZ,
  overrideEmoji,
  overrideGradient,
  overrideLabel,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const emoji    = overrideEmoji    ?? CATEGORY_EMOJI[spot.category as SpotCategory]    ?? '📍';
  const gradient = overrideGradient ?? CATEGORY_GRADIENT[spot.category as SpotCategory] ?? 'linear-gradient(160deg, #1a2a1a 0%, #2a2a2a 100%)';
  const label    = overrideLabel    ?? spot.tags?.[0] ?? CATEGORY_LABEL[spot.category as SpotCategory] ?? '秘境';
  const hasImage = !!spot.image_url && !imgError;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 280, damping: 28 }}
      whileHover={{ y: -8, rotate: index % 2 === 0 ? 0.8 : -0.8 }}
      whileTap={{ scale: 0.97 }}
      className="relative shrink-0 overflow-hidden [scroll-snap-align:start]"
      style={{
        width: 160,
        height: 240,
        marginLeft: isFirst ? 0 : 12,
        zIndex: stackZ ?? 'auto',
        clipPath: TORN_CLIPS[index % 4],
        filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.50))',
      }}
    >
      {/* ── Layer 1: Full-bleed image / gradient fallback ── */}
      {hasImage ? (
        <img
          src={spot.image_url!}
          alt={spot.name}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: gradient }} />
      )}

      {/* ── Layer 2: Paper grain texture (mix-blend-overlay) ── */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='1'/></svg>")`,
          backgroundSize: '120px 120px',
        }}
      />

      {/* ── Layer 3: Bottom gradient — text readability ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* ── Layer 4: Hand-drawn SVG dashed border ── */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="160" height="240"
        viewBox="0 0 160 240"
        fill="none"
      >
        <rect
          x="6" y="6" width="148" height="228"
          stroke="rgba(255,235,180,0.35)"
          strokeWidth="1.2"
          strokeDasharray="5 3.5 2 4 3 4.5"
          strokeDashoffset="1.5"
          rx="1.5"
        />
      </svg>

      {/* ── Layer 5: Corner decorations ── */}
      {/* Top-left: compass */}
      <svg
        className="absolute pointer-events-none"
        style={{ top: 4, left: 4 }}
        width="20" height="20"
        viewBox="0 0 22 22"
        fill="none"
      >
        <circle cx="11" cy="11" r="5.5" stroke="rgba(255,230,160,0.55)" strokeWidth="0.8" fill="none" />
        <polygon points="11,4.5 12.5,11 11,17.5 9.5,11" fill="rgba(255,210,120,0.75)" />
        <polygon points="11,17.5 12.5,11 11,4.5 9.5,11" fill="rgba(80,50,20,0.5)" />
        <circle cx="11" cy="11" r="1.3" fill="rgba(255,220,140,0.8)" />
        <text x="11" y="3.5" textAnchor="middle" fontSize="2.8" fill="rgba(255,230,160,0.7)" fontFamily="serif">N</text>
      </svg>

      {/* Top-right: ink splatter dots */}
      <svg
        className="absolute pointer-events-none"
        style={{ top: 6, right: 30 }}
        width="14" height="12"
        viewBox="0 0 14 12"
        fill="none"
      >
        <circle cx="3"  cy="3"  r="1.8" fill="rgba(255,230,160,0.30)" />
        <circle cx="10" cy="2"  r="0.9" fill="rgba(255,230,160,0.22)" />
        <circle cx="13" cy="7"  r="0.6" fill="rgba(255,230,160,0.18)" />
        <circle cx="6"  cy="10" r="0.7" fill="rgba(255,230,160,0.22)" />
      </svg>

      {/* ── Klook badge ── */}
      {spot.affiliate_link && (
        <a
          href={spot.affiliate_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold text-white shadow z-10"
          style={{ background: 'rgba(245,158,11,0.90)' }}
        >
          🎫 訂票
        </a>
      )}

      {/* ── Top-right arrow ── */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <span className="text-[11px] leading-none text-white">↗</span>
        </div>
      </div>

      {/* ── Bottom text overlay ── */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-3.5 pt-12 text-left">
        {/* Category pill */}
        <div className="mb-1.5">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
            {emoji} {label}
          </span>
        </div>

        {/* Spot name */}
        <p className="font-serif text-sm font-bold leading-snug text-white drop-shadow-sm line-clamp-2 h-10">
          {spot.name}
        </p>

        {/* Tags */}
        {spot.tags && spot.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap content-start gap-1.5 min-h-[40px]">
            {spot.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] font-medium text-white/65">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}
