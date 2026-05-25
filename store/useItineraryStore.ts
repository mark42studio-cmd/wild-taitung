import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WeatherCacheRow } from '@/lib/weather';
import type { BuilderDay, CuratedRoute, Event, PlannedEvent } from '@/types';

// 🌟 小工具：將任何時間轉換成乾淨的 YYYY-MM-DD 格式
const getLocalYYYYMMDD = (dateStr: string) => {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface PreviewMeta {
  previewEvents: PlannedEvent[];
  previewTripStart: string;
  previewTripEnd: string;
  name: string;
  sourceId: string;
  adoptedCount: number;
}

interface ItineraryStore {
  plannedEvents: PlannedEvent[];
  isSidebarOpen: boolean;
  tripStartDate: string;
  tripEndDate: string;
  /** UI-only：目前正在閃爍的活動 ID（未持久化） */
  flashEventId: string | null;
  /** UI-only：是否剛剛新增了一天（未持久化） */
  flashDayAdded: boolean;
  /** UI-only：游標懸停中的活動 ID，用於列表 ↔ 地圖雙向連動（未持久化） */
  hoveredEventId: string | null;
  subFilter: string;
  weatherData: WeatherCacheRow | null;
  /** UI-only：地圖日程篩選器，'ALL' 或具體天數（1-based） */
  activeMapFilter: 'ALL' | number;
  setActiveMapFilter: (filter: 'ALL' | number) => void;
  /** 目前正在進行的挑戰路線名稱，null 表示未接受任何挑戰 */
  currentChallengeName: string | null;
  setCurrentChallengeName: (name: string | null) => void;
  /** 從 CuratedRoute 批次匯入所有景點至行程 */
  importRouteEvents: (route: CuratedRoute, startDateOverride?: string) => void;
  setHoveredEventId: (id: string | null) => void;
  setSubFilter: (tag: string) => void;
  setWeatherData: (weatherData: WeatherCacheRow | null) => void;
  setTripDates: (start: string, end: string) => void;
  addEvent: (event: Event, options?: { isExtraDayTrigger?: boolean; addToToday?: boolean }) => void;
  removeEvent: (eventId: string) => void;
  toggleSidebar: () => void;
  reorderEvents: (startIndex: number, endIndex: number, targetDate: string) => void;
  updateEventDate: (eventId: string, newDate: string) => void;
  updateStayDuration: (eventId: string, minutes: number) => void;
  /** 直接累加 minutes 至指定活動的 stay_duration（上限 240），並觸發 flash + 開啟 Sidebar */
  extendStayDuration: (eventId: string, minutes: number) => void;
  /** 將整趟行程的 tripEndDate 延長一天，並觸發 flashDayAdded + 開啟 Sidebar */
  addTripDay: () => void;
  clearFlash: () => void;
  /** 清空整趟行程（日期＋景點）但保留挑戰名稱；「清除日期」按鈕使用 */
  clearTrip: () => void;
  /** 設定展覽/長期活動的使用者自訂前往時間（HH:MM），用於時間軸排序 */
  updateVisitTime: (eventId: string, time: string) => void;
  /** 從 Builder 頁面同步天數至 plannedEvents（完整替換，確保 MapDayFilter 能顯示 D1/D2/D3） */
  setBuilderDays: (days: BuilderDay[], startDate: string) => void;
  /** 完成挑戰：清除路線名稱但保留已規劃的行程 */
  completeChallenge: () => void;
  /** 放棄挑戰：完全重置行程狀態，清空地圖圖釘 */
  resetChallenge: () => void;
  /** 非破壞性預覽 UGC 行程 — 不動 plannedEvents，僅暫存於 previewMeta */
  previewMeta: PreviewMeta | null;
  enterPreviewMode: (days: BuilderDay[], name: string, sourceId: string, adoptedCount: number, startDateOverride?: string) => void;
  /** 確認採用：將 previewMeta.previewEvents 正式寫入 plannedEvents */
  commitPreview: () => void;
  /** 放棄預覽：清除 previewMeta，不動 plannedEvents */
  cancelPreview: () => void;
}

export const useItineraryStore = create<ItineraryStore>()(
  persist(
    (set) => ({
      plannedEvents: [],
      isSidebarOpen: false,
      tripStartDate: '',
      tripEndDate: '',
      flashEventId: null,
      flashDayAdded: false,
      hoveredEventId: null,
      subFilter: 'all',
      weatherData: null,
      activeMapFilter: 'ALL',
      setActiveMapFilter: (filter) => set({ activeMapFilter: filter }),
      previewMeta: null,
      currentChallengeName: null,
      setCurrentChallengeName: (name) => set({ currentChallengeName: name }),
      setHoveredEventId: (id) => set({ hoveredEventId: id }),
      setSubFilter: (tag) => set({ subFilter: tag }),
      setWeatherData: (weatherData) => set({ weatherData }),

      // 儲存首頁設定的日期
      setTripDates: (start, end) => set({ tripStartDate: start, tripEndDate: end }),

      addEvent: (event, options) => set((state) => {
        if (state.plannedEvents.find(e => e.id === event.id)) return state;

        // 防呆：行程日期未設定時，自動初始化為本地今天
        let effectiveTripStart = state.tripStartDate;
        let effectiveTripEnd = state.tripEndDate;
        let autoInitialized = false;
        if (!effectiveTripStart) {
          const now = new Date();
          const today = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
          ].join('-');
          effectiveTripStart = today;
          effectiveTripEnd = today;
          autoInitialized = true;
        }

        const eventStartDate = getLocalYYYYMMDD(event.start_time);

        // 展覽判斷：end_date 或 end_time 與 start_time 不在同一天
        const exhibitionEnd =
          event.end_date ??
          (event.end_time ? getLocalYYYYMMDD(event.end_time) : null);
        const isMultiDayExhibition = !!(exhibitionEnd && exhibitionEnd > eventStartDate);

        // 自動初始化時，直接排到今天（Day 1）
        let assigned_date = autoInitialized ? effectiveTripStart : eventStartDate;

        if (isMultiDayExhibition && effectiveTripStart) {
          const tripStart = effectiveTripStart;

          if (options?.addToToday) {
            // 快速選擇今天 → 排到 Day 1（抵達日），若在展期內直接採用
            assigned_date =
              tripStart >= eventStartDate && tripStart <= exhibitionEnd!
                ? tripStart
                : eventStartDate;
          } else {
            // 預設：排到 Day 2（抵達日 +1），讓第一天保留給長途移動
            const [y, m, d] = tripStart.split('-').map(Number);
            const day2Date = new Date(y, m - 1, d + 1);
            const day2Str = [
              day2Date.getFullYear(),
              String(day2Date.getMonth() + 1).padStart(2, '0'),
              String(day2Date.getDate()).padStart(2, '0'),
            ].join('-');

            if (
              day2Str >= eventStartDate &&
              day2Str <= exhibitionEnd! &&
              (!effectiveTripEnd || day2Str <= effectiveTripEnd)
            ) {
              // Day 2 在展期內且不超出行程 → 優先排 Day 2
              assigned_date = day2Str;
            } else if (tripStart >= eventStartDate && tripStart <= exhibitionEnd!) {
              // Day 2 不可用，但 Day 1 在展期內 → fallback 到 Day 1
              assigned_date = tripStart;
            }
            // 其他情況（行程日期完全在展期外）→ 保留 eventStartDate，讓衝突警告提醒使用者
          }
        }

        return {
          plannedEvents: [
            ...state.plannedEvents,
            {
              ...event,
              assigned_date,
              stay_duration: 90,
              ...(options?.isExtraDayTrigger ? { isExtraDayTrigger: true } : {}),
            },
          ],
          isSidebarOpen: true,
          ...(autoInitialized ? { tripStartDate: effectiveTripStart, tripEndDate: effectiveTripEnd } : {}),
        };
      }),
      
      removeEvent: (eventId) => set((state) => ({
        plannedEvents: state.plannedEvents.filter(e => e.id !== eventId)
      })),
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      // 拖曳排序現在是認「絕對日期」
      reorderEvents: (startIndex, endIndex, targetDate) => set((state) => {
        const otherEvents = state.plannedEvents.filter(e => e.assigned_date !== targetDate);
        const targetEvents = state.plannedEvents.filter(e => e.assigned_date === targetDate);
        
        const [removed] = targetEvents.splice(startIndex, 1);
        targetEvents.splice(endIndex, 0, removed);
        
        return { plannedEvents: [...otherEvents, ...targetEvents] };
      }),

      // 更改日期也是直接更新「絕對日期」字串
      updateEventDate: (eventId, newDate) => set((state) => ({
        plannedEvents: state.plannedEvents.map(e =>
          e.id === eventId ? { ...e, assigned_date: newDate } : e
        )
      })),

      // 更新預計停留時間（分鐘）
      updateStayDuration: (eventId, minutes) => set((state) => ({
        plannedEvents: state.plannedEvents.map(e =>
          e.id === eventId ? { ...e, stay_duration: minutes } : e
        )
      })),

      // 累加停留時間（多留一下功能），上限 240 分鐘，同時觸發 flash 綠色動畫 + 開啟 Sidebar
      extendStayDuration: (eventId, minutes) => set((state) => ({
        plannedEvents: state.plannedEvents.map(e =>
          e.id === eventId
            ? { ...e, stay_duration: Math.min(240, (e.stay_duration ?? 90) + minutes) }
            : e
        ),
        flashEventId: eventId,
        isSidebarOpen: true,
      })),

      // 將整趟行程延長一天（多留一下 → 增加天數版本）
      // 使用 new Date(y, m-1, d) 本地時間建構，規避 UTC 解析時區偏移問題
      addTripDay: () => set((state) => {
        if (!state.tripEndDate) return state;
        const [y, m, d] = state.tripEndDate.split('-').map(Number);
        const next = new Date(y, m - 1, d + 1);
        const nextStr = [
          next.getFullYear(),
          String(next.getMonth() + 1).padStart(2, '0'),
          String(next.getDate()).padStart(2, '0'),
        ].join('-');
        return {
          tripEndDate: nextStr,
          flashDayAdded: true,
          isSidebarOpen: true,
        };
      }),

      importRouteEvents: (route, startDateOverride) => set((state) => {
        const startDate = startDateOverride || state.tripStartDate;
        if (!startDate) return state;

        const [sy, sm, sd] = startDate.split('-').map(Number);
        const endD = new Date(sy, sm - 1, sd + route.days - 1);
        const computedEnd = [
          endD.getFullYear(),
          String(endD.getMonth() + 1).padStart(2, '0'),
          String(endD.getDate()).padStart(2, '0'),
        ].join('-');

        const newEvents: PlannedEvent[] = [];
        for (const dayPlan of route.days_plan) {
          const dayD = new Date(sy, sm - 1, sd + dayPlan.day - 1);
          const dayStr = [
            dayD.getFullYear(),
            String(dayD.getMonth() + 1).padStart(2, '0'),
            String(dayD.getDate()).padStart(2, '0'),
          ].join('-');

          for (const stop of dayPlan.stops) {
            if (state.plannedEvents.find(e => e.id === stop.id)) continue;
            newEvents.push({
              id: stop.id,
              title: stop.name,
              description: '',
              venue_name: stop.name,
              latitude: stop.latitude,
              longitude: stop.longitude,
              start_time: '2020-01-01T00:00:00+08:00',
              end_date: '2099-12-31',
              is_free: true,
              weather_resilience: 1,
              vibe_tags: [],
              category: stop.category === 'food' ? 'city' : 'mtn',
              assigned_date: dayStr,
              stay_duration: stop.stay_duration,
            });
          }
        }

        return {
          plannedEvents: [...state.plannedEvents, ...newEvents],
          tripStartDate: state.tripStartDate || startDate,
          tripEndDate: state.tripEndDate || computedEnd,
          isSidebarOpen: false,
        };
      }),

      clearFlash: () => set({ flashEventId: null, flashDayAdded: false }),

      clearTrip: () => set({
        plannedEvents: [],
        tripStartDate: '',
        tripEndDate: '',
        activeMapFilter: 'ALL',
        isSidebarOpen: false,
        flashEventId: null,
        flashDayAdded: false,
      }),

      setBuilderDays: (days, startDate) => set(() => {
        // 空陣列 = 清除行程（讓 clearTrip + setBuilderDays([]) 雙管齊下）
        if (days.length === 0) {
          return {
            plannedEvents: [],
            tripStartDate: '',
            tripEndDate: '',
            isSidebarOpen: false,
            activeMapFilter: 'ALL' as const,
          };
        }
        if (!startDate) return {};
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const endD = new Date(sy, sm - 1, sd + days.length - 1);
        const tripEndDate = [
          endD.getFullYear(),
          String(endD.getMonth() + 1).padStart(2, '0'),
          String(endD.getDate()).padStart(2, '0'),
        ].join('-');
        // 從 startDate 動態計算每天的絕對日期，不依賴 day.date（可能為 undefined）
        const plannedEvents: PlannedEvent[] = days.flatMap((day, dayIdx) => {
          const dayD = new Date(sy, sm - 1, sd + dayIdx);
          const dayStr = [
            dayD.getFullYear(),
            String(dayD.getMonth() + 1).padStart(2, '0'),
            String(dayD.getDate()).padStart(2, '0'),
          ].join('-');
          return day.stops.map((stop) => ({
            id: stop.id,
            title: stop.name,
            description: '',
            venue_name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            start_time: '2020-01-01T00:00:00+08:00',
            end_date: '2099-12-31',
            is_free: true,
            weather_resilience: 1,
            vibe_tags: [],
            category: (stop.category === 'food' ? 'city' : 'mtn') as 'city' | 'mtn',
            assigned_date: dayStr,
            stay_duration: stop.stay_duration,
          }));
        });
        return {
          plannedEvents,
          tripStartDate: startDate,
          tripEndDate,
          isSidebarOpen: false,
          activeMapFilter: 'ALL' as const,
        };
      }),

      enterPreviewMode: (days, name, sourceId, adoptedCount, startDateOverride) => set((state) => {
        const startDate = startDateOverride || state.tripStartDate ||
          new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
        if (!startDate || days.length === 0) return {};
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const endD = new Date(sy, sm - 1, sd + days.length - 1);
        const previewTripEnd = [
          endD.getFullYear(),
          String(endD.getMonth() + 1).padStart(2, '0'),
          String(endD.getDate()).padStart(2, '0'),
        ].join('-');
        const previewEvents: PlannedEvent[] = days.flatMap((day, dayIdx) => {
          const dayD = new Date(sy, sm - 1, sd + dayIdx);
          const dayStr = [
            dayD.getFullYear(),
            String(dayD.getMonth() + 1).padStart(2, '0'),
            String(dayD.getDate()).padStart(2, '0'),
          ].join('-');
          return day.stops.map((stop) => ({
            id: stop.id,
            title: stop.name,
            description: '',
            venue_name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            start_time: '2020-01-01T00:00:00+08:00',
            end_date: '2099-12-31',
            is_free: true,
            weather_resilience: 1,
            vibe_tags: [],
            category: (stop.category === 'food' ? 'city' : 'mtn') as 'city' | 'mtn',
            assigned_date: dayStr,
            stay_duration: stop.stay_duration,
          }));
        });
        return {
          previewMeta: { previewEvents, previewTripStart: startDate, previewTripEnd, name, sourceId, adoptedCount },
          activeMapFilter: 'ALL' as const,
        };
      }),

      commitPreview: () => set((state) => {
        if (!state.previewMeta) return {};
        return {
          plannedEvents: state.previewMeta.previewEvents,
          tripStartDate: state.previewMeta.previewTripStart,
          tripEndDate: state.previewMeta.previewTripEnd,
          currentChallengeName: state.previewMeta.name,
          previewMeta: null,
          isSidebarOpen: false,
          activeMapFilter: 'ALL' as const,
        };
      }),

      cancelPreview: () => set({ previewMeta: null, activeMapFilter: 'ALL' }),

      completeChallenge: () => set({ currentChallengeName: null }),

      resetChallenge: () => set({
        currentChallengeName: null,
        previewMeta: null,
        plannedEvents: [],
        activeMapFilter: 'ALL',
        tripStartDate: '',
        tripEndDate: '',
        isSidebarOpen: false,
        flashEventId: null,
        flashDayAdded: false,
      }),

      updateVisitTime: (eventId, time) => set((state) => ({
        plannedEvents: state.plannedEvents.map(e =>
          e.id === eventId ? { ...e, visit_time: time || undefined } : e
        ),
      })),
    }),
    {
      name: 'cultur-route-itinerary',
      partialize: (state) => ({
        plannedEvents:       state.plannedEvents,
        tripStartDate:       state.tripStartDate,
        tripEndDate:         state.tripEndDate,
        currentChallengeName: state.currentChallengeName,
      }),
    }
  )
);
