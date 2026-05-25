'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BedDouble, Eye, Loader2, MapPin, Plus, Search, Star, Utensils, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SpotOption } from '@/lib/mock/addStopData';

// ── Helpers ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── DB → SpotOption mapping ────────────────────────────────────────────────

interface DbPlace {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  category: string | null;
  wild_tags: string[] | null;
  quote: string | null;
  description: string | null;
  popularity: number | null;
  affiliate_link: string | null;
}

// 內部型別：SpotOption + affiliate_link（僅供卡片顯示用）
type SpotWithLink = SpotOption & { affiliate_link?: string | null };

// 地名關鍵字：三軌並聯地區判定（與 ExploreSheet 的 AREA_DB_MAP 保持一致）
const EAST_KWS   = ['三仙台', '加路蘭', '東河', '成功', '長濱', '石梯坪', '都蘭', '富岡', '石雨傘'];
const VALLEY_KWS = ['鹿野', '初鹿', '延平', '關山', '池上', '海端', '布農', '鸞山', '錦屏', '縱谷', '利嘉', '紅葉'];
const SOUTH_KWS  = ['大武', '達仁', '金峰', '太麻里', '多良', '南迴', '土坂'];
const ISLAND_KWS = ['綠島', '蘭嶼'];

function mapDbRegion(cat: string | null, wildTags: string[], name: string): SpotOption['region'] {
  // 軌道 1：wild_tags 中文標籤
  if (wildTags.includes('東海岸')) return '東海岸';
  if (wildTags.includes('縱谷線')) return '縱谷';
  if (wildTags.includes('南迴線')) return '南迴';
  if (wildTags.includes('離島'))   return '離島';
  // 軌道 2：category 英文代碼
  if (cat === 'sea' || cat === 'ocean')                                          return '東海岸';
  if (cat === 'islands')                                                          return '離島';
  if (cat === 'mtn' || cat === 'valley' || cat === 'mountain' || cat === 'rail') return '縱谷';
  if (cat === 'south')                                                            return '南迴';
  // 軌道 3：地名關鍵字兜底
  if (ISLAND_KWS.some(k => name.includes(k))) return '離島';
  if (EAST_KWS.some(k => name.includes(k)))   return '東海岸';
  if (VALLEY_KWS.some(k => name.includes(k))) return '縱谷';
  if (SOUTH_KWS.some(k => name.includes(k)))  return '南迴';
  return '台東市';
}

function mapDbCategory(cat: string | null): SpotOption['category'] {
  if (cat === 'food' || cat === 'restaurant') return 'food';
  if (cat === 'accommodation')                return 'accommodation';
  if (cat === 'hidden' || cat === 'spring')   return 'hidden';
  return 'attraction';
}

function dbToSpot(row: DbPlace): SpotWithLink {
  const wildTags = Array.isArray(row.wild_tags) ? (row.wild_tags as string[]) : [];
  return {
    id:            row.id,
    name:          row.name ?? '',
    category:      mapDbCategory(row.category),
    latitude:      row.lat ?? 22.7583,
    longitude:     row.lng ?? 121.1443,
    stay_duration: 90,
    rating:        4.5,
    rating_count:  row.popularity ?? 0,
    tip:           row.quote ?? row.description ?? undefined,
    region:        mapDbRegion(row.category, wildTags, row.name ?? ''),
    vibes:         wildTags.filter(t =>
      ['親子共遊', '戶外冒險', '網美打卡', '歷史文化', '雨天備案', '夜生活'].includes(t)
    ),
    affiliate_link: typeof row.affiliate_link === 'string' && row.affiliate_link
      ? row.affiliate_link
      : null,
  };
}

// ── DB 查詢 ────────────────────────────────────────────────────────────────

const SELECT_COLS =
  'id, name, lat, lng, category, wild_tags, quote, description, popularity, affiliate_link';

// 依地區 Pill 組成 Supabase or() 條件字串（與 ExploreSheet 三軌邏輯相同）
const REGION_FILTER_MAP: Record<SpotOption['region'], { wildTag: string; cats: string[]; nameKws: string[] }> = {
  '台東市': { wildTag: '台東市',  cats: ['city', 'urban'],                                      nameKws: [] },
  '東海岸': { wildTag: '東海岸',  cats: ['sea', 'ocean'],                                       nameKws: EAST_KWS },
  '縱谷':   { wildTag: '縱谷線',  cats: ['mtn', 'valley', 'mountain', 'rail'],                  nameKws: VALLEY_KWS },
  '南迴':   { wildTag: '南迴線',  cats: ['south'],                                               nameKws: SOUTH_KWS },
  '離島':   { wildTag: '離島',    cats: ['islands'],                                             nameKws: ISLAND_KWS },
};

