'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { APIProvider, AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Utensils } from 'lucide-react';
import { useItineraryStore as useShareItineraryStore } from '@/lib/store';
import { useItineraryStore } from '@/store/useItineraryStore';
import type { AffiliatePackage, Event, Food, Place, PlannedEvent } from '@/types';

const TAITUNG_CENTER = { lat: 22.7607, lng: 121.1477 };
const ASSET_BASE = '/assets/wild-taitung';
const SNAPPY_SPRING = { type: 'spring' as const, stiffness: 300, damping: 20 };

function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 19 || h < 6;
}


type ValidCategory = 'mtn' | 'city' | 'sea' | 'rail' | 'islands';
type MarkerSource = 'food' | 'spot';
type RawRow = Record<string, unknown>;
type MappedEvent = Event & {
  latitude: number;
  longitude: number;
  category: ValidCategory;
  source: MarkerSource;
};

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  events: MappedEvent[];
}

const SEA_TRANSPORT_MARKERS: Array<{ id: string; label: string; imgSrc: string; lat: number; lng: number; mode: 'ship' | 'canoe' }> = [
  { id: 'green-island', label: '綠島航線', imgSrc: '/ferry-vintage.png', lat: 22.71, lng: 121.35, mode: 'ship'  },
  { id: 'lanyu',        label: '蘭嶼航線', imgSrc: '/ferry-vintage.png', lat: 22.38, lng: 121.40, mode: 'canoe' },
];

const STATIC_CITY_PINS: Array<{ id: string; label: string; imgSrc: string; lat: number; lng: number }> = [
  { id: 'taitung-station', label: '台東火車站', imgSrc: '/train-vintage.png', lat: 22.7997, lng: 121.1179 },
  { id: 'taitung-airport', label: '台東機場',   imgSrc: '/airport-vintage.png', lat: 22.7554, lng: 121.1017 },
];


// 確保初始視角 & FitBounds 永遠涵蓋所有靜態標記（火車站/機場/綠島/蘭嶼）
const STATIC_ANCHOR_BOUNDS = {
  south: 22.33,   // 蘭嶼南側留邊
  north: 22.85,   // 台東火車站北側留邊
  west:  121.06,  // 台東機場西側留邊
  east:  121.46,  // 蘭嶼航線東側留邊
} as const;

function parseCoord(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function titleFromRow(row: RawRow, fallback: string): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name) return name;
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  if (description) return description.slice(0, 14);
  return fallback;
}

function tagsFromRow(row: RawRow): string[] {
  if (Array.isArray(row.wild_tags)) return row.wild_tags.map(String).filter(Boolean);
  if (Array.isArray(row.vibe_tags)) return row.vibe_tags.map(String).filter(Boolean);
  return [];
}

function normalizeCategory(value: unknown, text = ''): ValidCategory {
  if (value === 'sea' || value === 'mtn' || value === 'city' || value === 'rail' || value === 'islands') return value;
  if (/離島|綠島|蘭嶼|小蘭嶼/.test(text)) return 'islands';
  if (/南迴|鐵道|鐵路|太麻里|金崙|大武|達仁/.test(text)) return 'rail';
  if (/海|港|漁|浪|三仙台|東河|成功|長濱/.test(text)) return 'sea';
  if (/市區|台東市|臺東市|森林公園|鐵花村/.test(text)) return 'city';
  return 'mtn';
}

function fallbackMarkerName(category: ValidCategory): string {
  if (category === 'sea') return 'wave';
  if (category === 'mtn') return 'tent';
  if (category === 'city') return 'lamp';
  if (category === 'islands') return 'wave';
  return 'train';
}

function markerIcon(category: ValidCategory, _source: MarkerSource): string {
  // food vs spot differentiation is handled by CSS filters (markerGlow/markerVisual);
  // no separate food image files exist, so both share the category-themed asset.
  if (category === 'islands') return `${ASSET_BASE}/wt_sea_mkr_wave_raw.webp`;
  return `${ASSET_BASE}/wt_${category}_mkr_${fallbackMarkerName(category)}_raw.webp`;
}

