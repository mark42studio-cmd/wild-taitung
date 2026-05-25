'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { motion, useDragControls } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, MapPin, Route, Sparkles } from 'lucide-react';
import EventDetailModal from '@/components/EventDetailModal';
import HomeOnboardingModal, { HOME_ONBOARDING_KEY } from '@/components/HomeOnboardingModal';
import SubmitSpotModal from '@/components/SubmitSpotModal';
import JournalContainer, { PolaroidCard, type JournalActivePage } from '@/components/JournalContainer';
import { useItineraryStore as useShareItineraryStore } from '@/lib/store';
import { fetchCurrentWeather } from '@/lib/weather';
import { useItineraryStore } from '@/store/useItineraryStore';
import { useBuilderStore } from '@/store/useBuilderStore';
import type { AffiliatePackage, Event, Food, Place } from '@/types';

const ASSET_BASE = '/assets/wild-taitung';


const EventsMapDynamic = dynamic(() => import('@/components/EventsMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a1510] text-sm tracking-[0.2em] text-[#e8dcc8]/40">
      地圖載入中
    </div>
  ),
});

const DISTRICTS = [
  { key: 'all' as const, label: '全部', img: `${ASSET_BASE}/wt_city_mkr_lamp_raw.webp`, color: '#FF6B35' },
  { key: 'sea' as const, label: '海線', img: `${ASSET_BASE}/wt_sea_mkr_wave_raw.webp`, color: '#22d3ee' },
  { key: 'mountain' as const, label: '山線', img: `${ASSET_BASE}/wt_mtn_mkr_tent_raw.webp`, color: '#4ade80' },
  { key: 'city' as const, label: '市區', img: `${ASSET_BASE}/wt_city_mkr_lamp_raw.webp`, color: '#f97316' },
  { key: 'rail' as const, label: '南迴線', img: `${ASSET_BASE}/wt_rail_mkr_train_raw.webp`, color: '#a78bfa' },
  { key: 'islands' as const, label: '離島', img: `${ASSET_BASE}/wt_sea_mkr_wave_raw.webp`, color: '#38bdf8' },
];

const TYPES = [
  { key: 'all' as const, label: '全部', icon: Route },
  { key: 'food' as const, label: '美食', icon: Sparkles },
  { key: 'spot' as const, label: '景點', icon: MapPin },
];

type DistrictKey = typeof DISTRICTS[number]['key'];
type TypeKey = typeof TYPES[number]['key'];
type ValidCategory = 'mtn' | 'city' | 'sea' | 'rail' | 'islands';
type RawRow = Record<string, unknown>;

const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  mountain: { lat: 22.97, lng: 121.00, zoom: 10 },
  sea:      { lat: 23.05, lng: 121.35, zoom: 10 },
  city:     { lat: 22.76, lng: 121.15, zoom: 13 },
  rail:     { lat: 22.45, lng: 120.88, zoom: 10 },
  islands:  { lat: 22.55, lng: 121.45, zoom: 11 },
};

