'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  DragDropContext, Droppable, Draggable,
  type DropResult, type DraggableProvidedDragHandleProps,
} from '@hello-pangea/dnd';
import { ArrowLeft, Coffee, GripVertical, ImageDown, MapPin, Plus, Ship, Trash2, Utensils, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWizardStore } from '@/store/useWizardStore';
import { useBuilderStore } from '@/store/useBuilderStore';
import { useItineraryStore } from '@/store/useItineraryStore';
import { MOCK_CURATED_ROUTES } from '@/lib/mock/curatedRoutes';
import { getLocalYYYYMMDD } from '@/lib/tripDates';
import { FerrySheet } from './_components/FerrySheet';
import { ExportModal } from './_components/ExportModal';
import { AddStopSheet } from './_components/AddStopSheet';
import { AdventureNameModal } from './_components/AdventureNameModal';
import type { AdventureTheme, BuilderDay, CuratedRoute, CuratedStop } from '@/types';
import type { SpotOption } from '@/lib/mock/addStopData';

// ── Map (SSR-safe) ─────────────────────────────────────────────────────────

const BuilderMap = dynamic(() => import('@/components/EventsMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: '#F8F5EE' }} />,
});

// ── Helpers ────────────────────────────────────────────────────────────────

function shiftDate(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number);
  return getLocalYYYYMMDD(new Date(y, m - 1, d + n));
}

