'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { useItineraryStore } from '@/store/useItineraryStore';
import { useBuilderStore } from '@/store/useBuilderStore';
import { supabase } from '@/lib/supabase';
import ExploreSheet from '@/components/ExploreSheet';
import RouteDetailModal from '@/components/RouteDetailModal';
import MapDayFilter from '@/components/MapDayFilter';
import TopRightActionNav from '@/components/TopRightActionNav';
import type { CuratedRoute } from '@/types';

const EventsMap = dynamic(() => import('@/components/EventsMap'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{ background: '#F8F5EE' }}
    />
  ),
});

export default function ExploreClientPage() {
  const router = useRouter();
  const { selectedRouteForModal, setSelectedRouteForModal, selectRoute, reset: resetWizard } = useWizardStore();
  const { reset: resetBuilder } = useBuilderStore();
  const {
    importRouteEvents,
    tripStartDate,
    setActiveMapFilter,
    currentChallengeName,
    setCurrentChallengeName,
    resetChallenge,
    previewMeta,
    commitPreview,
    cancelPreview,
  } = useItineraryStore();

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewToast, setPreviewToast] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  async function handleCommitPreview() {
    if (!previewMeta || committing) return;
    const { sourceId, adoptedCount } = previewMeta;
    setCommitting(true);
    commitPreview();
    if (sourceId) {
      const { error } = await supabase
        .from('shared_itineraries')
        .update({ adopted_count: adoptedCount + 1 })
        .eq('id', sourceId);
      if (error) console.error('[野台東] UGC adopted_count 更新失敗:', error.message, '| id:', sourceId);
    } else {
      console.error('[野台東] handleCommitPreview: sourceId 為空，跳過 adopted_count 更新');
    }
    setCommitting(false);
    setPreviewToast('🎉 接受挑戰成功！已成功匯入你的工作台。');
    setTimeout(() => setPreviewToast(null), 3200);
  }

  const effectiveStart =
    tripStartDate || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

  const highlightedStops = selectedRouteForModal?.days_plan.flatMap((dayPlan) => {
    const [sy, sm, sd] = effectiveStart.split('-').map(Number);
    const d = new Date(sy, sm - 1, sd + dayPlan.day - 1);
    const assignedDate = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');

    return dayPlan.stops.map((s) => ({
      id: s.id,
      lat: s.latitude,
      lng: s.longitude,
      name: s.name,
      closedDays: s.closed_days,
      assignedDate,
    }));
  }) ?? [];

  function handleAcceptChallenge(route: CuratedRoute) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    importRouteEvents(route, tripStartDate || today);
    selectRoute(route.id);
    setSelectedRouteForModal(null);
    setCurrentChallengeName(route.title);
    setActiveMapFilter('ALL');
    setSheetExpanded(false);
    trackCuratedAdoption(route);
  }

  function trackCuratedAdoption(route: CuratedRoute) {
    const stopsCount = route.days_plan.reduce((sum, d) => sum + d.stops.length, 0);
    supabase
      .from('shared_itineraries')
      .select('id, adopted_count')
      .eq('adventure_name', route.title)
      .eq('is_public', false)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          supabase
            .from('shared_itineraries')
            .update({ adopted_count: data.adopted_count + 1 })
            .eq('id', data.id)
            .then(({ error }) => {
              if (error) console.error('[野台東] 官方路線 adopted_count 更新失敗:', error.message);
            });
        } else {
          supabase.from('shared_itineraries').insert({
            adventure_name: route.title,
            days_count: route.days,
            stops_count: stopsCount,
            is_public: false,
            adopted_count: 1,
            theme: route.theme,
            days_data: null,
          }).then(({ error }) => {
            if (error) console.error('[野台東] 官方路線 adoption 寫入失敗:', error.message);
          });
        }
      });
  }

  function handleAdjust(route: CuratedRoute) {
    selectRoute(route.id);
    setSelectedRouteForModal(null);
    router.push('/itinerary/builder');
  }

  return (
    <div className="fixed inset-0 z-30 overflow-hidden">

      {/* ── Layer 0: Map base (always visible) ── */}
      <div className="absolute inset-0 z-0">
        <EventsMap events={[]} noFetch highlightedStops={highlightedStops} />
      </div>

      {/* Top gradient — subtle, for UI readability on map */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.60) 0%, transparent 100%)' }}
      />

      {/* Wordmark — pill backdrop on map */}
      <div id="tour-wordmark" className="absolute left-5 top-5 z-30 select-none">
        <div
          className="flex h-11 flex-col justify-center rounded-xl px-3"
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <p className="text-[8px] font-semibold uppercase tracking-[0.45em] text-gray-400">
            Wild Taitung
          </p>
          <p className="mt-0.5 font-serif text-sm font-bold leading-none tracking-wide text-gray-900">
            野台東
          </p>
        </div>
      </div>

      {/* ── Preview Banner ── */}
      <AnimatePresence>
        {previewMeta && (
          <motion.div
            key="preview-banner"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed left-1/2 top-4 z-[45] w-[92vw] max-w-xs -translate-x-1/2"
          >
            <div
              className="overflow-hidden rounded-2xl px-4 pb-3 pt-3.5"
              style={{
                background: 'linear-gradient(135deg, rgba(253,251,246,0.98) 0%, rgba(255,247,237,0.98) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(228,92,28,0.20)',
                boxShadow: '0 8px 32px rgba(228,92,28,0.16), 0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#e45c1c' }}>👀 正在預覽</span>
              </div>
              <p className="mb-3 truncate font-serif text-sm font-bold text-gray-900">
                「{previewMeta.name}」
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cancelPreview}
                  className="flex-1 rounded-xl border border-[#E5E0D8] py-2 text-[11px] font-bold text-[#8E8377] transition-colors hover:bg-[#F0EDE7]"
                >
                  ❌ 放棄預覽
                </button>
                <motion.button
                  onClick={handleCommitPreview}
                  disabled={committing}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 rounded-xl py-2 text-[11px] font-bold text-white disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #e45c1c 0%, #f97316 100%)',
                    boxShadow: '0 3px 12px rgba(228,92,28,0.28)',
                  }}
                >
                  {committing ? '處理中…' : '🔥 正式接受挑戰！'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Preview commit toast ── */}
      <AnimatePresence>
        {previewToast && (
          <motion.div
            key="preview-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-8 left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold"
            style={{
              background: 'linear-gradient(135deg, #e45c1c 0%, #f97316 100%)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(228,92,28,0.35)',
            }}
          >
            {previewToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Challenge HUD: large screens (sm+) ── */}
      <AnimatePresence>
        {currentChallengeName && !sheetExpanded && (
          <motion.div
            key="challenge-hud-lg"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="hidden sm:block fixed bottom-[80px] left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className="flex h-12 w-fit max-w-xs items-center gap-2 rounded-xl px-3 text-xs font-bold"
              style={{
                background: 'rgba(253,251,246,0.96)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(90,100,90,0.20)',
                color: '#5A645A',
                boxShadow: '0 4px 24px rgba(90,100,90,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <span className="shrink-0">⚔️</span>
              <span className="truncate">挑戰中：{currentChallengeName}</span>
              <button
                onClick={() => setShowAbandonConfirm(true)}
                className="shrink-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow-md transition-colors hover:bg-red-600"
                title="放棄挑戰"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom row: Challenge HUD + FAB trigger (sm:hidden) ── */}
      {/* items-center guarantees the ? button's vertical center matches the challenge box's */}
      <motion.div
        animate={sheetExpanded
          ? { opacity: 0, y: 8, pointerEvents: 'none' }
          : { opacity: 1, y: 0, pointerEvents: 'auto' }
        }
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="fixed bottom-[80px] left-0 right-0 z-[100] sm:hidden flex items-center justify-center px-4"
      >
        {/* Left spacer = w-6 (button) + ml-4 (gap) = w-10, mirrors the right side to keep the box centered */}
        <div className="w-10 shrink-0" />

        {/* Challenge box */}
        <div className="flex flex-grow justify-center min-w-0">
          <AnimatePresence>
            {currentChallengeName && (
              <motion.div
                key="challenge-box-mobile"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="flex h-12 w-fit max-w-[200px] items-center gap-2 rounded-xl px-3 text-xs font-bold"
                style={{
                  background: 'rgba(253,251,246,0.96)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(90,100,90,0.20)',
                  color: '#5A645A',
                  boxShadow: '0 4px 24px rgba(90,100,90,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <span className="shrink-0">⚔️</span>
                <span className="truncate">挑戰中：{currentChallengeName}</span>
                <button
                  onClick={() => setShowAbandonConfirm(true)}
                  className="shrink-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow-md transition-colors hover:bg-red-600"
                  title="放棄挑戰"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FAB trigger — w-6 h-6 (half of original w-12 h-12); vertical center aligned via parent items-center */}
        <motion.button
          id="tour-fab-toggle"
          onClick={() => setFabOpen(f => !f)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          className="ml-4 shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-stone-800 text-white shadow-lg transition-all duration-150 hover:bg-stone-700 active:scale-95"
          title={fabOpen ? '收起' : '更多動作'}
        >
          <span className="text-[11px] leading-none font-semibold">?</span>
        </motion.button>
      </motion.div>

      {/* ── Abandon confirmation modal ── */}
      <AnimatePresence>
        {showAbandonConfirm && (
          <motion.div
            key="abandon-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAbandonConfirm(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{
              background: 'rgba(10,18,14,0.45)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[90vw] max-w-sm rounded-2xl border border-[#E5E0D8] bg-[#FDFBF6] p-6"
              style={{ boxShadow: '0 16px 64px rgba(0,0,0,0.12)' }}
            >
              <p className="text-center text-4xl">⚔️</p>
              <h2 className="mt-3 text-center font-serif text-base font-bold tracking-wide text-[#5A645A]">
                要放棄這次挑戰嗎？
              </h2>
              <p className="mt-1 text-center text-xs text-[#8E8377]">
                放棄後，目前的行程資料將會清除。
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => {
                    resetChallenge();
                    resetBuilder();
                    resetWizard();
                    setShowAbandonConfirm(false);
                  }}
                  className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-red-600"
                >
                  是，放棄
                </button>
                <button
                  onClick={() => setShowAbandonConfirm(false)}
                  className="flex-1 rounded-xl border border-[#E5E0D8] py-2.5 text-sm font-medium text-[#8E8377] transition-colors hover:bg-[#F0EDE7]"
                >
                  否，繼續
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top-right: large-screen nav + day filter toggle (有挑戰時才顯示) ── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={sheetExpanded
          ? { opacity: 0, x: 72, pointerEvents: 'none' }
          : { opacity: 1, x: 0, pointerEvents: 'auto' }
        }
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="fixed top-4 right-4 z-50 flex flex-col gap-3 items-end"
      >
        <TopRightActionNav
          sheetExpanded={sheetExpanded}
          fabOpen={fabOpen}
          onFabClose={() => setFabOpen(false)}
        />
        <MapDayFilter onOpenBuilder={() => router.push('/itinerary/builder')} />
      </motion.div>

      {/* ── Layer 1: Explore Sheet ── */}
      <ExploreSheet
        onRouteClick={(route) => setSelectedRouteForModal(route)}
        onCustomBuilder={() => router.push('/itinerary/builder')}
        expanded={sheetExpanded}
        onExpandChange={setSheetExpanded}
        onEnterPreview={() => {
          resetWizard();
          setSheetExpanded(false);
        }}
      />

      {/* ── Layer 2: Route Detail Modal ── */}
      <RouteDetailModal
        route={selectedRouteForModal}
        onClose={() => setSelectedRouteForModal(null)}
        onAcceptChallenge={handleAcceptChallenge}
        onAdjust={handleAdjust}
      />

    </div>
  );
}
