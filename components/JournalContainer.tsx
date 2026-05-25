'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import SubmitSpotModal from '@/components/SubmitSpotModal';
import { supabase as browserSupabase } from '@/lib/supabase';
import { CalendarX, CloudRain, CloudSun, ExternalLink, MapPin, Route, Sparkles, Thermometer } from 'lucide-react';
import { useItineraryStore as useShareItineraryStore } from '@/lib/store';
import { readWeatherCache, summarizeWeatherForTrip, type WeatherCacheRow } from '@/lib/weather';
import { useItineraryStore } from '@/store/useItineraryStore';
import type { AffiliatePackage, Event, PlannedEvent } from '@/types';

const ASSET_BASE = '/assets/wild-taitung';

type DistrictKey = 'all' | 'sea' | 'mountain' | 'city' | 'rail' | 'islands';
type TypeKey = 'all' | 'food' | 'spot';
export type JournalActivePage = 'filters' | 'cards' | 'spotDetail';

const DISTRICTS: Array<{ key: DistrictKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'sea', label: '海線' },
  { key: 'mountain', label: '山線' },
  { key: 'city', label: '市區' },
  { key: 'rail', label: '南迴線' },
  { key: 'islands', label: '離島' },
];

const TYPES: Array<{ key: TypeKey; label: string; icon: typeof Route }> = [
  { key: 'all', label: '全部', icon: Route },
  { key: 'food', label: '美食', icon: Sparkles },
  { key: 'spot', label: '景點', icon: MapPin },
];


function categoryLabel(category?: string): string {
  if (category === 'sea') return '海線';
  if (category === 'mtn') return '山線';
  if (category === 'city') return '市區';
  if (category === 'rail') return '南迴線';
  if (category === 'islands') return '離島';
  return '台東';
}

function weatherDescription(code: string | null): string {
  if (!code) return '天氣資料已更新';
  return code;
}