async function fetchPlaces(opts: {
  keyword: string;
  regions: SpotOption['region'][];
  categories: SpotOption['category'][];
  limit: number;
}): Promise<SpotWithLink[]> {
  const { keyword, regions, categories, limit } = opts;

  let req = supabase
    .from('places')
    .select(SELECT_COLS)
    .order('popularity', { ascending: false })
    .limit(limit);

  // ── 地區過濾（伺服器端三軌並聯，與 ExploreSheet 一致）──────────────────
  if (regions.length > 0) {
    const conditions: string[] = [];
    for (const r of regions) {
      const cfg = REGION_FILTER_MAP[r];
      if (!cfg) continue;
      conditions.push(`wild_tags.cs.{${cfg.wildTag}}`);
      cfg.cats.forEach(c => conditions.push(`category.eq.${c}`));
      cfg.nameKws.forEach(k => conditions.push(`name.ilike.%${k}%`));
    }
    if (conditions.length) req = req.or(conditions.join(','));
  }

  // ── 關鍵字搜尋（伺服器端，與 ExploreSheet 完全相同）──────────────────
  if (keyword.trim()) {
    const kw = keyword.trim().replace(/[%_\\]/g, c => `\\${c}`);
    req = req.or(`name.ilike.%${kw}%,quote.ilike.%${kw}%,description.ilike.%${kw}%`);
  }

  // ── DB category 過濾 ──────────────────────────────────────────────────
  if (categories.length > 0) {
    const dbCats: string[] = [];
    categories.forEach(c => {
      if (c === 'food')          dbCats.push('food', 'restaurant');
      if (c === 'accommodation') dbCats.push('accommodation');
      if (c === 'hidden')        dbCats.push('hidden', 'spring');
      if (c === 'attraction')    dbCats.push('attraction', 'sea', 'ocean', 'mtn', 'valley', 'mountain', 'rail', 'south', 'city');
    });
    if (dbCats.length > 0) {
      req = req.in('category', dbCats);
    }
  }

  const { data, error } = await req;

  if (error) {
    console.error('[AddStopSheet] fetchPlaces 失敗:', error.message);
    return [];
  }

  return (data ?? []).map(row => dbToSpot(row as unknown as DbPlace));
}

// ── Config ─────────────────────────────────────────────────────────────────

const REGION_CHIPS: { label: string; value: SpotOption['region'] }[] = [
  { label: '台東市區', value: '台東市' },
  { label: '東海岸',   value: '東海岸' },
  { label: '縱谷線',   value: '縱谷'   },
  { label: '南迴線',   value: '南迴'   },
  { label: '離島',     value: '離島'   },
];

const CATEGORY_CHIPS: { label: string; value: SpotOption['category'] }[] = [
  { label: '美食', value: 'food'          },
  { label: '景點', value: 'attraction'    },
  { label: '秘境', value: 'hidden'        },
  { label: '住宿', value: 'accommodation' },
];

const VIBE_CHIPS: { label: string; value: string }[] = [
  { label: '親子共遊', value: '親子共遊' },
  { label: '戶外冒險', value: '戶外冒險' },
  { label: '網美打卡', value: '網美打卡' },
  { label: '歷史文化', value: '歷史文化' },
  { label: '雨天備案', value: '雨天備案' },
  { label: '夜生活',   value: '夜生活'   },
];

const ACCENT: Record<SpotOption['category'], string> = {
  food:          '#C4956A',
  attraction:    '#5A645A',
  hidden:        '#8E8377',
  accommodation: '#9B7EC8',
};

const CAT_LABEL: Record<SpotOption['category'], string> = {
  food:          '美食',
  attraction:    '景點',
  hidden:        '秘境',
  accommodation: '住宿',
};

function CategoryIcon({ cat, size = 13 }: { cat: SpotOption['category']; size?: number }) {
  const color = ACCENT[cat];
  if (cat === 'food')          return <Utensils  size={size} style={{ color }} />;
  if (cat === 'accommodation') return <BedDouble  size={size} style={{ color }} />;
  if (cat === 'hidden')        return <Eye        size={size} style={{ color }} />;
  return                              <MapPin     size={size} style={{ color }} />;
}

// ── FilterRow ──────────────────────────────────────────────────────────────

