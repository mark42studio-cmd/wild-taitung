'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/store/useWizardStore';
import { useItineraryStore } from '@/store/useItineraryStore';
import { supabase } from '@/lib/supabase';
import WizardBottomSheet from '@/components/WizardBottomSheet';
import RouteDetailModal from '@/components/RouteDetailModal';
import MapDayFilter from '@/components/MapDayFilter';
import type { CuratedRoute } from '@/types';

// Google Maps must not SSR (requires `window`)
const EventsMap = dynamic(() => import('@/components/EventsMap'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{ background: 'radial-gradient(ellipse at 40% 60%, #0a2a18 0%, #050e09 100%)' }}
    />
  ),
});

export default function WizardPage() {
  const router = useRouter();
  const { days, theme, setDays, setTheme, selectRoute } = useWizardStore();
  const { importRouteEvents, tripStartDate } = useItineraryStore();
  const [activeRoute, setActiveRoute] = useState<CuratedRoute | null>(null);
  const [sheetHidden, setSheetHidden] = useState(false);

  function handleAcceptChallenge(route: CuratedRoute) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    importRouteEvents(route, tripStartDate || today);
    selectRoute(route.id);
    setActiveRoute(null);
    setSheetHidden(true);
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
    setActiveRoute(null);
    router.push('/itinerary/builder');
  }

  return (
    // Full-viewport container — sits above the root layout
    <div className="fixed inset-0 z-30 overflow-hidden">

      {/* ── Background: full-screen map ── */}
      <div className="absolute inset-0">
        <EventsMap events={[]} />
      </div>

      {/* ── Subtle top gradient (logo / brand area) ── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28"
        style={{ background: 'linear-gradient(to bottom, rgba(5,14,9,0.72) 0%, transparent 100%)' }}
      />

      {/* ── Wordmark ── */}
      <div className="absolute left-4 top-5 z-20 select-none">
        <p className="text-[9px] font-bold uppercase tracking-[0.55em]" style={{ color: 'rgba(232,220,200,0.55)' }}>
          Wild Taitung
        </p>
        <p className="mt-0.5 font-serif text-base font-bold leading-none" style={{ color: 'rgba(232,220,200,0.85)' }}>
          野台東
        </p>
      </div>

      {/* ── Day filter (left side, above map) ── */}
      <MapDayFilter onOpenBuilder={() => router.push('/itinerary/builder')} />

      {/* ── Bottom sheet (hidden after challenge accepted) ── */}
      {!sheetHidden && (
        <WizardBottomSheet
          days={days}
          theme={theme}
          onDaysChange={setDays}
          onThemeChange={setTheme}
          onRouteClick={(route) => setActiveRoute(route)}
          onCustomBuilder={() => router.push('/itinerary/builder')}
        />
      )}

      {/* ── Re-open sheet FAB (when sheet is hidden) ── */}
      {sheetHidden && (
        <button
          onClick={() => setSheetHidden(false)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[38] flex items-center gap-2 rounded-full px-5 py-3 text-xs font-black"
          style={{
            background: 'rgba(10,18,14,0.9)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(232,220,200,0.75)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          ↑ 查看路線選單
        </button>
      )}

      {/* ── Route detail modal ── */}
      <RouteDetailModal
        route={activeRoute}
        onClose={() => setActiveRoute(null)}
        onAcceptChallenge={handleAcceptChallenge}
        onAdjust={handleAdjust}
      />

    </div>
  );
}