function fallbackMarkerIcon(category: ValidCategory): string {
  if (category === 'islands') return `${ASSET_BASE}/wt_sea_mkr_wave_raw.webp`;
  return `${ASSET_BASE}/wt_${category}_mkr_${fallbackMarkerName(category)}_raw.webp`;
}

function markerGlow(source: MarkerSource) {
  const color = source === 'food' ? 'rgba(255,193,84,0.92)' : 'rgba(99,211,170,0.88)';
  return {
    scale: 1.2,
    filter: `brightness(1.25) drop-shadow(0 0 10px rgba(255,255,255,0.92)) drop-shadow(0 0 18px ${color})`,
  };
}

function markerVisual(source: MarkerSource, isUnlocked: boolean) {
  if (!isUnlocked) {
    return {
      scale: 1,
      filter: 'grayscale(100%) opacity(0.5) drop-shadow(0 3px 8px rgba(0,0,0,0.45))',
    };
  }

  const color = source === 'food' ? 'rgba(255,193,84,0.92)' : 'rgba(99,211,170,0.88)';
  return {
    scale: 1,
    filter: `brightness(1.2) drop-shadow(0 3px 8px rgba(0,0,0,0.45)) drop-shadow(0 0 14px ${color})`,
  };
}

function foodToEvent(row: Food): Event | null {
  const raw = row as unknown as RawRow;
  const latitude = parseCoord(raw.lat ?? raw.latitude);
  const longitude = parseCoord(raw.lng ?? raw.longitude);
  if (latitude === null || longitude === null) return null;

  const title = titleFromRow(raw, `美食-${String(raw.id ?? '')}`);
  const description = typeof raw.description === 'string' ? raw.description : '';
  const wildTags = tagsFromRow(raw);
  const category = normalizeCategory(raw.category, `${title} ${description} ${wildTags.join(' ')}`);

  return {
    id: String(raw.id),
    title,
    description,
    long_description: typeof raw.safety_notes === 'string' ? raw.safety_notes : undefined,
    safety_notes: typeof raw.safety_notes === 'string' ? raw.safety_notes : undefined,
    venue_name: title,
    latitude,
    longitude,
    category,
    source: 'food',
    place_type: 'food',
    vibe_tags: wildTags.length > 0 ? wildTags : ['美食'],
    start_time: '2020-01-01T00:00:00+08:00',
    end_date: '2099-12-31',
    is_free: true,
    weather_resilience: 1,
    closed_days: Array.isArray(raw.closed_days) ? (raw.closed_days as number[]) : undefined,
  };
}

function placeToEvent(row: Place): Event | null {
  const raw = row as unknown as RawRow;
  const latitude = parseCoord(raw.lat ?? raw.latitude);
  const longitude = parseCoord(raw.lng ?? raw.longitude);
  if (latitude === null || longitude === null) return null;

  const title = titleFromRow(raw, `景點-${String(raw.id ?? '')}`);
  const description = typeof raw.description === 'string' ? raw.description : '';
  const wildTags = tagsFromRow(raw);
  const category = normalizeCategory(raw.category, `${title} ${description} ${wildTags.join(' ')}`);

  return {
    id: `place-${String(raw.id)}`,
    title,
    description,
    long_description: typeof raw.safety_notes === 'string' ? raw.safety_notes : undefined,
    safety_notes: typeof raw.safety_notes === 'string' ? raw.safety_notes : undefined,
    venue_name: title,
    latitude,
    longitude,
    category,
    source: 'spot',
    place_type: typeof raw.type === 'string' ? raw.type : 'spot',
    vibe_tags: wildTags.length > 0 ? wildTags : ['景點'],
    opening_hours: typeof raw.opening_hours === 'string' ? raw.opening_hours : undefined,
    source_url: typeof raw.source_url === 'string' ? raw.source_url : undefined,
    start_time: '2020-01-01T00:00:00+08:00',
    end_date: '2099-12-31',
    is_free: true,
    weather_resilience: 1,
    closed_days: Array.isArray(raw.closed_days) ? (raw.closed_days as number[]) : undefined,
  };
}

