/**
 * 全域型別定義 — 野台東 Wild Taitung 唯一型別來源
 * 所有元件、Store、頁面請從這裡引入，不要在各自檔案內重複定義。
 */

/** 分潤連結結構（CLAUDE.md 規定必須保留） */
export interface AffiliateLinks {
  rental:        { label: string; url: string | null };
  ticket:        { label: string; url: string | null };
  accommodation: { label: string; url: string | null };
}

/** 來自 Supabase events 表的活動資料 */
export interface Event {
  id: string;
  title: string;
  description: string;
  long_description?: string;
  safety_notes?: string;
  start_time: string;       // ISO 8601
  end_time?: string;        // ISO 8601
  end_date?: string;        // YYYY-MM-DD，跨日展覽/活動的最後日期
  opening_hours?: string;   // 例："09:00–17:00"
  closing_days?: string[];  // 例：["Monday"] 或 ["週一", "週二"]
  closed_days?: number[];   // 例：[1, 2] 代表週一、週二公休（0=Sunday…6=Saturday）
  venue_name: string;
  address?: string;         // 完整地址（比 venue_name 更精確）
  latitude?: number;
  longitude?: number;
  category?: 'mtn' | 'city' | 'sea' | 'rail' | 'islands';
  source?: 'food' | 'spot';
  place_type?: string;
  vibe_tags: string[];
  target_audience?: string[];
  weather_resilience: number; // 1–5
  is_free: boolean;
  image_captured?: string;
  /** @deprecated 舊資料結構，請改用頂層 image_captured */
  engagement_metrics?: { image_captured: string };
  ticket_url?: string;
  source_url?: string;
  affiliate_links?: AffiliateLinks;
  /** 建議裝備清單，由後台填入後顯示蝦皮/KKday 分潤連結 */
  gear_items?: Array<{ label: string; url: string | null; desc?: string }>;
}

/** 來自 Supabase places 表的景點資料 */
export interface Place {
  id: string;
  created_at?: string;
  name: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
  category?: 'mtn' | 'city' | 'sea' | 'rail' | 'islands' | string | null;
  opening_hours?: string | null;
  opening_hours_text?: string | null;
  closed_days?: number[] | null;
  source_url?: string | null;
  wild_tags?: string[] | null;
  safety_notes?: string | null;
  /** 手札短評，顯示在秘境景點卡片上 */
  quote?: string | null;
  /** Supabase Storage 公開圖片網址 */
  image_url?: string | null;
  popularity?: number;
  /** 分潤連結 JSONB，例：{ klook: "https://..." } */
  affiliate_links?: Record<string, string | null> | null;
}

/** 來自 Supabase food 表的常駐美食/景點資料 */
export interface Food {
  id: string;
  created_at?: string;
  name: string;
  description?: string | null;
  safety_notes?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  type?: string | null;
  category?: 'mtn' | 'city' | 'sea' | 'rail' | 'islands' | string | null;
  wild_tags?: string[] | null;
  image_url?: string | null;
  popularity?: number;
  opening_hours_text?: string | null;
  closed_days?: number[] | null;
}

/** @deprecated use Food */
export type Spot = Food;

export interface AffiliatePackage {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string;
  category_match: 'mtn' | 'city' | 'sea' | 'rail' | 'islands' | string;
}

/** 加入行程後的活動（附帶使用者指定的日期與預計停留時間） */
export interface PlannedEvent extends Event {
  assigned_date: string;       // YYYY-MM-DD
  stay_duration: number;       // 分鐘，預設 60
  isExtraDayTrigger?: boolean; // 由「多留一下」合併按鈕加入時為 true，用於側邊欄顯示訂房提醒
  /** 展覽/長期活動的使用者自訂前往時間（HH:MM），優先用於時間軸排序 */
  visit_time?: string;
}

// ─── Wizard / Gamified Builder Types ───────────────────────────────────────

export type AdventureTheme =
  | 'foodie'       // 大胃王
  | 'mountain'     // 山大王
  | 'ocean'        // 海公主
  | 'editor_pick'  // 小編私房
  | 'hidden';      // 小編秘境

export interface CuratedStop {
  id: string;
  name: string;
  category: 'attraction' | 'food' | 'accommodation' | 'transport';
  latitude: number;
  longitude: number;
  stay_duration: number;
  /** "HH:MM" — 時間釘選錨點，設定後該站不再浮動計算，後續站點從此重新推算 */
  manual_start_time?: string;
  tip?: string;
  /** Day-of-week numbers when venue is closed: 0=Sunday, 1=Monday … 6=Saturday */
  closed_days?: number[];
  contextual_trigger?: {
    type: 'nearby_food' | 'nearby_attraction';
    search_keyword: string;
  };
}

export interface CuratedDayPlan {
  day: number;
  label: string;
  has_island: boolean;
  island_name?: string;
  stops: CuratedStop[];
}

export interface BuilderDay extends CuratedDayPlan {
  date: string;
  departureTime: string;
}

export interface CuratedRoute {
  id: string;
  title: string;
  theme: AdventureTheme;
  days: number;
  cover_image: string;
  completion_count: number;
  rating: number;
  rating_count: number;
  highlights: string[];
  days_plan: CuratedDayPlan[];
  affiliate_links: AffiliateLinks & {
    ferry?: { label: string; url: string | null };
  };
}
