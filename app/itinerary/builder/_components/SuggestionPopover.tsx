'use client';

import { motion } from 'framer-motion';
import { MapPin, Plus, Star, Utensils, X } from 'lucide-react';
import { getRichSuggestions } from '@/lib/mock/suggestions';
import type { CuratedStop } from '@/types';

const MOCK_RATINGS: Record<string, { score: number; count: number }> = {
  'rsg-001': { score: 4.8, count: 1204 },
  'rsg-002': { score: 4.6, count: 823  },
  'rsg-003': { score: 4.7, count: 2341 },
  'rsg-004': { score: 4.9, count: 567  },
  'rsg-005': { score: 4.5, count: 388  },
  'rsg-006': { score: 4.3, count: 912  },
  'rsg-007': { score: 4.7, count: 3102 },
  'rsg-008': { score: 4.6, count: 741  },
  'fallback-1': { score: 4.4, count: 215 },
  'fallback-2': { score: 4.5, count: 187 },
};

interface Props {
  keyword: string;
  triggerType: 'nearby_food' | 'nearby_attraction';
  onAdd: (stop: CuratedStop) => void;
  onClose: () => void;
}

export function SuggestionPopover({ keyword, triggerType, onAdd, onClose }: Props) {
  const suggestions = getRichSuggestions(keyword);
  const isFood = triggerType === 'nearby_food';

  return (
    <>
      {/* Invisible backdrop — closes on outside tap */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Popover card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-x-4 bottom-6 z-50 rounded-2xl bg-[#0a1510] border border-[#1c2e1e] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2e1e]">
          <div className="flex items-center gap-2">
            {isFood
              ? <Utensils size={13} className="text-[var(--wild-earth)]" />
              : <MapPin size={13} className="text-[var(--wild-earth)]" />
            }
            <span className="text-xs font-bold text-[var(--foreground)]">
              {isFood ? '周邊美食推薦' : '周邊景點推薦'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--wild-mist)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Suggestion list */}
        <div className="flex flex-col gap-2 p-3 max-h-64 overflow-y-auto">
          {suggestions.map((stop) => (
            <div
              key={stop.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-paper group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {stop.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--wild-mist)]">
                  {stop.category === 'food'
                    ? <Utensils size={9} />
                    : <MapPin size={9} />
                  }
                  <span>{stop.stay_duration} 分鐘</span>
                  {stop.tip && (
                    <span className="truncate opacity-60">· {stop.tip}</span>
                  )}
                </div>
                {MOCK_RATINGS[stop.id] && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={9} style={{ color: '#f5c842', fill: '#f5c842' }} />
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(232,220,200,0.85)' }}>
                      {MOCK_RATINGS[stop.id].score}
                    </span>
                    <span className="text-[9px]" style={{ color: 'rgba(232,220,200,0.3)' }}>
                      ({MOCK_RATINGS[stop.id].count.toLocaleString()})
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { onAdd(stop); onClose(); }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-[var(--wild-earth)]/15 text-[var(--wild-earth)] hover:bg-[var(--wild-earth)]/30 active:scale-95 transition-all"
              >
                <Plus size={10} />
                加入
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}