function PanToCenter({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    if (target.zoom != null) map.setZoom(target.zoom);
  }, [map, target]);
  return null;
}

function FitBoundsOnMarkers({ events }: { events: MappedEvent[] }) {
  const map = useMap();
  // Fire once on initial data load only — prevents camera jumps on marker clicks
  const firedRef = useRef(false);

  useEffect(() => {
    if (!map || events.length === 0 || !window.google?.maps) return;
    if (firedRef.current) return;
    firedRef.current = true;

    const bounds = new window.google.maps.LatLngBounds();
    // 先把靜態離島/城市標記納入，保證離島永遠在畫面內
    bounds.extend({ lat: STATIC_ANCHOR_BOUNDS.south, lng: STATIC_ANCHOR_BOUNDS.east });
    bounds.extend({ lat: STATIC_ANCHOR_BOUNDS.north, lng: STATIC_ANCHOR_BOUNDS.west });
    events.forEach((event) => bounds.extend({ lat: event.latitude, lng: event.longitude }));

    if (events.length === 1) {
      map.panTo({ lat: events[0].latitude, lng: events[0].longitude });
      map.setZoom(13);
      return;
    }

    map.fitBounds(bounds, 72);
  }, [map, events]);

  return null;
}

// Asymmetric padding accounts for: left sidebar (MapDayFilter), right FABs, bottom sheet, top nav
const FIT_PADDING = { top: 120, right: 100, bottom: 250, left: 150 } as const;
const MAX_AUTO_ZOOM = 15;
// Single-point vertical offset (px): shift point upward so bottom sheet doesn't cover it
const SINGLE_PAN_OFFSET_Y = -80;

function FitBoundsOnFilter({
  plannedEvents,
  activeMapFilter,
  tripStartDate,
}: {
  plannedEvents: PlannedEvent[];
  activeMapFilter: 'ALL' | number;
  tripStartDate: string;
}) {
  const map = useMap();
  // Only move the camera when the filter *changes*, not when plannedEvents mutates
  // (e.g. after adding a spot via marker click).
  const prevFilterRef = useRef<'ALL' | number | undefined>(undefined);
  const plannedEventsRef = useRef(plannedEvents);
  plannedEventsRef.current = plannedEvents;
  const tripStartDateRef = useRef(tripStartDate);
  tripStartDateRef.current = tripStartDate;

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    if (prevFilterRef.current === activeMapFilter) return;
    prevFilterRef.current = activeMapFilter;

    const events = plannedEventsRef.current;
    const startDate = tripStartDateRef.current;

    // ── No itinerary at all → quietly return ──────────────────────────────────
    if (events.length === 0) return;

    // ── Filter to the selected day ────────────────────────────────────────────
    let targets = events;
    if (activeMapFilter !== 'ALL' && startDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      targets = events.filter((e) => {
        const [dy, dm, dd] = e.assigned_date.split('-').map(Number);
        const day = Math.round(
          (new Date(dy, dm - 1, dd).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000
        ) + 1;
        return day === activeMapFilter;
      });
    }

    // ── Empty day → pan to Taitung center, don't zoom in ─────────────────────
    if (targets.length === 0) {
      map.panTo(TAITUNG_CENTER);
      return;
    }

    // ── Extract valid coordinates ─────────────────────────────────────────────
    const valid = targets
      .map((e) => ({ lat: parseCoord(e.latitude), lng: parseCoord(e.longitude) }))
      .filter((p): p is { lat: number; lng: number } => p.lat !== null && p.lng !== null);

    if (valid.length === 0) return;

    // ── Single spot: panTo then shift upward so bottom sheet doesn't cover it ──
    if (valid.length === 1) {
      map.panTo({ lat: valid[0].lat, lng: valid[0].lng });
      map.setZoom(14);
      // panBy(x, y): negative y moves the viewport up, keeping the pin in the upper half
      map.panBy(0, SINGLE_PAN_OFFSET_Y);
      return;
    }

    // ── Multiple spots: fitBounds with UI-aware padding ───────────────────────
    const bounds = new window.google.maps.LatLngBounds();
    valid.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, FIT_PADDING);

    // After the camera settles, cap zoom so nearby clusters don't over-zoom
    const listener = map.addListener('idle', () => {
      window.google.maps.event.removeListener(listener);
      if ((map.getZoom() ?? 0) > MAX_AUTO_ZOOM) map.setZoom(MAX_AUTO_ZOOM);
    });
  }, [map, activeMapFilter]);  // ← only react to filter changes, not event mutations

  return null;
}

