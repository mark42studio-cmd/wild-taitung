import type { DriveStep } from 'driver.js';

export const HOME_TOUR_KEY = 'cultrRoute_homeTour_v2';
export const ITINERARY_TOUR_KEY = 'cultrRoute_itineraryTour_v2';
export const ITINERARY_TOUR_KEY_V3 = 'hasSeenTour_v3';
export const HOME_TOUR_KEY_V3 = 'wildTaitung_homeTour_v3';
export const PWA_PROMPT_KEY = 'hasSeenPwaPrompt_v1';

export const homeSteps: DriveStep[] = [
  {
    popover: {
      title: '👋 歡迎來到野台東！',
      description:
        '探索台東的野性美：野溪溫泉、秘境露營、深度部落體驗。讓我們帶您快速導覽 🏔️',
    },
  },
  {
    element: '#tour-filter-toggle',
    popover: {
      title: '🗂️ 展開工具列篩選',
      description:
        '點擊右上角這個按鈕展開工具列，使用分類快速切換溫泉、露營等野旅秘境，或設定旅遊日期。',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#tour-fab-toggle',
    popover: {
      title: '✨ 更多功能',
      description:
        '點擊這裡展開更多動作：可以回報問題、安裝 App 到主畫面，或是請小助手喝杯咖啡！',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#tour-explore-handle',
    popover: {
      title: '🎒 從這裡開始你的旅程！',
      description:
        '點擊或向上滑動底部面板，挑選官方策劃路線、使用 AI 匯入行程，開始你的專屬台東冒險！',
      side: 'top',
      align: 'center',
    },
  },
];

export const itinerarySteps: DriveStep[] = [
  {
    element: '#tour-itinerary-tabs',
    popover: {
      title: '📅 日期分頁',
      description:
        '系統已根據你的旅遊日期自動建立每一天的分頁。點擊分頁切換日期，右側漸層代表還有更多天數可左右滑動。',
      side: 'bottom',
    },
  },
  {
    element: '#tour-itinerary-events',
    popover: {
      title: '✋ 拖拉調整順序',
      description:
        '長按活動卡片並拖拉，可以自由調整當天的參觀順序，打造最順路的行程！',
      side: 'right',
    },
  },
  {
    element: '#tour-itinerary-map',
    popover: {
      title: '🗺️ 路線地圖',
      description:
        '地圖會標示今日所有活動的地點。點擊「時間確認，生成路線圖」即可一鍵規劃最佳移動路線。',
      side: 'left',
    },
  },
  {
    element: '#tour-itinerary-export',
    popover: {
      title: '📤 儲存 ＆ 分享行程',
      description:
        '規劃完成後，可匯出至 Google / Apple 日曆，或下載精美的台東回憶明信片留念！',
      side: 'top',
    },
  },
  {
    element: '#tour-generate-route-btn',
    popover: {
      title: '✨ 最後一步：生成專屬路線！',
      description:
        '排好行程了嗎？點擊這個按鈕，系統會幫你畫出完整的地圖與交通路線喔！',
      side: 'top',
      align: 'center',
    },
    onHighlightStarted: (element: Element | undefined) => {
      setTimeout(() => {
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    },
  },
  {
    popover: {
      title: '📱 把台東帶在身邊！',
      description:
        '點擊瀏覽器底部的「分享」或選單按鈕，選擇「加入主畫面」，就能把這個網站變成手機 App，隨時查看行程不迷路！',
    },
  },
];
