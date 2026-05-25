'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Map, Wrench } from 'lucide-react';
import { useItineraryStore } from '@/store/useItineraryStore';
import { buildTripDateRange } from '@/lib/tripDates';

interface Props {
  isSheetOpen?: boolean;
  onOpenBuilder?: () => void;
}

function FilterBtn({
  label,
  active,
  hasEvents,
  onClick,
}: {
  label: string;
  active: boolean;
  hasEvents: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative min-w-[40px] rounded-md px-2.5 py-2 text-center text-[11px] font-black transition-all duration-200',
        active
          ? 'border-l-2 border-[#5A645A] bg-[#5A645A]/10 text-[#5A645A]'
          : hasEvents
            ? 'border border-transparent text-[#8E8377] hover:bg-[#5A645A]/10'
            : 'border border-transparent text-[#5A645A]/30 hover:bg-[#5A645A]/5',
      ].join(' ')}
    >
      {label}
      {/* Empty-day indicator dot */}
      {!hasEvents && label !== '全部' && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#5A645A]/20" />
      )}
    </button>
  );
}

const AFFILIATE_ITEMS = [
  { id: 'accommodation', emoji: '🏠', label: '住宿', url: 'https://www.agoda.com/taiwan/taitung.html' },
  { id: 'ticket',        emoji: '🎟️', label: '船票', url: 'https://www.klook.com/' },
  { id: 'rental',        emoji: '🚗', label: '租車', url: 'https://www.kkday.com/' },
] as const;

export default function MapDayFilter({ isSheetOpen = false, onOpenBuilder }: Props) {
  const {
    plannedEvents,
    previewMeta,
    activeMapFilter,
    setActiveMapFilter,
    tripStartDate,
    tripEndDate,
    currentChallengeName,
  } = useItineraryStore();

  const activeEvents = previewMeta?.previewEvents ?? plannedEvents;
  const activeTripStart = previewMeta?.previewTripStart ?? tripStartDate;
  const activeTripEnd = previewMeta?.previewTripEnd ?? tripEndDate;

  // ── 與 ItinerarySidebar 共用同一個 buildTripDateRange，確保 D-N 對應的日期完全一致 ──
  const eventDates = useMemo(
    () => new Set(activeEvents.map(e => e.assigned_date)),
    [activeEvents],
  );

  const tripDays = useMemo(() => {
    const dates = buildTripDateRange(
      activeTripStart,
      activeTripEnd,
      activeEvents.map(e => e.assigned_date),
    );
    // buildTripDateRange 保底回傳 today；若無任何行程則不顯示 filter
    if (activeEvents.length === 0 && !activeTripStart) return [];
    return dates.map((dateStr, i) => ({
      day: i + 1,
      date: dateStr,
      hasEvents: eventDates.has(dateStr),
    }));
  }, [activeEvents, activeTripStart, activeTripEnd, eventDates]);

  const isVisible = activeEvents.length > 0 || !!currentChallengeName || !!previewMeta;
  const [toolbarOpen, setToolbarOpen] = useState(false);

  const selectedDayHasNoEvents = useMemo(() => {
    if (activeMapFilter === 'ALL') return false;
    const entry = tripDays.find(d => d.day === activeMapFilter);
    return entry ? !entry.hasEvents : false;
  }, [activeMapFilter, tripDays]);

  if (!isVisible) return null;

  return (
    <>
      {/* ── Day filter sidebar ── */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={isSheetOpen
          ? { opacity: 0, x: 72, pointerEvents: 'none' }
          : { opacity: 1, x: 0,  pointerEvents: 'auto' }
        }
        exit={{ opacity: 0, x: 12 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="fixed top-5 right-4 z-[40] flex flex-col gap-1"
        style={{ transformOrigin: 'top right' }}
      >
        {/* Toggle button — always visible */}
        <button
          id="tour-filter-toggle"
          onClick={() => setToolbarOpen(o => !o)}
          title={toolbarOpen ? '收合工具列' : '展開篩選'}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/90 backdrop-blur-sm shadow-sm text-stone-700 transition-all duration-150 hover:bg-white active:scale-95"
        >
          <motion.div
            animate={{ rotate: toolbarOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            <ChevronDown size={15} strokeWidth={2.5} />
          </motion.div>
        </button>

        {/* Collapsible content */}
        <AnimatePresence initial={false}>
          {toolbarOpen && (
            <motion.div
              key="toolbar-content"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="flex flex-col gap-1 max-h-[calc(100dvh-140px)] overflow-y-auto rounded-xl p-2"
              style={{
                background: 'rgba(253,251,246,0.95)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(90,100,90,0.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
              }}
            >
              {/* All */}
              <FilterBtn
                label="全部"
                active={activeMapFilter === 'ALL'}
                hasEvents={activeEvents.length > 0}
                onClick={() => setActiveMapFilter('ALL')}
              />

              {/* Per-day buttons */}
              {tripDays.map(({ day, hasEvents }) => (
                <FilterBtn
                  key={day}
                  label={`D${day}`}
                  active={activeMapFilter === day}
                  hasEvents={hasEvents}
                  onClick={() => setActiveMapFilter(day)}
                />
              ))}

              {/* Edit wrench — below day list, only when handler is provided */}
              {onOpenBuilder && (
                <>
                  <div className="mx-1 mt-0.5 h-px bg-[#5A645A]/10" />
                  <button
                    onClick={onOpenBuilder}
                    title="調整行程"
                    className="flex flex-col items-center gap-0.5 rounded-md p-1.5 text-[#8E8377] transition-all duration-150 hover:bg-[#5A645A]/8 hover:text-[#5A645A] active:scale-95"
                  >
                    <Wrench size={14} strokeWidth={2} />
                    <span className="text-[8px] font-bold tracking-wide">調整</span>
                  </button>
                </>
              )}

              {/* Divider */}
              <div className="mx-1 mt-0.5 h-px bg-[#5A645A]/10" />

              {/* Affiliate links */}
              {AFFILIATE_ITEMS.map(({ id, emoji, label, url }) => (
                <a
                  key={id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-0.5 rounded-md p-1.5 text-[#8E8377] transition-all hover:bg-[#5A645A]/8 hover:text-[#5A645A]"
                  title={label}
                >
                  <span className="text-[18px] leading-none">{emoji}</span>
                  <span className="text-[8px] font-bold tracking-wide">{label}</span>
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Empty-day center overlay ── */}
      <AnimatePresence>
        {selectedDayHasNoEvents && (
          <motion.div
            key="empty-day"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-none fixed inset-0 z-[36] flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="pointer-events-auto flex flex-col items-center gap-4 rounded-lg px-8 py-7"
              style={{
                background: 'rgba(253,251,246,0.98)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(90,100,90,0.15)',
                boxShadow: '0 8px 48px rgba(0,0,0,0.08)',
                maxWidth: 280,
              }}
            >
              <Map size={40} strokeWidth={1.25} className="text-[#8E8377]/50" />
              <div className="text-center">
                <p className="font-serif text-base font-bold text-[#5A645A] tracking-wider">
                  今日尚無行程
                </p>
                <p className="mt-1 text-xs text-[#8E8377]">
                  D{activeMapFilter} 尚未安排任何景點
                </p>
              </div>
              {onOpenBuilder && (
                <motion.button
                  onClick={onOpenBuilder}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="flex items-center gap-2 rounded-xl border border-[#D7AF70]/40 bg-gradient-to-r from-[#D7AF70] to-[#E5C992] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#D7AF70]/30 hover:from-[#C9A060] hover:to-[#D7AF70]"
                >
                  🛠️ 調整行程
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