function MarkerImage({ event }: { event: MappedEvent }) {
  const [src, setSrc] = useState(() => markerIcon(event.category, event.source));

  useEffect(() => {
    setSrc(markerIcon(event.category, event.source));
  }, [event.category, event.source]);

  return (
    <div className="relative">
      <Image
        src={src}
        alt={event.title}
        width={54}
        height={54}
        className="h-[54px] w-[54px] object-contain"
        onError={() => setSrc(fallbackMarkerIcon(event.category))}
      />
      {event.source === 'food' && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/80 bg-[#ffd37a] text-[#1B2E26] shadow-[0_0_10px_rgba(255,211,122,0.75)]">
          <Utensils size={12} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}


export type HighlightedStop = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  /** Day-of-week numbers when this venue is closed: 0=Sun, 1=Mon … 6=Sat */
  closedDays?: number[];
  /** YYYY-MM-DD of the day this stop is assigned to (for closed-day check) */
  assignedDate?: string;
};

export default function EventsMap({
  events,
  activeSpotId,
  onSpotSelect,
  panTarget,
  noFetch,
  highlightedStops,
}: {
  events: Event[];
  activeSpotId?: string | null;
  onSpotSelect?: (event: Event) => void;
  panTarget?: { lat: number; lng: number; zoom?: number } | null;
  noFetch?: boolean;
  highlightedStops?: HighlightedStop[];
}) {
  const { hoveredEventId, setHoveredEventId, plannedEvents, previewMeta, activeMapFilter, tripStartDate } = useItineraryStore();
  const activeEvents = previewMeta?.previewEvents ?? plannedEvents;
  const activeTripStart = previewMeta?.previewTripStart ?? tripStartDate;
  const [localPanTarget, setLocalPanTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  const [isNight, setIsNight] = useState<boolean>(isNightTime);
  useEffect(() => {
    const id = setInterval(() => setIsNight(isNightTime()), 60_000);
    return () => clearInterval(id);
  }, []);

  function getEventDay(assignedDate: string, start: string): number {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [dy, dm, dd] = assignedDate.split('-').map(Number);
    return Math.round((new Date(dy, dm - 1, dd).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000) + 1;
  }
  const selectedSpotIds = useShareItineraryStore((state) => state.selectedSpotIds);
  const [dbEvents, setDbEvents] = useState<Event[]>([]);
  const [transportPackages, setTransportPackages] = useState<AffiliatePackage[]>([]);
  const [activeTransportId, setActiveTransportId] = useState<string | null>(null);
  const [localActiveId, setLocalActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (noFetch) return;
    let cancelled = false;

    async function fetchMarkers() {
      const [foodResult, placesResult] = await Promise.all([
        supabase.from('food').select('*'),
        supabase.from('places').select('*'),
      ]);

      if (foodResult.error) console.error('[野台東][Map] food 讀取失敗：', foodResult.error.message);
      if (placesResult.error) console.error('[野台東][Map] places 讀取失敗：', placesResult.error.message);

      const foodEvents = (foodResult.data ?? []).map((row) => foodToEvent(row as Food)).filter(Boolean) as Event[];
      const placeEvents = (placesResult.data ?? []).map((row) => placeToEvent(row as Place)).filter(Boolean) as Event[];
      const merged = [...foodEvents, ...placeEvents];

      console.log('[野台東][Map] 合併後標記資料：', merged.map((event) => ({
        id: event.id,
        title: event.title,
        source: event.source,
        category: event.category,
        tags: event.vibe_tags,
        lat: event.latitude,
        lng: event.longitude,
        latType: typeof event.latitude,
        lngType: typeof event.longitude,
      })));

      if (!cancelled) setDbEvents(merged);
    }

    fetchMarkers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('affiliate_packages')
      .select('id, title, image_url, link_url, category_match')
      .eq('category_match', 'islands')
      .order('title', { ascending: true })
      .limit(2)
      .then(({ data, error }) => {
        if (error) {
          console.error('[野台東][Map] affiliate_packages 讀取失敗：', error.message);
          return;
        }
        if (!cancelled) setTransportPackages(((data ?? []) as AffiliatePackage[]).filter((item) => Boolean(item.link_url)));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mapped = useMemo(() => {
    // Priority: explicit events prop → noFetch mode uses store plannedEvents → DB events
    const source: Event[] = events.length > 0
      ? events
      : noFetch
        ? activeEvents
        : dbEvents;
    return source
      .map((event) => {
        const latitude = parseCoord(event.latitude);
        const longitude = parseCoord(event.longitude);
        if (latitude === null || longitude === null) return null;

        const markerSource: MarkerSource = event.source === 'food' || event.place_type === 'food' || event.vibe_tags?.includes('美食') ? 'food' : 'spot';
        return {
          ...event,
          latitude,
          longitude,
          source: markerSource,
          category: normalizeCategory(event.category, `${event.title} ${event.description} ${(event.vibe_tags ?? []).join(' ')}`),
        };
      })
      .filter(Boolean) as MappedEvent[];
  }, [events, dbEvents, noFetch, activeEvents]);

  const clusters = useMemo((): Cluster[] => {
    const groups = new Map<string, MappedEvent[]>();
    for (const event of mapped) {
      const key = `${event.latitude.toFixed(4)},${event.longitude.toFixed(4)}`;
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return Array.from(groups.entries()).map(([key, clusterEvents]) => {
      const [lat, lng] = key.split(',').map(Number);
      return { key, lat, lng, events: clusterEvents };
    });
  }, [mapped]);

  // Day-of-week for closed-day check: use today when no filter, or compute from trip start + filter day
  const activeDow = useMemo(() => {
    if (activeMapFilter === 'ALL' || !activeTripStart) return new Date().getDay();
    const [sy, sm, sd] = activeTripStart.split('-').map(Number);
    return new Date(sy, sm - 1, sd + (activeMapFilter as number) - 1).getDay();
  }, [activeMapFilter, activeTripStart]);

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
      <GoogleMap
        defaultBounds={STATIC_ANCHOR_BOUNDS}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={true}
        colorScheme={isNight ? 'DARK' : 'LIGHT'}
        style={{ width: '100%', height: '100%' }}
        reuseMaps
        onClick={() => setLocalActiveId(null)}
      >
        {mapped.length > 0 && <FitBoundsOnMarkers events={mapped} />}
        <FitBoundsOnFilter
          plannedEvents={activeEvents}
          activeMapFilter={activeMapFilter}
          tripStartDate={activeTripStart}
        />
        <PanToCenter target={panTarget ?? localPanTarget ?? null} />
        {clusters.map((cluster) => {
          const isMulti = cluster.events.length > 1;
          const sole = cluster.events[0];
          const isHovered = !isMulti && sole.id === hoveredEventId;
          const isClicked = activeSpotId === sole.id || localActiveId === sole.id;
          const isActive = isHovered || isClicked;

          // Day-filter logic
          const plannedEvt = activeEvents.find(e => e.id === sole.id);
          const isInItinerary = !!plannedEvt;
          const isFilteringByDay = activeMapFilter !== 'ALL';
          const matchesFilter = isInItinerary && isFilteringByDay && activeTripStart
            ? getEventDay(plannedEvt!.assigned_date, activeTripStart) === activeMapFilter
            : isInItinerary;

          const isUnlocked = selectedSpotIds.includes(sole.id) || isClicked ||
            (isInItinerary && (!isFilteringByDay || matchesFilter));
          const glow = markerGlow(sole.source);
          const idleVisual = markerVisual(sole.source, isUnlocked);

          // Opacity: dim itinerary pins not on selected day, dim non-itinerary slightly when filtering
          const markerOpacity =
            isFilteringByDay && isInItinerary && !matchesFilter ? 0.1 :
            isFilteringByDay && !isInItinerary ? 0.35 : 1;

          return (
            <Fragment key={cluster.key}>
              <AdvancedMarker
                position={{ lat: cluster.lat, lng: cluster.lng }}
                onClick={() => {
                  const isOpen = localActiveId === sole.id;
                  setLocalActiveId(isOpen ? null : sole.id);
                  if (!isOpen) {
                    // Smooth pan to clicked pin at an appropriate zoom (no fitBounds)
                    setLocalPanTarget({ lat: cluster.lat, lng: cluster.lng, zoom: 14 });
                  }
                  onSpotSelect?.(sole);
                }}
              >
                {/* zero-size anchor — the Maps API measures this; inner div centers content */}
                <div style={{ position: 'relative', width: 0, height: 0 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'translate(-50%, -50%)',
                    opacity: markerOpacity,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: markerOpacity < 0.2 ? 'none' : 'auto',
                  }}
                >
                {isMulti ? (
                  <motion.div
                    whileHover={glow}
                    animate={cluster.events.some((event) => selectedSpotIds.includes(event.id) || activeSpotId === event.id)
                      ? markerVisual(sole.source, true)
                      : markerVisual(sole.source, false)}
                    transition={SNAPPY_SPRING}
                    className="flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full bg-[#1B2E26] text-sm font-black text-white"
                    style={{
                      boxShadow: cluster.events.some((event) => selectedSpotIds.includes(event.id) || activeSpotId === event.id)
                        ? '0 0 0 4px rgba(255,255,255,0.45), 0 0 20px rgba(255,255,255,0.72), 0 4px 16px rgba(0,0,0,0.5)'
                        : '0 0 0 3px rgba(26,46,30,0.55), 0 4px 12px rgba(0,0,0,0.45)',
                    }}
                  >
                    {cluster.events.length}
                  </motion.div>
                ) : (
                  <motion.div
                    whileHover={isUnlocked ? glow : idleVisual}
                    animate={isActive || isUnlocked ? markerVisual(sole.source, true) : idleVisual}
                    transition={SNAPPY_SPRING}
                    onMouseEnter={() => setHoveredEventId(sole.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    className="relative flex cursor-pointer select-none flex-col items-center"
                  >
                    <div
                      className={[
                        'absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 overflow-hidden rounded-xl px-3 py-1.5 text-xs font-bold text-[#e8dcc8] shadow-2xl transition-all duration-200',
                        isActive ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                      ].join(' ')}
                      style={{ background: 'rgba(8,14,10,0.97)', border: '1px solid rgba(255,255,255,0.12)', maxWidth: 220 }}
                    >
                      <span className="block max-w-[170px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {sole.venue_name || sole.title}
                      </span>
                      {sole.closed_days && sole.closed_days.includes(activeDow) && (
                        <span className="block text-[10px] font-bold mt-0.5" style={{ color: '#f87171' }}>
                          （今日公休）
                        </span>
                      )}
                    </div>
                    <MarkerImage event={sole} />
                    {sole.closed_days && sole.closed_days.includes(activeDow) && (
                      <div
                        className="mt-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          background: 'rgba(248,113,113,0.15)',
                          border: '1px solid rgba(248,113,113,0.35)',
                          color: '#f87171',
                        }}
                      >
                        今日公休
                      </div>
                    )}
                  </motion.div>
                )}
                </div>
                </div>
              </AdvancedMarker>
            </Fragment>
          );
        })}
        {/* Static city pins — vintage illustrated vertical stack */}
        {STATIC_CITY_PINS.map((pin) => (
          <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} zIndex={500}>
            <div style={{ position: 'relative', width: 0, height: 0 }}>
              <div
                className="flex flex-col items-center gap-1 select-none"
                style={{ position: 'absolute', top: 0, left: 0, transform: 'translate(-50%, -100%)' }}
              >
                <span className="bg-gray-900 text-white text-xs px-2.5 py-1 rounded-full whitespace-nowrap shadow-md">
                  {pin.label}
                </span>
                <div className="w-12 h-12 rounded-full overflow-hidden border-[2.5px] border-gray-900 shadow-md bg-[#FFF8F1]">
                  <img src={pin.imgSrc} alt={pin.label} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </AdvancedMarker>
        ))}


        {/* Route-selected highlighted stops — glow markers with off-day warning */}
        {(highlightedStops ?? []).map((stop) => {
          const isClosedDay =
            stop.closedDays && stop.closedDays.length > 0 && stop.assignedDate
              ? stop.closedDays.includes(new Date(stop.assignedDate + 'T12:00:00').getDay())
              : false;

          return (
            <AdvancedMarker key={`hl-${stop.id}`} position={{ lat: stop.lat, lng: stop.lng }} zIndex={800}>
              {/* zero-size anchor; inner div shifts bottom-center (dot) to coordinate */}
              <div style={{ position: 'relative', width: 0, height: 0 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, transform: 'translate(-50%, -100%)' }}>
              <motion.div
                className="flex flex-col items-center select-none"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              >
                <div
                  className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold text-white"
                  style={{
                    background: 'rgba(23,23,23,0.97)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
                  }}
                >
                  {stop.name}
                </div>
                {isClosedDay && (
                  <div
                    className="mt-0.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      background: 'rgba(248,113,113,0.14)',
                      border: '1px solid rgba(248,113,113,0.32)',
                      color: '#f87171',
                    }}
                  >
                    ⚠️ 注意：安排日遇公休
                  </div>
                )}
              </motion.div>
              </div>
              </div>
            </AdvancedMarker>
          );
        })}

        {SEA_TRANSPORT_MARKERS.map((marker, index) => {
          const pkg = transportPackages[index] ?? transportPackages[0] ?? null;
          const isActive = activeTransportId === marker.id;

          return (
            <AdvancedMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              zIndex={1000}
              onClick={() => setActiveTransportId((current) => current === marker.id ? null : marker.id)}
            >
              {/* zero-size anchor; bottom of image badge anchors to coordinate */}
              <div style={{ position: 'relative', width: 0, height: 0 }}>
              <div
                className="flex flex-col items-center gap-1 cursor-pointer select-none sea-float"
                style={{ position: 'absolute', top: 0, left: 0, transform: 'translate(-50%, -100%)' }}
              >
                {isActive && pkg && (
                  <a
                    href={pkg.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap rounded-full bg-[#1B2E26] px-3 py-1 text-[10px] font-black text-[#F5F5DC] shadow-lg"
                  >
                    預訂船票 →
                  </a>
                )}
                <span className="bg-gray-900 text-white text-xs px-2.5 py-1 rounded-full whitespace-nowrap shadow-md">
                  {marker.label}
                </span>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={SNAPPY_SPRING}
                  aria-label={marker.label}
                  className="w-12 h-12 rounded-full overflow-hidden border-[2.5px] border-gray-900 shadow-md bg-[#FFF8F1]"
                >
                  <img src={marker.imgSrc} alt={marker.label} className="w-full h-full object-cover" />
                </motion.div>
              </div>
              </div>
            </AdvancedMarker>
          );
        })}
      </GoogleMap>
    </APIProvider>
  );
}