function VerticalRegionNav({
  districtFilter,
  onSelect,
}: {
  districtFilter: DistrictKey;
  onSelect: (key: DistrictKey, center: { lat: number; lng: number; zoom: number } | null) => void;
}) {
  return (
    <div className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
      {DISTRICTS.map(({ key, label, img, color }) => {
        const isActive = districtFilter === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key, REGION_CENTERS[key] ?? null)}
            className="group flex h-[54px] w-[54px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border-2 transition-all duration-150 active:scale-90 hover:scale-105"
            style={{
              borderColor: isActive ? color : 'rgba(255,255,255,0.18)',
              background: isActive
                ? `radial-gradient(circle at center, ${color}33 0%, ${color}14 100%)`
                : 'rgba(14,24,18,0.82)',
              boxShadow: isActive
                ? `inset 0 2px 8px rgba(0,0,0,0.5), 0 0 14px ${color}66, 0 3px 10px rgba(0,0,0,0.4)`
                : 'inset 0 2px 10px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35)',
            }}
          >
            <img
              src={img}
              alt={label}
              width={30}
              height={30}
              className={`h-[30px] w-[30px] object-contain transition-all duration-150 ${isActive ? 'sticker-icon-glow' : ''}`}
              style={{
                filter: isActive
                  ? `drop-shadow(0 0 6px ${color})`
                  : 'grayscale(35%) brightness(0.78)',
              }}
            />
            <span
              className="text-[9px] font-black tracking-wide leading-none"
              style={{ color: isActive ? color : 'rgba(255,255,255,0.45)' }}
            >
              {label.length > 2 ? label.slice(0, 2) : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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

function categoryLabel(category?: string): string {
  if (category === 'sea') return '海線';
  if (category === 'mtn') return '山線';
  if (category === 'city') return '市區';
  if (category === 'rail') return '南迴線';
  if (category === 'islands') return '離島';
  return '台東';
}

function normalizeCategory(value: unknown, text = ''): ValidCategory {
  if (value === 'sea' || value === 'mtn' || value === 'city' || value === 'rail' || value === 'islands') return value;
  if (/離島|綠島|蘭嶼|小蘭嶼/.test(text)) return 'islands';
  if (/南迴|鐵道|鐵路|太麻里|金崙|大武|達仁/.test(text)) return 'rail';
  if (/海|港|漁|浪|三仙台|東河|成功|長濱/.test(text)) return 'sea';
  if (/市區|台東市|臺東市|森林公園|鐵花村/.test(text)) return 'city';
  return 'mtn';
}

function dateOnlyTaipei(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
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
    vibe_tags: wildTags.length > 0 ? wildTags : ['美食', categoryLabel(category)],
    start_time: '2020-01-01T00:00:00+08:00',
    end_date: '2099-12-31',
    is_free: true,
    weather_resilience: 1,
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
    vibe_tags: wildTags.length > 0 ? wildTags : ['景點', categoryLabel(category)],
    opening_hours: typeof raw.opening_hours === 'string' ? raw.opening_hours : undefined,
    source_url: typeof raw.source_url === 'string' ? raw.source_url : undefined,
    start_time: '2020-01-01T00:00:00+08:00',
    end_date: '2099-12-31',
    is_free: true,
    weather_resilience: 1,
  };
}

function eventSource(event: Event): 'food' | 'spot' {
  return event.source === 'food' || event.place_type === 'food' || event.vibe_tags?.includes('美食') ? 'food' : 'spot';
}

function MobileRegionFilterBar({
  districtFilter,
  setDistrictFilter,
}: {
  districtFilter: DistrictKey;
  setDistrictFilter: (key: DistrictKey) => void;
}) {
  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-[#0a1510]/90 px-2 pb-2 pt-3 backdrop-blur-md lg:hidden">
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {DISTRICTS.map(({ key, label, img, color }) => {
          const isActive = districtFilter === key;
          return (
            <button key={key} type="button" onClick={() => setDistrictFilter(key)} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2"
                style={{
                  background: isActive ? `${color}24` : 'rgba(255,255,255,0.07)',
                  borderColor: isActive ? color : 'rgba(255,255,255,0.12)',
                }}
              >
                <img src={img} alt={label} className="h-full w-full object-cover" />
              </span>
              <span className="w-full truncate text-center text-[10px] font-bold" style={{ color: isActive ? color : 'rgba(255,255,255,0.55)' }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function EventBrowser({ initialEvents }: { initialEvents: Event[] }) {
  const {
    tripStartDate: startDate,
    tripEndDate: endDate,
    setTripDates,
    clearTrip,
    plannedEvents,
    addTripDay,
    addEvent,
    removeEvent,
    setHoveredEventId,
    subFilter,
    setSubFilter,
    setWeatherData,
  } = useItineraryStore();
  const { reset: resetBuilder } = useBuilderStore();

  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<TypeKey>('all');
  const [districtFilter, setDistrictFilter] = useState<DistrictKey>('all');
  const [panCenter, setPanCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [activePage, setActivePage] = useState<JournalActivePage>('filters');
  const [activeSpot, setActiveSpot] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showHomeOnboarding, setShowHomeOnboarding] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [mobilePanelExpanded, setMobilePanelExpanded] = useState(false);
  const [mergedEvents, setMergedEvents] = useState<Event[]>(initialEvents);
  const [affiliatePackages, setAffiliatePackages] = useState<AffiliatePackage[]>([]);
  const dragControls = useDragControls();
  const setSelectedSpotIds = useShareItineraryStore((state) => state.setSelectedSpotIds);

  const today = useMemo(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }), []);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentWeather(supabase, '臺東縣').then((weather) => {
      if (!cancelled) setWeatherData(weather);
    });

    return () => {
      cancelled = true;
    };
  }, [setWeatherData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedItinerary = params.get('itinerary');
    if (!encodedItinerary) return;

    const spotIds = encodedItinerary.split(',').map((id) => id.trim()).filter(Boolean);
    if (spotIds.length > 0) setSelectedSpotIds(spotIds);
  }, [setSelectedSpotIds]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [foodResult, placesResult] = await Promise.all([
        supabase.from('food').select('*'),
        supabase.from('places').select('*'),
      ]);

      if (foodResult.error) console.error('[野台東][Browser] food 讀取失敗：', foodResult.error.message);
      if (placesResult.error) console.error('[野台東][Browser] places 讀取失敗：', placesResult.error.message);

      const foodEvents = (foodResult.data ?? []).map((row) => foodToEvent(row as Food)).filter(Boolean) as Event[];
      const placeEvents = (placesResult.data ?? []).map((row) => placeToEvent(row as Place)).filter(Boolean) as Event[];
      const merged = [...foodEvents, ...placeEvents];

      console.log('[野台東][Browser] 合併後事件資料：', merged.map((event) => ({
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

      if (!cancelled && merged.length > 0) setMergedEvents(merged);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [initialEvents]);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('affiliate_packages')
      .select('id, title, image_url, link_url, category_match')
      .order('title', { ascending: true })
      .limit(10)
      .then(({ data, error }) => {
        if (error) {
          console.error('[野台東][Browser] affiliate_packages 讀取失敗：', error.message);
          return;
        }
        if (!cancelled) setAffiliatePackages(((data ?? []) as AffiliatePackage[]).filter((item) => Boolean(item.link_url)));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (localStorage.getItem(HOME_ONBOARDING_KEY)) return;
    setShowHomeOnboarding(true);
  }, []);

  const sourceEvents = mergedEvents.length > 0 ? mergedEvents : initialEvents;

  const availableSubFilters = useMemo(() => {
    const targetSource = viewMode === 'food' ? 'food' : viewMode === 'spot' ? 'spot' : null;
    const tags = sourceEvents
      .filter((event) => !targetSource || eventSource(event) === targetSource)
      .flatMap((event) => event.vibe_tags ?? [])
      .filter((tag) => !['美食', '景點', '海線', '山線', '市區', '南迴線'].includes(tag));

    return Array.from(new Set(tags)).slice(0, 12);
  }, [sourceEvents, viewMode]);

  const filteredEvents = useMemo(() => {
    let events = sourceEvents;

    if (startDate && endDate) {
      events = events.filter((event) => {
        const eventStart = dateOnlyTaipei(event.start_time);
        const eventEnd = event.end_date ?? (event.end_time ? dateOnlyTaipei(event.end_time) : eventStart);
        return eventStart <= endDate && eventEnd >= startDate;
      });
    }

    if (viewMode === 'food') events = events.filter((event) => eventSource(event) === 'food');
    if (viewMode === 'spot') events = events.filter((event) => eventSource(event) === 'spot');

    if (subFilter !== 'all') {
      events = events.filter((event) => event.vibe_tags?.includes(subFilter));
    }

    if (districtFilter !== 'all') {
      const category = districtFilter === 'mountain' ? 'mtn' : districtFilter;
      events = events.filter((event) => event.category === category);
    }

    return events;
  }, [sourceEvents, startDate, endDate, viewMode, subFilter, districtFilter]);

  const missedEvents = useMemo(() => {
    if (!startDate || !endDate) return [];
    const tripEnd = new Date(endDate);
    tripEnd.setDate(tripEnd.getDate() + 7);
    const afterTrip = tripEnd.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    return sourceEvents.filter((event) => {
      const eventStart = dateOnlyTaipei(event.start_time);
      return eventStart > endDate && eventStart <= afterTrip;
    });
  }, [sourceEvents, startDate, endDate]);

  const visibleAffiliatePackages = useMemo(() => {
    const category = districtFilter === 'mountain' ? 'mtn' : districtFilter;
    const packages = category === 'all'
      ? affiliatePackages
      : affiliatePackages.filter((pkg) => pkg.category_match === category);
    return packages.slice(0, 2);
  }, [affiliatePackages, districtFilter]);

  if (!isMounted) return null;

  const cardProps = {
    plannedEvents,
    onSelect: setSelectedEvent,
    onAdd: addEvent,
    onRemove: removeEvent,
    onHoverEnter: setHoveredEventId,
    onHoverLeave: () => setHoveredEventId(null),
  };

  const handleStayLonger = (event: Event) => {
    addTripDay();
    addEvent(event, { isExtraDayTrigger: true });
  };

  const handleMapSpotSelect = (event: Event) => {
    setActiveSpot(event);
    setActivePage('spotDetail');
    setHoveredEventId(event.id);
  };

  return (
    <>
      <main className="hidden h-screen w-screen overflow-hidden bg-[#0a1510] lg:flex">
        <section className="h-full w-[400px] shrink-0 xl:w-2/5">
          <JournalContainer
            events={filteredEvents}
            affiliatePackages={visibleAffiliatePackages}
            plannedEvents={plannedEvents}
            activePage={activePage}
            setActivePage={setActivePage}
            activeSpot={activeSpot}
            viewMode={viewMode}
            setViewMode={setViewMode}
            districtFilter={districtFilter}
            setDistrictFilter={setDistrictFilter}
            subFilter={subFilter}
            setSubFilter={setSubFilter}
            availableSubFilters={availableSubFilters}
            startDate={startDate}
            endDate={endDate}
            today={today}
            setTripDates={setTripDates}
            onClearTrip={() => { clearTrip(); resetBuilder(); }}
            onSelect={setSelectedEvent}
            onAdd={addEvent}
            onRemove={removeEvent}
            onHoverEnter={setHoveredEventId}
            onHoverLeave={() => setHoveredEventId(null)}
          />
        </section>
        <section className="relative h-full flex-1">
          <EventsMapDynamic events={filteredEvents} activeSpotId={activeSpot?.id ?? null} onSpotSelect={handleMapSpotSelect} panTarget={panCenter} />
          <VerticalRegionNav
            districtFilter={districtFilter}
            onSelect={(key, center) => {
              setDistrictFilter(key);
              if (center) setPanCenter(center);
            }}
          />
        </section>
      </main>

      <div className="fixed inset-0 z-0 lg:hidden">
        <EventsMapDynamic events={filteredEvents} activeSpotId={activeSpot?.id ?? null} onSpotSelect={handleMapSpotSelect} />
      </div>
      <MobileRegionFilterBar districtFilter={districtFilter} setDistrictFilter={setDistrictFilter} />

      <motion.section
        className="fixed bottom-0 left-0 right-0 z-30 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-white/10 lg:hidden"
        style={{ background: 'rgba(228,213,176,0.98)' }}
        animate={{ y: mobilePanelExpanded ? 0 : 'calc(100% - 60px)' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={(_, info) => setMobilePanelExpanded(info.offset.y < -24 || (mobilePanelExpanded && info.offset.y < 48))}
      >
        <button
          type="button"
          onPointerDown={(event) => dragControls.start(event)}
          onClick={() => setMobilePanelExpanded((value) => !value)}
          className="flex h-[60px] w-full shrink-0 flex-col items-center justify-center gap-1 text-[#1B2E26]"
        >
          <span className="h-1 w-10 rounded-full bg-[#1B2E26]/25" />
          <span className="flex items-center gap-2 text-xs font-black tracking-[0.18em]">
            {mobilePanelExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {filteredEvents.length} 筆探險地點
          </span>
        </button>

        <div className="border-y border-[#1B2E26]/10 px-4 py-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={(event) => setTripDates(event.target.value, endDate)} className="rounded-lg border border-[#1B2E26]/15 bg-white px-3 py-2 text-sm text-[#1B2E26]" />
            <input type="date" min={startDate} value={endDate} onChange={(event) => setTripDates(startDate, event.target.value)} className="rounded-lg border border-[#1B2E26]/15 bg-white px-3 py-2 text-sm text-[#1B2E26]" />
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {TYPES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setViewMode(key);
                  setSubFilter('all');
                }}
                className={[
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition',
                  viewMode === key ? 'border-[#1B2E26] bg-[#1B2E26] text-[#F5F5DC]' : 'border-[#1B2E26]/15 bg-white text-[#1B2E26]',
                ].join(' ')}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {viewMode !== 'all' && availableSubFilters.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
              {['all', ...availableSubFilters].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSubFilter(tag)}
                  className={[
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-black',
                    subFilter === tag ? 'border-[#8d5a2b] bg-[#8d5a2b] text-white' : 'border-[#1B2E26]/15 bg-white text-[#1B2E26]',
                  ].join(' ')}
                >
                  {tag === 'all' ? '全部類型' : tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 pb-10">
          {filteredEvents.length === 0 ? (
            <div className="py-10 text-center text-sm font-bold text-[#6d765e]">沒有符合條件的地點</div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {visibleAffiliatePackages.map((pkg) => (
                <a
                  key={`mobile-affiliate-package-${pkg.id}`}
                  href={pkg.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white p-3 pb-8 shadow-lg"
                >
                  <div className="h-36 overflow-hidden bg-[#1B2E26]/10">
                    {pkg.image_url ? (
                      <img src={pkg.image_url} alt={pkg.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#d8cda5] text-sm font-black text-[#1B2E26]">旅遊套裝</div>
                    )}
                  </div>
                  <div className="pt-3">
                    <span className="rounded-full bg-[#8d5a2b] px-2 py-0.5 text-[11px] font-black text-white">旅遊套裝</span>
                    <h3 className="mt-2 font-serif text-lg font-black leading-tight text-[#1B2E26]">{pkg.title}</h3>
                  </div>
                </a>
              ))}
              {filteredEvents.map((event, index) => (
                <PolaroidCard key={event.id} event={event} index={index} {...cardProps} />
              ))}
            </div>
          )}

          {missedEvents.length > 0 && (
            <div className="pt-5">
              <p className="mb-2 flex items-center gap-2 text-xs font-black tracking-widest text-[#8d5a2b]"><Clock size={13} /> 多留一天可順路看看</p>
              {missedEvents.slice(0, 4).map((event) => (
                <button key={event.id} type="button" onClick={() => handleStayLonger(event)} className="mb-2 w-full rounded-lg border border-[#8d5a2b]/25 bg-white px-3 py-2 text-left text-sm font-bold text-[#1B2E26]">
                  {event.title}
                </button>
              ))}
            </div>
          )}

          {/* 郵戳印章 — Mobile 投稿按鈕 */}
          <div className="pt-6 pb-2 flex justify-center">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-[3px] border-dashed border-[#8d5a2b]/55 bg-[#ede4d0] text-[#8d5a2b] transition-all active:scale-90 hover:border-[#8d5a2b]"
                style={{ rotate: '-5deg', boxShadow: '2px 4px 12px rgba(141,90,43,0.16)' }}
                aria-label="提供新的冒險地點"
              >
                <span className="absolute inset-[6px] rounded-full border border-[#8d5a2b]/20 pointer-events-none" />
                <span className="relative z-10 flex flex-col items-center leading-tight select-none">
                  <span className="text-[7px] font-black tracking-[0.25em] uppercase opacity-80">WILD</span>
                  <span className="text-[10px] font-black">台東</span>
                  <span className="text-[6px] font-bold tracking-widest opacity-60">投稿</span>
                </span>
              </button>
              <span className="text-[9px] font-black tracking-wide text-[#8d5a2b]/60">新增秘境</span>
            </div>
          </div>
        </div>
      </motion.section>

      {showSubmitModal && <SubmitSpotModal onClose={() => setShowSubmitModal(false)} />}
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      {showHomeOnboarding && (
        <HomeOnboardingModal
          onClose={() => {
            localStorage.setItem(HOME_ONBOARDING_KEY, 'true');
            setShowHomeOnboarding(false);
          }}
        />
      )}
    </>
  );
}