function estimateDriveMinutes(from: CuratedStop, to: CuratedStop): number {
  const R = 6371;
  const lat1 = from.latitude * Math.PI / 180;
  const lat2 = to.latitude * Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * Math.PI / 180;
  const dLng = (to.longitude - from.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(5, Math.round(km / 0.65));
}

function calcTimeline(stops: CuratedStop[], departureTime: string): {
  startTimes: string[];
  driveMins: number[];
} {
  if (stops.length === 0) return { startTimes: [], driveMins: [] };
  const [hStr, mStr] = departureTime.split(':');
  let total = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  const startTimes: string[] = [];
  const driveMins: number[] = [];
  stops.forEach((stop, idx) => {
    if (idx > 0 && stop.manual_start_time) {
      const [h, m] = stop.manual_start_time.split(':');
      total = parseInt(h, 10) * 60 + parseInt(m, 10);
    }
    startTimes.push(
      `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
    );
    total += stop.stay_duration;
    if (idx < stops.length - 1) {
      const drive = estimateDriveMinutes(stop, stops[idx + 1]);
      driveMins.push(drive);
      total += drive;
    }
  });
  return { startTimes, driveMins };
}

function renumberDays(list: BuilderDay[], today: string): BuilderDay[] {
  return list.map((day, i) => ({
    ...day,
    day: i + 1,
    label: `Day ${i + 1}`,
    date: shiftDate(today, i),
  }));
}

function routeToDays(route: CuratedRoute, today: string): BuilderDay[] {
  return route.days_plan.map(p => ({
    ...p,
    date: shiftDate(today, p.day - 1),
    departureTime: '09:00',
  }));
}

function emptyDays(count: number, today: string): BuilderDay[] {
  return Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    label: `Day ${i + 1}`,
    has_island: false,
    stops: [],
    date: shiftDate(today, i),
    departureTime: '09:00',
  }));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function IslandBanner({
  name, onOpen, ferryUrl,
}: {
  name: string;
  onOpen: () => void;
  ferryUrl?: string | null;
}) {
  return (
    <div
      className="flex items-center gap-3 mb-4 p-4 rounded-xl"
      style={{ background: 'rgba(91,184,212,0.06)', border: '1px solid rgba(91,184,212,0.18)' }}
    >
      <Ship size={15} className="shrink-0" style={{ color: '#5bb8d4' }} />
      <div className="flex-1">
        <p className="text-xs font-bold" style={{ color: '#5bb8d4' }}>今天要出海！</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(91,184,212,0.55)' }}>
          記得提前訂 {name} 船票
        </p>
      </div>
      <div className="flex items-center gap-2">
        {ferryUrl && (
          <a
            href={ferryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold px-3 py-1.5 rounded-full transition-all"
            style={{
              color: '#D7AF70',
              border: '1px solid rgba(215,175,112,0.30)',
              background: 'rgba(215,175,112,0.08)',
            }}
          >
            🎟️ 預訂船票
          </a>
        )}
        <button
          onClick={onOpen}
          className="text-[10px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
          style={{ color: '#5bb8d4', border: '1px solid rgba(91,184,212,0.25)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(91,184,212,0.08)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          查看船班 →
        </button>
      </div>
    </div>
  );
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];
const MIN_STEPS = [0, 15, 30, 45];
const PICKER_ITEM_H = 32;
const PICKER_ROWS = 5;
const PICKER_PAD = PICKER_ITEM_H * Math.floor(PICKER_ROWS / 2); // 64px

function TimePicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (t: string) => void;
  onClose: () => void;
}) {
  const parts = value.split(':');
  const initH = Math.max(0, Math.min(23, parseInt(parts[0] ?? '9', 10)));
  const rawM = parseInt(parts[1] ?? '0', 10);
  const initMIdx = MIN_STEPS.reduce(
    (best, m, i) => Math.abs(m - rawM) < Math.abs(MIN_STEPS[best] - rawM) ? i : best,
    0,
  );

  const [selH, setSelH] = useState(initH);
  const [selMIdx, setSelMIdx] = useState(initMIdx);
  // Refs so scroll callbacks always read current state without stale closures
  const selHRef = useRef(selH);
  const selMIdxRef = useRef(selMIdx);
  selHRef.current = selH;
  selMIdxRef.current = selMIdx;

  const ref = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLDivElement>(null);
  const mRef = useRef<HTMLDivElement>(null);
  const hTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fmt = (h: number, mi: number) =>
    `${String(h).padStart(2, '0')}:${String(MIN_STEPS[mi]).padStart(2, '0')}`;

  // Scroll to initial values on mount
  useEffect(() => {
    if (hRef.current) hRef.current.scrollTop = initH * PICKER_ITEM_H;
    if (mRef.current) mRef.current.scrollTop = initMIdx * PICKER_ITEM_H;
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function onHScroll() {
    if (!hRef.current) return;
    const idx = Math.max(0, Math.min(23, Math.round(hRef.current.scrollTop / PICKER_ITEM_H)));
    setSelH(idx);
    clearTimeout(hTimer.current);
    hTimer.current = setTimeout(() => onChange(fmt(idx, selMIdxRef.current)), 100);
  }

  function onMScroll() {
    if (!mRef.current) return;
    const idx = Math.max(0, Math.min(MIN_STEPS.length - 1, Math.round(mRef.current.scrollTop / PICKER_ITEM_H)));
    setSelMIdx(idx);
    clearTimeout(mTimer.current);
    mTimer.current = setTimeout(() => onChange(fmt(selHRef.current, idx)), 100);
  }

  const CONTAINER_H = PICKER_ROWS * PICKER_ITEM_H; // 160px
  const HIGHLIGHT_TOP = Math.floor(PICKER_ROWS / 2) * PICKER_ITEM_H; // 64px

  const colStyle: React.CSSProperties = {
    flex: 1,
    height: CONTAINER_H,
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    paddingTop: PICKER_PAD,
    paddingBottom: PICKER_PAD,
    scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
  };

  const itemStyle = (active: boolean): React.CSSProperties => ({
    height: PICKER_ITEM_H,
    scrollSnapAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontFamily: 'ui-monospace, monospace',
    fontWeight: active ? 600 : 400,
    color: active ? '#D7AF70' : 'rgba(250,247,242,0.42)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'color 0.1s',
  });

  return (
    <div
      ref={ref}
      className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 rounded-xl overflow-hidden"
      style={{
        background: '#2D2820',
        border: '1px solid rgba(215,175,112,0.22)',
        width: 104,
        height: CONTAINER_H,
        boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
      }}
    >
      {/* Fixed highlight bar at center row */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10"
        style={{
          top: HIGHLIGHT_TOP,
          height: PICKER_ITEM_H,
          background: 'rgba(215,175,112,0.14)',
          borderTop: '1px solid rgba(215,175,112,0.38)',
          borderBottom: '1px solid rgba(215,175,112,0.38)',
        }}
      />
      {/* Gradient fade — top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{ height: PICKER_PAD, background: 'linear-gradient(to bottom, #2D2820 30%, transparent)' }}
      />
      {/* Gradient fade — bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{ height: PICKER_PAD, background: 'linear-gradient(to top, #2D2820 30%, transparent)' }}
      />

      <div className="flex h-full">
        {/* Hours */}
        <div
          ref={hRef}
          onScroll={onHScroll}
          style={{ ...colStyle, borderRight: '1px solid rgba(215,175,112,0.12)' }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              onClick={() => {
                setSelH(h);
                hRef.current?.scrollTo({ top: h * PICKER_ITEM_H, behavior: 'smooth' });
                onChange(fmt(h, selMIdxRef.current));
              }}
              style={itemStyle(selH === h)}
            >
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>
        {/* Minutes */}
        <div
          ref={mRef}
          onScroll={onMScroll}
          style={colStyle}
        >
          {MIN_STEPS.map((m, mi) => (
            <div
              key={m}
              onClick={() => {
                setSelMIdx(mi);
                mRef.current?.scrollTo({ top: mi * PICKER_ITEM_H, behavior: 'smooth' });
                onChange(fmt(selHRef.current, mi));
              }}
              style={itemStyle(selMIdx === mi)}
            >
              {String(m).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StopCard({
  stop, time, dragHandleProps, onRemove, onDurationChange,
  isFirstStop, onDepartureTimeChange, onManualTimeChange, dayDate,
}: {
  stop: CuratedStop;
  time: string;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onRemove: () => void;
  onDurationChange: (mins: number) => void;
  isFirstStop?: boolean;
  onDepartureTimeChange?: (t: string) => void;
  onManualTimeChange?: (time: string | null) => void;
  dayDate?: string;
}) {
  const isFood = stop.category === 'food';
  const isClosedDay = !!(
    stop.closed_days && stop.closed_days.length > 0 && dayDate &&
    stop.closed_days.includes(new Date(dayDate + 'T12:00:00').getDay())
  );
  const [editingDuration, setEditingDuration] = useState(false);
  const [editingDeparture, setEditingDeparture] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState(false);

  return (
    <div className="flex items-start gap-0 group">

      {/* Left: grip + time */}
      <div className="flex flex-col items-center pt-1 shrink-0 w-14 mr-1">
        <div
          {...(dragHandleProps ?? {})}
          className="cursor-grab active:cursor-grabbing transition-colors mb-2"
          style={{ color: '#D7AF70' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#B89050')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#D7AF70')}
        >
          <GripVertical size={13} />
        </div>

        {isFirstStop && onDepartureTimeChange ? (
          <div className="relative flex flex-col items-center">
            <button
              onClick={() => setEditingDeparture(v => !v)}
              className="text-[10px] font-mono text-center leading-tight transition-colors"
              style={{ color: '#8E8377' }}
              title="每日出發時間（後續行程將自動推算）"
            >
              {time}<span style={{ fontSize: 7, opacity: 0.5 }}>✎</span>
            </button>
            {editingDeparture && (
              <TimePicker
                value={time}
                onChange={onDepartureTimeChange}
                onClose={() => setEditingDeparture(false)}
              />
            )}
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-0.5">
            <button
              onClick={() => setEditingAnchor(v => !v)}
              className="text-[10px] font-mono text-center leading-tight transition-colors"
              style={{ color: stop.manual_start_time ? '#D7AF70' : 'rgba(90,100,90,0.45)' }}
              title={stop.manual_start_time ? `釘選於 ${stop.manual_start_time}（點擊修改）` : '點擊釘選時間'}
            >
              {time}
            </button>
            {editingAnchor && (
              <TimePicker
                value={stop.manual_start_time ?? time}
                onChange={(t) => onManualTimeChange?.(t)}
                onClose={() => setEditingAnchor(false)}
              />
            )}
            {stop.manual_start_time ? (
              <button
                onClick={() => onManualTimeChange?.(null)}
                className="text-[8px] leading-none transition-opacity hover:opacity-60"
                style={{ color: '#D7AF70' }}
                title="解除釘選"
              >
                🔒
              </button>
            ) : (
              <span style={{ fontSize: 7, opacity: 0.22, color: '#5A645A' }}>✎</span>
            )}
          </div>
        )}
      </div>

      {/* Right: card body */}
      <div
        className="flex-1 min-w-0 rounded-xl p-4 transition-colors duration-150"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E0D8',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isFood
              ? <Utensils size={11} className="shrink-0" style={{ color: '#C4956A' }} />
              : <MapPin   size={11} className="shrink-0" style={{ color: '#5A645A' }} />
            }
            <span className="text-sm font-medium truncate" style={{ color: '#5A645A' }}>
              {stop.name}
            </span>
          </div>
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-all pt-0.5 shrink-0 hover:scale-110"
            style={{ color: 'rgba(90,100,90,0.25)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.65)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(90,100,90,0.25)')}
          >
            <Trash2 size={12} />
          </button>
        </div>

        {isClosedDay && (
          <div
            className="mt-1.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold"
            style={{
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.22)',
              color: '#ef4444',
            }}
          >
            ⚠️ 提示：該景點/店家當天公休！
          </div>
        )}

        {stop.tip && (
          <p className="text-[10px] leading-relaxed mt-2 pl-5" style={{ color: '#8E8377' }}>
            {stop.tip}
          </p>
        )}

        <div className="mt-2 pl-5 flex items-center gap-1.5">
          <span className="text-[9px]" style={{ color: 'rgba(90,100,90,0.45)' }}>停留時間：</span>
          {editingDuration ? (
            <select
              autoFocus
              value={stop.stay_duration}
              onChange={e => { onDurationChange(Number(e.target.value)); setEditingDuration(false); }}
              onBlur={() => setEditingDuration(false)}
              className="text-[10px] rounded-lg px-2 py-0.5 outline-none"
              style={{
                background: 'white',
                border: '1px solid rgba(90,100,90,0.30)',
                color: '#5A645A',
                colorScheme: 'light',
              }}
            >
              {DURATION_OPTIONS.map(m => (
                <option key={m} value={m}>{m} 分鐘</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingDuration(true)}
              className="text-[10px] font-semibold rounded-lg px-2 py-0.5 transition-colors"
              style={{
                color: '#8E8377',
                background: '#F8F5EE',
                border: '1px solid #E5E0D8',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(90,100,90,0.35)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E0D8')}
            >
              {stop.stay_duration} 分鐘 ▾
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

function TravelConnector({ minutes }: { minutes: number }) {
  const label = minutes >= 60
    ? `約 ${Math.floor(minutes / 60)} 小時${minutes % 60 ? ` ${minutes % 60} 分` : ''}`
    : `約 ${minutes} 分鐘`;
  return (
    <div className="flex items-center gap-2 ml-[58px] my-0.5">
      <div className="h-4 w-px rounded-full" style={{ background: '#E5E0D8' }} />
      <span className="text-[9px] font-mono" style={{ color: 'rgba(90,100,90,0.40)' }}>
        🚗 {label}
      </span>
    </div>
  );
}

function ExploreNearbyButton({ stopName, onClick }: { stopName: string; onClick: () => void }) {
  const display = stopName.length > 10 ? `${stopName.slice(0, 10)}…` : stopName;
  return (
    <div className="flex justify-center py-1.5">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-[10px] font-medium px-4 py-1.5 rounded-full transition-all duration-200"
        style={{ color: 'rgba(90,100,90,0.50)', border: '1px dashed rgba(90,100,90,0.25)', background: 'transparent' }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = '#5A645A';
          el.style.borderColor = 'rgba(90,100,90,0.50)';
          el.style.background = 'rgba(90,100,90,0.04)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = 'rgba(90,100,90,0.50)';
          el.style.borderColor = 'rgba(90,100,90,0.25)';
          el.style.background = 'transparent';
        }}
      >
        <Plus size={9} />
        探索 {display} 附近
      </button>
    </div>
  );
}

function AddDayButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex justify-center my-3">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="flex items-center gap-1.5 px-5 py-2 rounded-full text-[11px] font-semibold transition-all duration-200"
        style={{
          border: '1px dashed rgba(90,100,90,0.30)',
          color: '#8E8377',
          background: 'transparent',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(90,100,90,0.55)';
          el.style.color = '#5A645A';
          el.style.background = 'rgba(90,100,90,0.04)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(90,100,90,0.30)';
          el.style.color = '#8E8377';
          el.style.background = 'transparent';
        }}
      >
        <Plus size={11} />
        {label}
      </motion.button>
    </div>
  );
}

// ── Floating anchor nav ────────────────────────────────────────────────────

function NavPill({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-7 flex items-center justify-center rounded-lg text-[9px] font-bold transition-all duration-150"
      style={{
        background: 'rgba(253,251,246,0.95)',
        border: '1px solid rgba(90,100,90,0.18)',
        color: '#8E8377',
        boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = '#5A645A';
        el.style.borderColor = 'rgba(90,100,90,0.40)';
        el.style.background = 'rgba(253,251,246,0.99)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = '#8E8377';
        el.style.borderColor = 'rgba(90,100,90,0.18)';
        el.style.background = 'rgba(253,251,246,0.95)';
      }}
    >
      {label}
    </button>
  );
}

function FloatingAnchorNav({ days, scrollRef }: { days: BuilderDay[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="fixed right-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
      <NavPill label="🔝" title="頂部" onClick={scrollTop} />
      {days.map((day, i) => (
        <NavPill key={i} label={`D${day.day}`} title={`Day ${day.day}`} onClick={() => scrollTo(`day-section-${i}`)} />
      ))}
      <NavPill label="🚗" title="租車/住宿" onClick={() => scrollTo('affiliate-footer')} />
    </div>
  );
}

// ── DayTimeline ────────────────────────────────────────────────────────────

function DayTimeline({
  day, dayIdx, onRemove, onDurationChange, onExploreNearby, onDepartureTimeChange, onManualTimeChange,
}: {
  day: BuilderDay;
  dayIdx: number;
  onRemove: (idx: number) => void;
  onDurationChange: (stopIdx: number, mins: number) => void;
  onExploreNearby: (afterStopIdx: number, stop: CuratedStop) => void;
  onDepartureTimeChange: (time: string) => void;
  onManualTimeChange: (stopIdx: number, time: string | null) => void;
  // dayDate is read from day.date directly
}) {
  const { startTimes, driveMins } = useMemo(
    () => calcTimeline(day.stops, day.departureTime),
    [day.stops, day.departureTime],
  );

  return (
    <Droppable droppableId={`day-${dayIdx}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="flex flex-col rounded-xl transition-all duration-200"
          style={{
            minHeight: 56,
            ...(snapshot.isDraggingOver ? {
              background: 'rgba(90,100,90,0.03)',
              outline: '1px dashed rgba(90,100,90,0.20)',
              outlineOffset: 4,
            } : {}),
          }}
        >
          {day.stops.map((stop, idx) => (
            <div key={stop.id}>
              <Draggable draggableId={stop.id} index={idx}>
                {(drag, dragSnapshot) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    style={{
                      ...drag.draggableProps.style,
                      opacity: dragSnapshot.isDragging ? 0.9 : 1,
                      transform: dragSnapshot.isDragging
                        ? `${drag.draggableProps.style?.transform ?? ''} scale(1.015)`
                        : drag.draggableProps.style?.transform,
                      filter: dragSnapshot.isDragging ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.08))' : 'none',
                    }}
                  >
                    <StopCard
                      stop={stop}
                      time={startTimes[idx]}
                      dragHandleProps={drag.dragHandleProps}
                      onRemove={() => onRemove(idx)}
                      onDurationChange={mins => onDurationChange(idx, mins)}
                      isFirstStop={idx === 0}
                      onDepartureTimeChange={idx === 0 ? onDepartureTimeChange : undefined}
                      onManualTimeChange={idx !== 0 ? (t) => onManualTimeChange(idx, t) : undefined}
                      dayDate={day.date}
                    />
                  </div>
                )}
              </Draggable>

              <ExploreNearbyButton
                stopName={stop.name}
                onClick={() => onExploreNearby(idx, stop)}
              />

              {idx < day.stops.length - 1 && (
                <TravelConnector minutes={driveMins[idx]} />
              )}
            </div>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

function AffiliateFooter({ route }: { route: CuratedRoute | null }) {
  const af = route?.affiliate_links ?? {
    rental:        { label: '租車/租機車', url: null },
    accommodation: { label: '周邊住宿',   url: null },
  };
  return (
    <div id="affiliate-footer" className="mt-12 pt-6" style={{ borderTop: '1px solid #E5E0D8' }}>
      <p className="text-[9px] tracking-[0.45em] uppercase mb-4" style={{ color: '#8E8377' }}>
        出發前準備
      </p>
      <div className="grid grid-cols-2 gap-3">
        {([['🚗', af.rental], ['🏠', af.accommodation]] as const).map(([emoji, item]) => (
          <a
            key={item.label}
            href={item.url ?? '#'}
            onClick={item.url ? undefined : e => e.preventDefault()}
            className="flex items-center justify-center gap-3 p-4 rounded-xl transition-all duration-200"
            style={{ border: '1px solid #E5E0D8', background: '#F8F5EE' }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(90,100,90,0.35)'; el.style.background = 'white'; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#E5E0D8'; el.style.background = '#F8F5EE'; }}
          >
            <span className="text-xl">{emoji}</span>
            <span className="text-xs font-semibold" style={{ color: '#5A645A' }}>{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const router = useRouter();
  const { days: wizardDays, selectedRouteId, theme: wizardTheme } = useWizardStore();
  const { days, setDays, adventureName, setAdventureName, reset: resetBuilder } = useBuilderStore();
  const {
    setCurrentChallengeName, setActiveMapFilter, setBuilderDays, previewMeta, cancelPreview,
    tripStartDate, tripEndDate,
  } = useItineraryStore();
  const today = useMemo(() => getLocalYYYYMMDD(new Date()), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const importedRoute = useMemo(
    () => selectedRouteId ? (MOCK_CURATED_ROUTES.find(r => r.id === selectedRouteId) ?? null) : null,
    [selectedRouteId],
  );

  const [ferrySheet, setFerrySheet]     = useState<string | null>(null);
  const [showExport, setShowExport]     = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [committing, setCommitting]     = useState(false);
  const [targetDayIdx, setTargetDayIdx] = useState(0);
  const [targetAfterIdx, setTargetAfterIdx] = useState<number | null>(null);
  const [sheetContext, setSheetContext] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [sheetInitialQuery, setSheetInitialQuery] = useState<string | undefined>(undefined);
  // Reserved for future geo-filtering (pass day's approximate region center)
  const [sheetRegionHint, setSheetRegionHint] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [mapMode, setMapMode]           = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [shareToast, setShareToast]       = useState(false);

  // Compute all stops for map highlight (includes closed-days for per-marker warnings)
  const allMapStops = useMemo(() =>
    days.flatMap(day =>
      day.stops.map(s => ({
        id: s.id,
        lat: s.latitude,
        lng: s.longitude,
        name: s.name,
        closedDays: s.closed_days,
        assignedDate: day.date,
      }))
    ),
    [days],
  );

  useEffect(() => {
    const baseDate = tripStartDate || today;

    // Compute total days from user-selected trip date range (capped at 60)
    let totalTripDays: number | null = null;
    if (tripStartDate && tripEndDate) {
      const [sy, sm, sd] = tripStartDate.split('-').map(Number);
      const [ey, em, ed] = tripEndDate.split('-').map(Number);
      const n = Math.round(
        (new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000
      ) + 1;
      if (n > 0 && n <= 60) totalTripDays = n;
    }

    // Case 1: A curated route is selected — build from route then pad to trip length
    if (importedRoute) {
      const routeDays = routeToDays(importedRoute, baseDate);
      const target = Math.max(routeDays.length, totalTripDays ?? routeDays.length);
      const padded: BuilderDay[] = [...routeDays];
      while (padded.length < target) {
        const i = padded.length;
        padded.push({
          day: i + 1, label: `Day ${i + 1}`, has_island: false, stops: [],
          date: shiftDate(baseDate, i), departureTime: '09:00',
        });
      }
      setDays(padded);
      setAdventureName(importedRoute.title);
      return;
    }

    // Case 2: Builder store is empty — initialize from trip date range or wizard setting
    if (days.length === 0) {
      const count = totalTripDays ?? wizardDays ?? 3;
      setDays(emptyDays(count, baseDate));
      setAdventureName('自由規劃');
      return;
    }

    // Case 3: Builder already has days — pad up if trip range is longer (never shrink)
    if (totalTripDays !== null && totalTripDays > days.length) {
      const target = totalTripDays;
      setDays(prev => {
        const result = [...prev];
        while (result.length < target) {
          const i = result.length;
          result.push({
            day: i + 1, label: `Day ${i + 1}`, has_island: false, stops: [],
            date: shiftDate(baseDate, i), departureTime: '09:00',
          });
        }
        return result;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedRoute, wizardDays, today, tripStartDate, tripEndDate]);

  // ── Day management ────────────────────────────────────────────────────────

  function addDayAtStart() {
    const newDay: BuilderDay = { day: 1, label: 'Day 1', has_island: false, stops: [], date: today, departureTime: '09:00' };
    setDays(prev => renumberDays([newDay, ...prev], today));
  }

  function addDayAtEnd() {
    setDays(prev => {
      const newDay: BuilderDay = {
        day: prev.length + 1, label: `Day ${prev.length + 1}`,
        has_island: false, stops: [], date: shiftDate(today, prev.length), departureTime: '09:00',
      };
      return renumberDays([...prev, newDay], today);
    });
  }

  function removeDay(dayIdx: number) {
    const day = days[dayIdx];
    if (day.stops.length > 0 &&
      !window.confirm(`確定要刪除 ${day.label}？此天的 ${day.stops.length} 個景點也將一併移除。`)) return;
    setDays(prev => renumberDays(prev.filter((_, i) => i !== dayIdx), today));
  }

  function setDepartureTime(dayIdx: number, time: string) {
    setDays(prev => prev.map((day, i) => i !== dayIdx ? day : { ...day, departureTime: time }));
  }

  // ── Stop mutations ────────────────────────────────────────────────────────

  function reorderStop(dayIdx: number, from: number, to: number) {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIdx) return day;
      const stops = [...day.stops];
      const [moved] = stops.splice(from, 1);
      stops.splice(to, 0, moved);
      return { ...day, stops };
    }));
  }

  function moveCrossDay(srcDay: number, srcIdx: number, dstDay: number, dstIdx: number) {
    setDays(prev => {
      const next = prev.map(d => ({ ...d, stops: [...d.stops] }));
      const [moved] = next[srcDay].stops.splice(srcIdx, 1);
      next[dstDay].stops.splice(dstIdx, 0, moved);
      return next;
    });
  }

  function removeStop(dayIdx: number, stopIdx: number) {
    setDays(prev => prev.map((day, i) =>
      i !== dayIdx ? day : { ...day, stops: day.stops.filter((_, si) => si !== stopIdx) },
    ));
  }

  function updateStopDuration(dayIdx: number, stopIdx: number, mins: number) {
    setDays(prev => prev.map((day, i) =>
      i !== dayIdx ? day : {
        ...day,
        stops: day.stops.map((s, si) => si !== stopIdx ? s : { ...s, stay_duration: mins }),
      },
    ));
  }

  function updateStopManualTime(dayIdx: number, stopIdx: number, time: string | null) {
    setDays(prev => prev.map((day, i) =>
      i !== dayIdx ? day : {
        ...day,
        stops: day.stops.map((s, si) => si !== stopIdx ? s : { ...s, manual_start_time: time ?? undefined }),
      },
    ));
  }

  function handleExploreNearby(dayIdx: number, afterStopIdx: number, stop: CuratedStop) {
    setTargetDayIdx(dayIdx);
    setTargetAfterIdx(afterStopIdx);
    setSheetContext({ name: stop.name, lat: stop.latitude, lng: stop.longitude });
    setShowAddSheet(true);
  }

  function handleAddToDay(dayIdx: number) {
    setTargetDayIdx(dayIdx);
    setTargetAfterIdx(null);
    setSheetContext(null);
    setSheetInitialQuery(undefined);
    setSheetRegionHint(undefined);
    setShowAddSheet(true);
  }

  function handleCoffeeCTA(dayIdx: number) {
    setTargetDayIdx(dayIdx);
    setTargetAfterIdx(null);
    setSheetContext(null);
    setSheetInitialQuery('咖啡');
    // Future: derive region center from this day's stops or user location
    setSheetRegionHint(undefined);
    setShowAddSheet(true);
  }

  function addStopFromSheet(spot: SpotOption) {
    const newStop: CuratedStop = {
      id:            `sheet-${spot.id}-${Date.now()}`,
      name:          spot.name,
      category:      spot.category === 'hidden' ? 'attraction' : spot.category as CuratedStop['category'],
      latitude:      spot.latitude,
      longitude:     spot.longitude,
      stay_duration: spot.stay_duration || 60,
      tip:           spot.tip,
    };
    setDays(prev => prev.map((day, i) => {
      if (i !== targetDayIdx) return day;
      const stops = [...day.stops];
      if (targetAfterIdx === null) {
        stops.push(newStop);
      } else {
        stops.splice(targetAfterIdx + 1, 0, newStop);
      }
      return { ...day, stops };
    }));
    setShowAddSheet(false);
    setSheetContext(null);
    setTargetAfterIdx(null);
  }

  // ── DnD handler ───────────────────────────────────────────────────────────

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const srcDay = Number(source.droppableId.slice(4));
    const dstDay = Number(destination.droppableId.slice(4));
    if (srcDay === dstDay) {
      reorderStop(srcDay, source.index, destination.index);
    } else {
      moveCrossDay(srcDay, source.index, dstDay, destination.index);
    }
  }

  // ── Preview accept / abandon ──────────────────────────────────────────────

  async function handleCommitPreview() {
    if (!previewMeta || committing) return;
    // Destructure before state mutations — cancelPreview() will set previewMeta = null
    const { sourceId, adoptedCount, name } = previewMeta;
    setCommitting(true);
    setBuilderDays(days, today);
    setCurrentChallengeName(name);
    cancelPreview();
    resetBuilder();
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
    setActiveMapFilter('ALL');
    router.push('/');
  }

  function handleAbandonPreview() {
    cancelPreview();
    resetBuilder();
    router.back();
  }

  // ── Share itinerary ───────────────────────────────────────────────────────

  async function handleShareWithName(name: string): Promise<{ error?: string }> {
    // Duplicate name check
    const { data: existing } = await supabase
      .from('shared_itineraries')
      .select('adventure_name')
      .eq('adventure_name', name);

    if (existing && existing.length > 0) {
      return { error: '這趟冒險已經有人命名過了，換個更有創意的名字吧！' };
    }

    const stopsCount = days.reduce((sum, d) => sum + d.stops.length, 0);
    const { error } = await supabase.from('shared_itineraries').insert({
      adventure_name: name,
      days_count: days.length,
      stops_count: stopsCount,
      is_public: true,
      adopted_count: 0,
      theme: importedRoute?.theme ?? wizardTheme ?? null,
      days_data: days,
    });

    if (error) {
      console.error('[野台東][Share] 分享失敗：', error.message);
      return { error: '分享失敗，請稍後再試。' };
    }

    setShowNameModal(false);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3500);
    return {};
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 overflow-hidden">

      {/* ── Layer 0: Background map ── */}
      <div className="absolute inset-0 z-0">
        <BuilderMap events={[]} noFetch highlightedStops={allMapStops} />
      </div>

      {/* ── Layer 1: Scrollable content — parchment overlay ── */}
      <div
        ref={scrollRef}
        id="builder-scroll"
        className="absolute inset-0 z-10 overflow-y-auto"
        style={{
          background: 'rgba(253,251,246,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          scrollbarWidth: 'none',
          opacity: mapMode ? 0 : 1,
          pointerEvents: mapMode ? 'none' : 'auto',
          transition: 'opacity 0.45s ease',
        }}
      >
        <main className="relative max-w-2xl mx-auto px-4 pb-28">

          {/* ── Sticky header ── */}
          <div
            className="sticky top-0 z-10 mb-4"
            style={{
              background: 'rgba(253,251,246,0.96)',
              backdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(90,100,90,0.10)',
            }}
          >
            {/* Preview sub-banner — only shown when entering via UGC preview */}
            {previewMeta && (
              <div
                className="flex items-center justify-between gap-3 px-5 py-2.5"
                style={{ borderBottom: '1px solid rgba(228,92,28,0.15)' }}
              >
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#e45c1c' }}>
                    👀 預覽模式
                  </span>
                  <p className="truncate text-xs font-bold text-gray-900">{previewMeta.name}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={handleAbandonPreview}
                    className="rounded-lg border px-3 py-1.5 text-[11px] font-bold"
                    style={{ border: '1px solid #E5E0D8', color: '#8E8377' }}
                  >
                    ❌ 放棄
                  </button>
                  <motion.button
                    onClick={handleCommitPreview}
                    disabled={committing}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #e45c1c 0%, #f97316 100%)' }}
                  >
                    {committing ? '…' : '🔥 接受挑戰！'}
                  </motion.button>
                </div>
              </div>
            )}

            {/* Main nav row */}
            <div className="flex items-center justify-between py-5 px-0">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm transition-colors duration-200 group"
              style={{ color: '#8E8377' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#5A645A')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#8E8377')}
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
              返回
            </button>

            <input
              value={adventureName}
              onChange={e => setAdventureName(e.target.value)}
              className="font-serif text-sm text-center bg-transparent outline-none border-b truncate max-w-[160px] pb-0.5 transition-colors"
              style={{ color: '#5A645A', borderColor: 'transparent', caretColor: '#5A645A' }}
              onFocus={e => ((e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(90,100,90,0.40)')}
              onBlur={e  => ((e.currentTarget as HTMLInputElement).style.borderColor = 'transparent')}
            />

            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 text-xs transition-colors duration-200"
              style={{ color: '#8E8377' }}
              title="匯出 IG 卡片"
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#D7AF70')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#8E8377')}
            >
              <ImageDown size={15} />
              限動
            </button>
            </div>
          </div>

          {/* ── Cross-day drag hint ── */}
          <p className="text-[9px] text-center mb-5 tracking-widest uppercase" style={{ color: 'rgba(90,100,90,0.30)' }}>
            ↕ 長按景點可跨天拖曳排序
          </p>

          {/* ── Add Day at Start ── */}
          <AddDayButton label="在最前面新增一天" onClick={addDayAtStart} />

          {/* ── Waterfall DnD ── */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col">
              {days.map((day, i) => {
                const islandTrigger =
                  day.has_island && day.island_name ? day.island_name
                  : day.stops.some(s => /綠島/.test(s.name)) ? '綠島'
                  : day.stops.some(s => /蘭嶼/.test(s.name)) ? '蘭嶼'
                  : null;

                return (
                  <section key={day.date} id={`day-section-${i}`}>
                    {/* Sticky day header */}
                    <div
                      className="sticky flex items-center justify-between py-3 mb-4 -mx-1 px-1"
                      style={{
                        top: 72,
                        zIndex: 8,
                        background: 'rgba(253,251,246,0.97)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        borderBottom: '1px solid rgba(90,100,90,0.10)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div>
                          <span className="font-serif text-xs font-bold" style={{ color: '#1c1917' }}>Day {day.day}</span>
                          <span className="ml-2 text-[10px] font-medium" style={{ color: '#78716c' }}>
                            {day.date.slice(5).replace('-', '/')}
                          </span>
                        </div>
                        {day.stops.length > 0 && (
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(90,100,90,0.08)', color: '#5A645A' }}
                          >
                            {day.stops.length} 站
                          </span>
                        )}
                        {islandTrigger && (
                          <span className="flex items-center gap-1 text-[9px]" style={{ color: '#5bb8d4' }}>
                            <Ship size={9} /> 離島
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => removeDay(i)}
                        className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full transition-all duration-200"
                        style={{ color: '#78716c', border: '1px solid transparent' }}
                        onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#dc2626'; el.style.borderColor = 'rgba(220,38,38,0.20)'; el.style.background = 'rgba(220,38,38,0.05)'; }}
                        onMouseLeave={e => { const el = e.currentTarget; el.style.color = '#78716c'; el.style.borderColor = 'transparent'; el.style.background = 'transparent'; }}
                        title={`刪除 Day ${day.day}`}
                      >
                        <X size={11} />
                        刪除此天
                      </button>
                    </div>

                    {islandTrigger && (
                      <IslandBanner
                        name={islandTrigger}
                        onOpen={() => setFerrySheet(islandTrigger)}
                        ferryUrl={importedRoute?.affiliate_links?.ferry?.url}
                      />
                    )}

                    <DayTimeline
                      day={day}
                      dayIdx={i}
                      onRemove={idx => removeStop(i, idx)}
                      onDurationChange={(idx, mins) => updateStopDuration(i, idx, mins)}
                      onExploreNearby={(afterIdx, stop) => handleExploreNearby(i, afterIdx, stop)}
                      onDepartureTimeChange={t => setDepartureTime(i, t)}
                      onManualTimeChange={(idx, t) => updateStopManualTime(i, idx, t)}
                    />

                    {day.stops.length === 0 && (
                      <div
                        className="mt-3 py-8 flex flex-col items-center gap-3 rounded-xl"
                        style={{ border: '1px dashed rgba(90,100,90,0.20)', background: 'rgba(248,245,238,0.50)' }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <p className="text-sm" style={{ color: 'rgba(90,100,90,0.40)' }}>今日尚無行程</p>
                          <p className="text-[10px]" style={{ color: 'rgba(90,100,90,0.28)' }}>
                            點下方按鈕新增，或從其他天拖曳景點至此
                          </p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCoffeeCTA(i)}
                          className="flex items-center gap-2 px-6 py-2 rounded-full text-xs font-semibold transition-all duration-200"
                          style={{
                            background: 'white',
                            border: '1px solid rgba(196,149,106,0.30)',
                            color: '#C4956A',
                            boxShadow: '0 2px 8px rgba(196,149,106,0.10)',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLButtonElement;
                            el.style.background = '#FDF9F5';
                            el.style.borderColor = 'rgba(196,149,106,0.55)';
                            el.style.boxShadow = '0 4px 14px rgba(196,149,106,0.16)';
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLButtonElement;
                            el.style.background = 'white';
                            el.style.borderColor = 'rgba(196,149,106,0.30)';
                            el.style.boxShadow = '0 2px 8px rgba(196,149,106,0.10)';
                          }}
                        >
                          <Coffee size={12} />
                          來喝杯咖啡？
                        </motion.button>
                      </div>
                    )}

                    <div className="mt-4 flex justify-center">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAddToDay(i)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group"
                        style={{ border: '1px dashed rgba(90,100,90,0.30)', color: '#5A645A', background: 'transparent' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(90,100,90,0.05)'; el.style.borderColor = 'rgba(90,100,90,0.50)'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.borderColor = 'rgba(90,100,90,0.30)'; }}
                      >
                        <Plus size={12} className="group-hover:rotate-90 transition-transform duration-200" />
                        新增景點至 Day {day.day}
                      </motion.button>
                    </div>

                    {i < days.length - 1 && (
                      <div className="mt-10 mb-2 flex items-center gap-3">
                        <div className="flex-1 h-px" style={{ background: 'rgba(90,100,90,0.12)' }} />
                        <span className="text-[9px] tracking-[0.35em]" style={{ color: 'rgba(90,100,90,0.30)' }}>
                          DAY {day.day + 1}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(90,100,90,0.12)' }} />
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </DragDropContext>

          {/* ── Add Day at End ── */}
          <AddDayButton label="在最後新增一天" onClick={addDayAtEnd} />

          <AffiliateFooter route={importedRoute} />

          {/* ── Complete Planning (dual CTA) ── */}
          <div className="mt-6 mb-4 flex flex-col gap-3">
            {/* Primary: see my map */}
            <motion.button
              onClick={() => setMapMode(true)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #D7AF70 0%, #E5C992 50%, #D7AF70 100%)',
                boxShadow: '0 4px 24px rgba(215,175,112,0.35)',
                letterSpacing: '0.04em',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 6px 32px rgba(215,175,112,0.50)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 4px 24px rgba(215,175,112,0.35)';
              }}
            >
              ✨ 完成規劃，看我的版圖
            </motion.button>

            {/* Secondary: share with community */}
            <motion.button
              onClick={() => setShowNameModal(true)}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-colors"
              style={{
                background: 'white',
                border: '1px solid #D4A373',
                color: '#D4A373',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#FFF8F1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'white';
              }}
            >
              📢 完成規劃，向其他冒險者分享旅程，讓他們挑戰
            </motion.button>
          </div>

          {/* ── Brand Footer ── */}
          <div className="flex justify-center items-center w-full gap-2 text-xs text-gray-400 mt-8 pb-4">
            <span>© One Circle Studio (一圈工作室)</span>
            <span>·</span>
            <a
              href="mailto:mark42studio@gmail.com"
              className="transition-colors hover:text-gray-600"
            >
              ✉ mark42studio@gmail.com
            </a>
          </div>

        </main>
      </div>

      {/* ── Floating anchor nav (≥3 days, hidden in map mode) ── */}
      {days.length >= 3 && !mapMode && (
        <FloatingAnchorNav days={days} scrollRef={scrollRef} />
      )}

      {/* ── Map mode: re-open builder FAB ── */}
      <AnimatePresence>
        {mapMode && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={() => {
              setBuilderDays(days, today);
              setCurrentChallengeName(adventureName || '自由規劃');
              setActiveMapFilter('ALL');
              router.push('/');
            }}
            className="fixed bottom-8 left-1/2 z-[50] -translate-x-1/2 flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #005FB8 0%, #1a7fd4 100%)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 6px 28px rgba(0,95,184,0.45)',
            }}
          >
            🚀 開始遊程
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Overlays ── */}
      <AnimatePresence>
        {showAddSheet && (
          <AddStopSheet
            key="add-stop"
            dayLabel={days[targetDayIdx]?.label ?? `Day ${targetDayIdx + 1}`}
            context={sheetContext}
            initialQuery={sheetInitialQuery}
            initialCategory={sheetInitialQuery ? 'food' : undefined}
            regionHint={sheetRegionHint}
            onAdd={addStopFromSheet}
            onClose={() => {
              setShowAddSheet(false);
              setSheetContext(null);
              setTargetAfterIdx(null);
              setSheetInitialQuery(undefined);
              setSheetRegionHint(undefined);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ferrySheet && (
          <FerrySheet key="ferry" islandName={ferrySheet} onClose={() => setFerrySheet(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExport && (
          <ExportModal
            key="export"
            title={adventureName || '台東冒險'}
            theme={(importedRoute?.theme ?? wizardTheme ?? 'ocean') as AdventureTheme}
            days={days}
            rating={importedRoute?.rating}
            completionCount={importedRoute?.completion_count}
            highlights={importedRoute?.highlights}
            onClose={() => setShowExport(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNameModal && (
          <AdventureNameModal
            key="adventure-name"
            defaultName={adventureName || ''}
            onConfirm={handleShareWithName}
            onClose={() => setShowNameModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Share success toast */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            key="share-toast"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-semibold text-white whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #5A645A 0%, #3D4A3D 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            }}
          >
            🎖️ 冒險印記已存入，感謝你的分享！
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