const CHIP_ACTIVE = {
  background: '#5A645A',
  color: 'white',
  border: '1px solid #5A645A',
  boxShadow: '0 2px 8px rgba(90,100,90,0.20)',
} as const;

const CHIP_INACTIVE = {
  background: 'white',
  color: '#8E8377',
  border: '1px solid #E5E0D8',
} as const;

function FilterRow<T extends string>({
  rowLabel,
  chips,
  selected,
  onToggle,
}: {
  rowLabel: string;
  chips: { label: string; value: T }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 min-h-[26px]">
      <span
        className="shrink-0 text-[9px] w-[36px] text-right leading-tight"
        style={{ color: '#8E8377' }}
      >
        {rowLabel}
      </span>
      <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {chips.map(chip => {
          const active = selected.includes(chip.value);
          return (
            <button
              key={chip.value}
              onClick={() => onToggle(chip.value)}
              className="shrink-0 rounded-full px-3 py-0.5 text-[10px] font-semibold transition-all duration-150"
              style={active ? CHIP_ACTIVE : CHIP_INACTIVE}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface GooglePlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  dayLabel: string;
  context?: { name: string; lat: number; lng: number } | null;
  initialQuery?: string;
  initialCategory?: SpotOption['category'];
  regionHint?: { lat: number; lng: number };
  onAdd: (spot: SpotOption) => void;
  onClose: () => void;
}

export function AddStopSheet({ dayLabel, context, initialQuery, initialCategory, onAdd, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '');

  const [selectedRegions,    setSelectedRegions]    = useState<SpotOption['region'][]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SpotOption['category'][]>(
    initialCategory ? [initialCategory] : [],
  );
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  // ── Debounced keyword（300ms，與 ExploreSheet 保持一致）────────────────
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // ── Supabase 資料：keyword/region/category 任一變動都重新查詢 ────────────
  const [spots,   setSpots]   = useState<SpotWithLink[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchSeq = useRef(0);   // 用來丟棄 stale 回應

  useEffect(() => {
    const seq = ++fetchSeq.current;
    setLoading(true);

    fetchPlaces({
      keyword:    debouncedQuery,
      regions:    selectedRegions,
      categories: selectedCategories,
      limit:      300,
    }).then(results => {
      if (fetchSeq.current !== seq) return;   // stale，丟棄
      setSpots(results);
      setLoading(false);
    });
  }, [debouncedQuery, selectedRegions, selectedCategories]);

  // ── Google Places fallback ──────────────────────────────────────────────
  const [googleQuery,      setGoogleQuery]      = useState('');
  const [googleResults,    setGoogleResults]    = useState<GooglePlaceResult[]>([]);
  const [googleLoading,    setGoogleLoading]    = useState(false);
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) {
    setter(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  }

  function clearAllFilters() {
    setSelectedRegions([]);
    setSelectedCategories([]);
    setSelectedVibes([]);
  }

  const activeFilterCount = selectedRegions.length + selectedCategories.length + selectedVibes.length;

  async function handleGoogleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!googleQuery.trim()) return;
    setGoogleLoading(true);
    setGoogleResults([]);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: googleQuery }),
      });
      const data = await res.json();
      if (data.places) {
        setGoogleResults(
          (data.places as any[]).map((p: any, idx: number) => ({
            id: `google-${idx}-${Date.now()}`,
            name: p.displayName?.text ?? googleQuery,
            address: p.formattedAddress ?? '',
            lat: p.location?.latitude ?? 22.75,
            lng: p.location?.longitude ?? 121.15,
          }))
        );
      }
    } catch {
      /* silent */
    } finally {
      setGoogleLoading(false);
    }
  }

  function addGooglePlace(place: GooglePlaceResult) {
    onAdd({
      id:            place.id,
      name:          place.name,
      category:      'attraction',
      region:        '台東市',
      latitude:      place.lat,
      longitude:     place.lng,
      stay_duration: 60,
      rating:        4.0,
      rating_count:  0,
      tip:           place.address || undefined,
    });
  }

  // ── vibe 過濾（純 client-side，DB 無 vibe 欄位可查）──────────────────────
  const list = useMemo<SpotWithLink[]>(() => {
    let base = spots;

    if (selectedVibes.length > 0) {
      base = base.filter(s => s.vibes && s.vibes.some(v => selectedVibes.includes(v)));
    }

    if (context) {
      return [...base].sort((a, b) => {
        const distA = haversineKm(context.lat, context.lng, a.latitude, a.longitude);
        const distB = haversineKm(context.lat, context.lng, b.latitude, b.longitude);
        return (distA * 2 - (a.rating - 3) * 10) - (distB * 2 - (b.rating - 3) * 10);
      });
    }
    return base; // 伺服器已按 popularity 排序
  }, [spots, selectedVibes, context]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(90,100,90,0.25)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 310, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex flex-col overflow-hidden"
        style={{
          maxWidth: 680,
          maxHeight: '90dvh',
          borderRadius: '24px 24px 0 0',
          background: '#FDFBF6',
          border: '1px solid rgba(90,100,90,0.12)',
          borderBottom: 'none',
          boxShadow: '0 -16px 64px rgba(0,0,0,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3.5 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(90,100,90,0.20)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 shrink-0">
          <div>
            <p className="text-[15px] font-bold font-serif" style={{ color: '#5A645A' }}>
              {context ? `探索 ${context.name} 周邊` : '新增景點'}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#8E8377' }}>
              加入 {dayLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ background: 'rgba(90,100,90,0.06)', color: '#8E8377' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(90,100,90,0.12)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(90,100,90,0.06)')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 pb-3 shrink-0">
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
            style={{ background: 'white', border: '1px solid #E5E0D8' }}
          >
            <Search size={13} style={{ color: '#8E8377', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜尋景點名稱，如：布農、初鹿、三仙台…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[#A09488]/60"
              style={{ color: '#5A645A', caretColor: '#5A645A' }}
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  onClick={() => setQuery('')}
                  style={{ color: '#8E8377' }}
                >
                  <X size={11} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Filter rows */}
        <div
          className="px-5 pb-3 shrink-0 flex flex-col gap-2"
          style={{ borderBottom: '1px solid #E5E0D8' }}
        >
          <FilterRow
            rowLabel="📍 地區"
            chips={REGION_CHIPS}
            selected={selectedRegions}
            onToggle={v => toggle(setSelectedRegions, v)}
          />
          <FilterRow
            rowLabel="📌 類型"
            chips={CATEGORY_CHIPS}
            selected={selectedCategories}
            onToggle={v => toggle(setSelectedCategories, v)}
          />
          <FilterRow
            rowLabel="✨ 體驗"
            chips={VIBE_CHIPS}
            selected={selectedVibes}
            onToggle={v => toggle(setSelectedVibes, v)}
          />
        </div>

        {/* Result count + clear */}
        <div className="px-5 py-2 shrink-0 flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: '#A09488' }}>
            {loading
              ? '搜尋中…'
              : `${list.length} 個結果 · ${context ? '附近推薦 · 依距離排序' : '依熱度排序'}`}
          </p>
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(90,100,90,0.06)',
                  color: '#8E8377',
                  border: '1px solid rgba(90,100,90,0.15)',
                }}
              >
                <X size={8} />
                清除 {activeFilterCount} 項篩選
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-10" style={{ scrollbarWidth: 'none' }}>
          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 w-full rounded-xl animate-pulse"
                  style={{ background: '#F0EDE8' }}
                />
              ))}
            </div>
          )}

          {!loading && list.length === 0 && (
            <div className="py-14 flex flex-col items-center gap-3">
              <div className="text-3xl opacity-60">🔍</div>
              <p className="text-sm font-medium" style={{ color: '#8E8377' }}>
                找不到符合條件的景點
              </p>
              <p className="text-[11px] text-center" style={{ color: '#A09488' }}>
                {query ? `找不到「${query}」，試試其他關鍵字` : '試試減少篩選標籤'}
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="mt-1 px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: 'rgba(90,100,90,0.06)',
                    color: '#5A645A',
                    border: '1px solid rgba(90,100,90,0.15)',
                  }}
                >
                  清除所有篩選
                </button>
              )}
            </div>
          )}

          {!loading && list.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {list.map(spot => (
                <SpotRow
                  key={spot.id}
                  spot={spot}
                  distKm={context ? haversineKm(context.lat, context.lng, spot.latitude, spot.longitude) : undefined}
                  prevStopName={context?.name}
                  onAdd={onAdd}
                />
              ))}
            </div>
          )}

          {/* Google Places fallback */}
          {!loading && !showGoogleSearch && (
            <button
              onClick={() => setShowGoogleSearch(true)}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all"
              style={{
                border: '1px dashed rgba(90,100,90,0.25)',
                color: '#8E8377',
                background: 'transparent',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = 'rgba(90,100,90,0.50)';
                el.style.color = '#5A645A';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = 'rgba(90,100,90,0.25)';
                el.style.color = '#8E8377';
              }}
            >
              <Search size={11} />
              找不到地點？使用 Google 地圖搜尋並加入
            </button>
          )}

          {showGoogleSearch && (
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-[9px] tracking-[0.45em] uppercase" style={{ color: '#A09488' }}>
                Google 地圖搜尋
              </p>
              <form onSubmit={handleGoogleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={googleQuery}
                  onChange={e => setGoogleQuery(e.target.value)}
                  placeholder="搜尋全台灣任何地點…"
                  autoFocus
                  className="flex-1 rounded-xl px-4 py-2.5 text-xs outline-none"
                  style={{ background: 'white', border: '1px solid #E5E0D8', color: '#5A645A', caretColor: '#5A645A' }}
                />
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background: '#5A645A', color: 'white', border: '1px solid #5A645A' }}
                >
                  {googleLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  搜尋
                </button>
              </form>

              {googleResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {googleResults.map(place => (
                    <div
                      key={place.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'white', border: '1px solid #E5E0D8' }}
                    >
                      <div
                        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: 'rgba(90,100,90,0.06)' }}
                      >
                        <MapPin size={13} style={{ color: '#5A645A' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#5A645A' }}>
                          {place.name}
                        </p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: '#8E8377' }}>
                          {place.address}
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => addGooglePlace(place)}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold"
                        style={{ background: '#5A645A', color: 'white', border: '1px solid #5A645A' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#4A5449'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#5A645A'; }}
                      >
                        <Plus size={10} />加入
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── SpotRow ────────────────────────────────────────────────────────────────

function SpotRow({
  spot,
  distKm,
  prevStopName,
  onAdd,
}: {
  spot: SpotWithLink;
  distKm?: number;
  prevStopName?: string;
  onAdd: (s: SpotOption) => void;
}) {
  const [added, setAdded] = useState(false);

  function handleAdd() {
    setAdded(true);
    const { affiliate_link: _af, ...spotOption } = spot;
    onAdd(spotOption);
  }

  return (
    <motion.div
      layout
      className="flex items-center gap-3 p-3.5 rounded-xl"
      style={{
        background: 'white',
        border: '1px solid #E5E0D8',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
      }}
    >
      {/* Icon */}
      <div
        className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: '#F8F5EE' }}
      >
        <CategoryIcon cat={spot.category} size={15} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color: '#5A645A' }}>
            {spot.name}
          </p>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
            style={{
              background: `${ACCENT[spot.category]}18`,
              color: ACCENT[spot.category],
              border: `1px solid ${ACCENT[spot.category]}35`,
            }}
          >
            {CAT_LABEL[spot.category]}
          </span>
          {/* Klook 訂票徽章 */}
          {spot.affiliate_link && (
            <a
              href={spot.affiliate_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold text-white"
              style={{ background: 'rgba(245,158,11,0.85)' }}
            >
              🎫 訂票
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Star size={9} style={{ color: '#D7AF70', fill: '#D7AF70', flexShrink: 0 }} />
          <span className="text-[10px] font-bold" style={{ color: '#5A645A' }}>
            {spot.rating}
          </span>
          <span className="text-[9px]" style={{ color: '#A09488' }}>
            ({spot.rating_count.toLocaleString()})
          </span>
          <span style={{ color: '#C8C0B8' }} className="text-[9px]">·</span>
          <span className="text-[10px]" style={{ color: '#8E8377' }}>
            {spot.region}
          </span>
        </div>

        {distKm !== undefined && prevStopName && (
          <p className="text-[10px] mt-0.5" style={{ color: '#5A645A' }}>
            📍 距離 {prevStopName} 約 {distKm.toFixed(1)} 公里（車程 {Math.max(1, Math.round(distKm / 0.65))} 分鐘）
          </p>
        )}

        {spot.tip && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: '#8E8377' }}>
            {spot.tip}
          </p>
        )}
      </div>

      {/* Add button */}
      <motion.button
        onClick={handleAdd}
        disabled={added}
        whileTap={{ scale: 0.92 }}
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
        style={added ? {
          background: 'rgba(90,100,90,0.08)',
          color: '#8E8377',
          border: '1px solid rgba(90,100,90,0.15)',
        } : {
          background: '#5A645A',
          color: 'white',
          border: '1px solid #5A645A',
        }}
        onMouseEnter={e => { if (!added) (e.currentTarget as HTMLElement).style.background = '#4A5449'; }}
        onMouseLeave={e => { if (!added) (e.currentTarget as HTMLElement).style.background = '#5A645A'; }}
      >
        {added ? '✓' : <><Plus size={10} />加入</>}
      </motion.button>
    </motion.div>
  );
}