function formatForecastRange(fetchedAt: string, datasetId: string): string {
  const start = new Date(fetchedAt);
  const end = new Date(start);
  end.setDate(end.getDate() + (datasetId === 'F-D0047-089' ? 7 : 3));
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

function WeatherPanel({
  rows,
  startDate,
  currentWeather,
}: {
  rows: WeatherCacheRow[];
  startDate: string;
  currentWeather: WeatherCacheRow | null;
}) {
  const summary = useMemo(() => summarizeWeatherForTrip(rows, startDate), [rows, startDate]);
  const displayRows = summary.rows.slice(0, 4);

  const hasData = currentWeather !== null || displayRows.length > 0;
  const dateRange = currentWeather
    ? formatForecastRange(currentWeather.fetched_at, currentWeather.dataset_id)
    : displayRows.length > 0
    ? formatForecastRange(displayRows[0].fetched_at, displayRows[0].dataset_id)
    : '';

  return (
    <section className="rounded-xl border border-[#1B2E26]/10 bg-white/65 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CloudSun size={18} className="text-[#8d5a2b]" />
          <h2 className="font-serif text-lg font-black">{summary.label}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {dateRange && (
            <span className="rounded-full px-2 py-1 text-[10px] font-black text-[#8d5a2b]" style={{ background: 'rgba(141,90,43,0.10)' }}>
              {dateRange}
            </span>
          )}
          <span className="rounded-full bg-[#1B2E26]/10 px-2 py-1 text-[10px] font-black text-[#1B2E26]">CWA</span>
        </div>
      </div>
      <p className="text-xs font-semibold leading-relaxed text-[#5f654f]">{currentWeather ? '已載入 weather_cache 最新有效資料。' : summary.description}</p>

      {currentWeather ? (
        <div className="mt-3 rounded-lg bg-[#F5F5DC] px-3 py-3 text-xs font-bold text-[#1B2E26]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span>{currentWeather.location_name}</span>
            <span>{weatherDescription(currentWeather.weather_code)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-md bg-white/65 px-2 py-2">
              <Thermometer size={15} className="text-[#8d5a2b]" />
              <span>氣溫：資料未提供</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-white/65 px-2 py-2">
              <CloudRain size={15} className="text-[#256f8f]" />
              <span>降雨：{currentWeather.rain_prob_6h == null ? '--' : `${currentWeather.rain_prob_6h}%`}</span>
            </div>
          </div>
          <div className="mt-2 line-clamp-1 text-[#6d765e]">
            {currentWeather.wind_beaufort != null ? `風力 ${currentWeather.wind_beaufort} 級` : '風力資料未提供'}
            {currentWeather.wave_height_m != null ? `，浪高 ${currentWeather.wave_height_m}m` : ''}
          </div>
        </div>
      ) : displayRows.length === 0 ? (
        <p className="mt-3 text-xs font-bold text-[#8d5a2b]">尚未有 weather_cache 資料，請先執行天氣更新流程。</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {displayRows.map((row) => (
            <div key={`${row.location_name}-${row.dataset_id}-${row.fetched_at}`} className="rounded-lg bg-[#F5F5DC] px-3 py-2 text-xs font-bold text-[#1B2E26]">
              <div className="flex items-center justify-between gap-2">
                <span>{row.location_name}</span>
                <span>{row.rain_prob_6h == null ? '降雨 --' : `降雨 ${row.rain_prob_6h}%`}</span>
              </div>
              <div className="mt-1 line-clamp-1 text-[#6d765e]">
                {weatherDescription(row.weather_code)}
                {row.wind_beaufort != null ? `，風力 ${row.wind_beaufort} 級` : ''}
                {row.wave_height_m != null ? `，浪高 ${row.wave_height_m}m` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasData && (
        <p className="mt-3 text-[10px] font-semibold leading-relaxed text-[#8d5a2b]/80">
          行程快到了嗎？出發前記得回來確認最新的天氣狀況喔！
        </p>
      )}
    </section>
  );
}

export function PolaroidCard({
  event,
  index,
  plannedEvents,
  onSelect,
  onAdd,
  onRemove,
  onHoverEnter,
  onHoverLeave,
}: {
  event: Event;
  index: number;
  plannedEvents: PlannedEvent[];
  onSelect: (event: Event) => void;
  onAdd: (event: Event) => void;
  onRemove: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
}) {
  const [swayDelay]    = useState(() => -(Math.random() * 5));
  const [swayDuration] = useState(() => parseFloat((4 + Math.random() * 3).toFixed(2)));
  const [swayAngle]    = useState(() => parseFloat((0.8 + Math.random() * 1.2).toFixed(2)));
  const { selectedSpotIds, addSpot, removeSpot } = useShareItineraryStore();
  const isAdded = selectedSpotIds.includes(event.id) || plannedEvents.some((item) => item.id === event.id);
  const rotationClass = index % 2 === 0 ? 'rotate-2' : '-rotate-2';
  const yOffsetPx = index % 3 === 0 ? 6 : index % 3 === 1 ? -2 : 10;
  const imageSrc = event.image_captured || event.engagement_metrics?.image_captured || null;

  return (
    <div
      className="card-entrance"
      style={{ '--card-delay': `${index * 0.07}s` } as React.CSSProperties}
    >
    <div
      className="card-sway"
      style={{
        '--sway-delay':    `${swayDelay}s`,
        '--sway-duration': `${swayDuration}s`,
        '--sway-angle':    `${swayAngle}deg`,
      } as React.CSSProperties}
    >
    <div
      onClick={() => onSelect(event)}
      onMouseEnter={() => onHoverEnter(event.id)}
      onMouseLeave={onHoverLeave}
      className={`card-press distressed-card relative cursor-pointer transition hover:z-10 hover:rotate-0 hover:scale-[1.03] ${rotationClass}`}
      style={{ top: yOffsetPx }}
      data-rotation-class={rotationClass}
      data-y-offset={yOffsetPx}
    >
      {/* ── 照片區 ── */}
      <div className="relative h-48 overflow-hidden">
        {imageSrc ? (
          <Image src={imageSrc} alt={event.title} width={320} height={192} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-200 to-[#d8cda5]">
            <MapPin className="w-7 h-7 text-[#8d5a2b]/50" />
            <span className="text-[9px] font-black tracking-wide text-[#8d5a2b]/60">台東探險</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#F5F5DC] to-transparent" />
        <span
          className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-black tracking-[0.12em]"
          style={{
            background: event.source === 'food' ? 'rgba(141,90,43,0.85)' : 'rgba(27,46,38,0.80)',
            color: '#F5F5DC',
            borderRadius: 4,
          }}
        >
          {event.source === 'food' ? '美食' : '景點'} · {categoryLabel(event.category)}
        </span>
      </div>

      {/* ── 文字區 ── */}
      <div className="px-4 pt-2 pb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="line-clamp-2 font-serif text-base font-black leading-tight text-[#1B2E26]">{event.title}</h3>
          <button
            type="button"
            onClick={(eventClick) => {
              eventClick.stopPropagation();
              if (isAdded) { removeSpot(event.id); onRemove(event.id); }
              else { addSpot(event.id); onAdd(event); }
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B2E26] text-sm font-black text-white"
            aria-label={isAdded ? '移出我的行程' : '加入我的行程'}
          >
            {isAdded ? '✓' : '+'}
          </button>
        </div>
        <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-[#5f654f]">
          {event.description || event.long_description || '點擊查看詳情'}
        </p>
      </div>
    </div>
    </div>
    </div>
  );
}

function FiltersPage({
  viewMode,
  setViewMode,
  districtFilter,
  setDistrictFilter,
  subFilter,
  setSubFilter,
  availableSubFilters,
  startDate,
  endDate,
  today,
  setTripDates,
  onClearTrip,
  weatherRows,
  currentWeather,
}: {
  viewMode: TypeKey;
  setViewMode: (key: TypeKey) => void;
  districtFilter: DistrictKey;
  setDistrictFilter: (key: DistrictKey) => void;
  subFilter: string;
  setSubFilter: (tag: string) => void;
  availableSubFilters: string[];
  startDate: string;
  endDate: string;
  today: string;
  setTripDates: (start: string, end: string) => void;
  onClearTrip?: () => void;
  weatherRows: WeatherCacheRow[];
  currentWeather: WeatherCacheRow | null;
}) {
  return (
    <div className="space-y-4">
      <WeatherPanel rows={weatherRows} startDate={startDate} currentWeather={currentWeather} />

      <div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={startDate} onChange={(event) => setTripDates(event.target.value, endDate)} className="rounded-lg border border-[#1B2E26]/15 bg-white px-3 py-2 text-sm font-bold outline-none" />
          <input type="date" min={startDate} value={endDate} onChange={(event) => setTripDates(startDate, event.target.value)} className="rounded-lg border border-[#1B2E26]/15 bg-white px-3 py-2 text-sm font-bold outline-none" />
        </div>
        <button
          type="button"
          onClick={() => {
            if (startDate && endDate) {
              // 清除日期同時清空所有已排行程，避免殘留景點卡住
              if (onClearTrip) onClearTrip();
              else setTripDates('', '');
            } else {
              setTripDates(today, today);
            }
          }}
          className="mt-2 text-xs font-black text-[#8d5a2b]"
        >
          {startDate && endDate ? '清除日期' : '使用今天'}
        </button>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[#8d5a2b]">主分類</p>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setViewMode(key);
                setSubFilter('all');
              }}
              className={[
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-black transition hover:shadow-[0_0_16px_rgba(255,255,255,0.72)]',
                viewMode === key ? 'border-[#1B2E26] bg-[#1B2E26] text-[#F5F5DC]' : 'border-[#1B2E26]/15 bg-white/70 text-[#1B2E26]',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {viewMode !== 'all' && (
        <div>
          <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[#8d5a2b]">類型篩選</p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {['all', ...availableSubFilters].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSubFilter(tag)}
                className={[
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition',
                  subFilter === tag ? 'border-[#8d5a2b] bg-[#8d5a2b] text-white' : 'border-[#1B2E26]/15 bg-white/70 text-[#1B2E26]',
                ].join(' ')}
              >
                {tag === 'all' ? '全部類型' : tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[#8d5a2b]">區域線路</p>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {DISTRICTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDistrictFilter(key)}
              className={[
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition',
                districtFilter === key ? 'border-[#1B2E26] bg-[#1B2E26] text-[#F5F5DC]' : 'border-[#1B2E26]/15 bg-white/70 text-[#1B2E26]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardsPage({
  events,
  affiliatePackages,
  plannedEvents,
  onSelect,
  onAdd,
  onRemove,
  onHoverEnter,
  onHoverLeave,
}: {
  events: Event[];
  affiliatePackages: AffiliatePackage[];
  plannedEvents: PlannedEvent[];
  onSelect: (event: Event) => void;
  onAdd: (event: Event) => void;
  onRemove: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
}) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white/70 px-4 py-3 text-sm font-black text-[#5f654f]">
        <CalendarX size={18} /> 沒有符合條件的地點
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {affiliatePackages.map((pkg) => (
        <a
          key={`affiliate-package-${pkg.id}`}
          href={pkg.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative min-h-[260px] bg-white p-3 pb-12 shadow-lg transition hover:z-10 hover:scale-[1.03]"
        >
          <div className="h-36 overflow-hidden bg-[#1B2E26]/10">
            {pkg.image_url ? (
              <img src={pkg.image_url} alt={pkg.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#d8cda5]">
                <Image src={`${ASSET_BASE}/wt_sea_mkr_wave_raw.webp`} alt="" width={52} height={52} />
              </div>
            )}
          </div>
          <div className="pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="rounded-full bg-[#8d5a2b] px-2 py-0.5 text-[11px] font-black text-white">旅遊套裝</span>
              <ExternalLink size={16} className="text-[#8d5a2b]" />
            </div>
            <h3 className="line-clamp-2 font-serif text-lg font-black leading-tight text-[#1B2E26]">{pkg.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[#5f654f]">預訂套裝行程與交通票券</p>
          </div>
        </a>
      ))}
      {events.map((event, index) => (
        <PolaroidCard
          key={event.id}
          event={event}
          index={index}
          plannedEvents={plannedEvents}
          onSelect={onSelect}
          onAdd={onAdd}
          onRemove={onRemove}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
        />
      ))}
    </div>
  );
}

export default function JournalContainer({
  events,
  affiliatePackages,
  plannedEvents,
  activePage,
  setActivePage,
  activeSpot,
  viewMode,
  setViewMode,
  districtFilter,
  setDistrictFilter,
  subFilter,
  setSubFilter,
  availableSubFilters,
  startDate,
  endDate,
  today,
  setTripDates,
  onClearTrip,
  onSelect,
  onAdd,
  onRemove,
  onHoverEnter,
  onHoverLeave,
}: {
  events: Event[];
  affiliatePackages: AffiliatePackage[];
  plannedEvents: PlannedEvent[];
  activePage: JournalActivePage;
  setActivePage: (page: JournalActivePage) => void;
  activeSpot: Event | null;
  viewMode: TypeKey;
  setViewMode: (key: TypeKey) => void;
  districtFilter: DistrictKey;
  setDistrictFilter: (key: DistrictKey) => void;
  subFilter: string;
  setSubFilter: (tag: string) => void;
  availableSubFilters: string[];
  startDate: string;
  endDate: string;
  today: string;
  setTripDates: (start: string, end: string) => void;
  /** 完整清空行程（日期＋景點＋Builder），由父層注入 */
  onClearTrip?: () => void;
  onSelect: (event: Event) => void;
  onAdd: (event: Event) => void;
  onRemove: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
}) {
  const [weatherRows, setWeatherRows] = useState<WeatherCacheRow[]>([]);
  const [showShareToast, setShowShareToast] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const { selectedSpotIds, addSpot, removeSpot, clearItinerary } = useShareItineraryStore();
  const weatherData = useItineraryStore((state) => state.weatherData);

  useEffect(() => {
    let cancelled = false;
    readWeatherCache(browserSupabase).then((rows) => {
      if (!cancelled) setWeatherRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shareItinerary = async () => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    params.set('itinerary', selectedSpotIds.join(','));
    url.search = params.toString();

    await navigator.clipboard.writeText(url.toString());
    setShowShareToast(true);
    window.setTimeout(() => setShowShareToast(false), 2200);
  };

  const journalPage = (() => {
    if (activePage === 'filters') {
      return (
        <FiltersPage
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
          onClearTrip={onClearTrip}
          weatherRows={weatherRows}
          currentWeather={weatherData}
        />
      );
    }

    if (activePage === 'spotDetail') {
      const isActiveSpotAdded = !!activeSpot && (selectedSpotIds.includes(activeSpot.id) || plannedEvents.some((item) => item.id === activeSpot.id));
      const toggleSpot = (spot: Event) => {
        if (isActiveSpotAdded) {
          removeSpot(spot.id);
          onRemove(spot.id);
        } else {
          addSpot(spot.id);
          onAdd(spot);
        }
      };

      const warningTags = (activeSpot?.vibe_tags ?? []).filter((t) =>
        /危險|注意|禁止|管制|警告|颱風|溪流|野溪/.test(t)
      );

      const imageSrc = activeSpot?.image_captured || activeSpot?.engagement_metrics?.image_captured || null;

      return (
        <div className="space-y-3">
          {activeSpot ? (
            <>
              {/* ── 英雄卡：左圖右文 ── */}
              <div className="overflow-hidden rounded-xl border border-[#1B2E26]/10 bg-white/70">
                <div className="flex">
                  {/* 左側：佔位圖 */}
                  <div className="relative h-[148px] w-28 shrink-0 overflow-hidden bg-[#d8cda5]">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={activeSpot.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                        {activeSpot.source === 'food'
                          ? <Sparkles className="w-7 h-7 text-[#8d5a2b]/50" />
                          : <MapPin className="w-7 h-7 text-[#1B2E26]/50" />}
                      </div>
                    )}
                    {/* 類別色帶 */}
                    <div
                      className="absolute bottom-0 left-0 right-0 py-1 text-center text-[9px] font-black"
                      style={{
                        background: activeSpot.source === 'food' ? 'rgba(141,90,43,0.88)' : 'rgba(27,46,38,0.82)',
                        color: '#F5F5DC',
                      }}
                    >
                      {activeSpot.source === 'food' ? '美食' : '景點'}
                    </div>
                  </div>

                  {/* 右側：名稱 + 座標 + vibe_tags */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.15em] text-[#8d5a2b]">
                        {categoryLabel(activeSpot.category)}
                      </p>
                      <h2 className="mt-0.5 font-serif text-xl font-black leading-tight text-[#1B2E26]">
                        {activeSpot.title}
                      </h2>
                      <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#1B2E26]/45">
                        {activeSpot.latitude?.toFixed(4)}°N{'  '}
                        {activeSpot.longitude?.toFixed(4)}°E
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(activeSpot.vibe_tags ?? [])
                          .filter((t) => !/危險|注意|禁止|管制|警告|颱風|溪流|野溪/.test(t))
                          .slice(0, 3)
                          .map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[#1B2E26]/08 px-2 py-0.5 text-[9px] font-black text-[#5f654f]"
                              style={{ background: 'rgba(27,46,38,0.08)' }}
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSpot(activeSpot)}
                      className="mt-3 self-start rounded-full px-4 py-1.5 text-xs font-black transition hover:brightness-110"
                      style={{
                        background: isActiveSpotAdded ? '#2d5a3d' : '#1B2E26',
                        color: '#F5F5DC',
                      }}
                    >
                      {isActiveSpotAdded ? '✓ 已加入行程' : '＋ 加入行程'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 景點故事 ── */}
              <div className="rounded-xl border border-[#1B2E26]/10 bg-white/70 p-4">
                <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[#8d5a2b]">景點故事</p>
                <p className="text-sm font-semibold leading-relaxed text-[#5f654f]">
                  {activeSpot.description || activeSpot.long_description || '尚未加入詳細描述。'}
                </p>
              </div>

              {/* ── 探險資訊 ── */}
              <div className="rounded-xl border border-[#1B2E26]/10 bg-white/70 p-4">
                <p className="mb-3 text-[11px] font-black tracking-[0.18em] text-[#8d5a2b]">探險資訊</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 rounded-lg px-3 py-2 text-xs font-bold text-[#1B2E26]" style={{ background: 'rgba(27,46,38,0.08)' }}>
                    <span className="text-[#8d5a2b]">GPS　</span>
                    <span className="font-mono">{activeSpot.latitude?.toFixed(5)}, {activeSpot.longitude?.toFixed(5)}</span>
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs font-bold text-[#1B2E26]" style={{ background: 'rgba(27,46,38,0.08)' }}>
                    <span className="text-[#8d5a2b]">線路　</span>{categoryLabel(activeSpot.category)}
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs font-bold text-[#1B2E26]" style={{ background: 'rgba(27,46,38,0.08)' }}>
                    <span className="text-[#8d5a2b]">類型　</span>{activeSpot.source === 'food' ? '美食' : '景點'}
                  </div>
                  {activeSpot.opening_hours && (
                    <div className="col-span-2 rounded-lg px-3 py-2 text-xs font-bold text-[#1B2E26]" style={{ background: 'rgba(27,46,38,0.08)' }}>
                      <span className="text-[#8d5a2b]">時間　</span>{activeSpot.opening_hours}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 重要提醒（有 safety_notes 或警告 tag 才顯示）── */}
              {(activeSpot.safety_notes || warningTags.length > 0) && (
                <div className="rounded-xl border border-[#c0392b]/20 p-4" style={{ background: '#fff5f5' }}>
                  <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-[#c0392b]">⚠ 重要提醒</p>
                  {activeSpot.safety_notes && (
                    <p className="text-sm font-semibold leading-relaxed text-[#7b2d2d]">{activeSpot.safety_notes}</p>
                  )}
                  {warningTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {warningTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#c0392b]/10 px-2 py-0.5 text-[10px] font-black text-[#c0392b]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-[#1B2E26]/10 bg-white/70 p-4">
              <div className="flex items-center gap-4">
                <Image src={`${ASSET_BASE}/wt_mtn_icn_boots_raw.webp`} alt="" width={44} height={44} className="opacity-50" />
                <div>
                  <h2 className="font-serif text-lg font-black text-[#1B2E26]">尚未選擇地點</h2>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#5f654f]">
                    點擊地圖圖釘，這裡會顯示探險筆記。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <CardsPage
        events={events}
        affiliatePackages={affiliatePackages}
        plannedEvents={plannedEvents}
        onSelect={onSelect}
        onAdd={onAdd}
        onRemove={onRemove}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
    );
  })();

  return (
    <aside className="flex h-full flex-col bg-[#e4d5b0] text-[#1B2E26] shadow-inner">
      <header className="border-b border-[#1B2E26]/10 px-7 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.22em] text-[#8d5a2b]">探險日誌</p>
            <h1 className="mt-1 font-serif text-4xl font-black leading-tight">Wild Taitung</h1>
          </div>
          <Link
            href="/itinerary/builder"
            className="rounded-full bg-[#1B2E26] px-4 py-2 text-xs font-black text-[#F5F5DC] shadow transition hover:shadow-[0_0_18px_rgba(255,255,255,0.75)] hover:brightness-110"
          >
            我的行程 {plannedEvents.length || ''}
          </Link>
        </div>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-[#5f654f]">
          先選擇美食或景點，再用類型與區域線路縮小範圍。
        </p>
      </header>

      <nav className="border-b border-[#1B2E26]/10 px-7 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'filters' as const, label: '冒險筆記' },
            { key: 'cards' as const, label: '探索卡片' },
            { key: 'spotDetail' as const, label: '詳情' },
          ].map((page) => (
            <button
              key={page.key}
              type="button"
              onClick={() => setActivePage(page.key)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-black transition',
                activePage === page.key ? 'bg-[#1B2E26] text-[#F5F5DC]' : 'bg-white/70 text-[#1B2E26]/60',
              ].join(' ')}
            >
              {page.label}
            </button>
          ))}
          <button
            type="button"
            onClick={shareItinerary}
            className="ml-auto rounded-full bg-[#8d5a2b] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#6f4520] hover:shadow-[0_0_16px_rgba(255,211,122,0.65)]"
          >
            分享行程
          </button>
          <button
            type="button"
            onClick={clearItinerary}
            className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black text-[#1B2E26]/60 transition hover:text-[#1B2E26]"
          >
            清空分享
          </button>
        </div>
      </nav>

      <section id="tour-event-grid" className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-black">
          {activePage === 'cards' ? '探索卡片' : activePage === 'spotDetail' ? '冒險筆記' : 'ADVENTURE NOTES'}
        </h2>
          <span className="rounded-full bg-[#1B2E26]/10 px-3 py-1 text-xs font-black">{events.length} 筆</span>
        </div>
        {journalPage}
      </section>

      {/* 郵戳印章 — 提供新冒險地點 */}
      <footer className="shrink-0 border-t border-[#1B2E26]/10 px-7 py-5 bg-[#F5F5DC] flex justify-center items-center">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="card-press relative flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-[3px] border-dashed border-[#8d5a2b]/55 bg-[#ede4d0] text-[#8d5a2b] hover:border-[#8d5a2b] hover:bg-[#e5d8c0] transition-colors"
            style={{ rotate: '-5deg', boxShadow: '2px 4px 14px rgba(141,90,43,0.18)' }}
            aria-label="提供新的冒險地點"
          >
            <span className="absolute inset-[7px] rounded-full border border-[#8d5a2b]/25 pointer-events-none" />
            <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" viewBox="0 0 72 72" aria-hidden>
              <circle cx="36" cy="36" r="32" fill="none" stroke="#8d5a2b" strokeWidth="0.8" strokeDasharray="2 5" />
            </svg>
            <span className="relative z-10 flex flex-col items-center leading-tight select-none">
              <span className="text-[8px] font-black tracking-[0.3em] uppercase opacity-80">WILD</span>
              <span className="text-[11px] font-black">台東</span>
              <span className="text-[7px] font-bold tracking-widest opacity-60">投稿秘境</span>
            </span>
          </button>
          <span className="text-[9px] font-black tracking-[0.12em] text-[#8d5a2b]/60">新增冒險地點</span>
        </div>
      </footer>

      {showSubmitModal && <SubmitSpotModal onClose={() => setShowSubmitModal(false)} />}

      {showShareToast && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full bg-[#1B2E26] px-5 py-3 text-sm font-black text-[#F5F5DC] shadow-xl">
          行程分享連結已複製！
        </div>
      )}
    </aside>
  );
}
