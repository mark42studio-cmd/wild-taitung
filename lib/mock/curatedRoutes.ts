import type { AdventureTheme, CuratedRoute } from '@/types';

export const MOCK_CURATED_ROUTES: CuratedRoute[] = [
  // ── Ocean ──────────────────────────────────────────────────────────────
  {
    id: 'ocean-3d-island',
    title: '海岸三日野放',
    theme: 'ocean',
    days: 3,
    cover_image: '',
    completion_count: 2847,
    rating: 4.9,
    rating_count: 312,
    highlights: ['綠島浮潛', '都歷沙灘', '成功漁港'],
    days_plan: [
      {
        day: 1, label: 'Day 1 台東市區入場', has_island: false,
        stops: [
          { id: 'o1-s1', name: '台東森林公園', category: 'attraction', latitude: 22.7553, longitude: 121.1565, stay_duration: 90 },
          { id: 'o1-s2', name: '鐵花村', category: 'attraction', latitude: 22.7508, longitude: 121.1467, stay_duration: 120 },
        ],
      },
      {
        day: 2, label: 'Day 2 綠島・海底溫泉', has_island: true, island_name: '綠島',
        stops: [
          { id: 'o1-s3', name: '朝日溫泉', category: 'attraction', latitude: 22.6651, longitude: 121.4888, stay_duration: 90 },
          { id: 'o1-s4', name: '柴口浮潛區', category: 'attraction', latitude: 22.6699, longitude: 121.4912, stay_duration: 120 },
        ],
      },
      {
        day: 3, label: 'Day 3 東海岸收尾', has_island: false,
        stops: [
          { id: 'o1-s5', name: '三仙台', category: 'attraction', latitude: 23.1228, longitude: 121.4167, stay_duration: 60 },
          { id: 'o1-s6', name: '成功漁港', category: 'food', latitude: 23.0991, longitude: 121.3794, stay_duration: 90, contextual_trigger: { type: 'nearby_food', search_keyword: '成功漁港特選海產' } },
        ],
      },
    ],
    affiliate_links: { rental: { label: '租車', url: null }, ticket: { label: '售票連結', url: null }, accommodation: { label: '周邊住宿', url: null }, ferry: { label: '綠島船票', url: null } },
  },
  {
    id: 'ocean-2d-coast',
    title: '東海岸衝浪假期',
    theme: 'ocean',
    days: 2,
    cover_image: '',
    completion_count: 1204,
    rating: 4.7,
    rating_count: 98,
    highlights: ['都歷衝浪', '杉原海水浴場', '東河包子'],
    days_plan: [
      {
        day: 1, label: 'Day 1 衝浪起手式', has_island: false,
        stops: [
          { id: 'o2-s1', name: '都歷海灘', category: 'attraction', latitude: 22.9419, longitude: 121.3576, stay_duration: 180 },
          { id: 'o2-s2', name: '東河包子', category: 'food', latitude: 23.0513, longitude: 121.3621, stay_duration: 30 },
        ],
      },
      {
        day: 2, label: 'Day 2 杉原收尾', has_island: false,
        stops: [
          { id: 'o2-s3', name: '杉原海水浴場', category: 'attraction', latitude: 22.8301, longitude: 121.2827, stay_duration: 150 },
        ],
      },
    ],
    affiliate_links: { rental: { label: '租車', url: null }, ticket: { label: '售票連結', url: null }, accommodation: { label: '周邊住宿', url: null } },
  },

  // ── Mountain ───────────────────────────────────────────────────────────
  {
    id: 'mountain-3d-hotspring',
    title: '山大王野溪三日探',
    theme: 'mountain',
    days: 3,
    cover_image: '',
    completion_count: 891,
    rating: 4.8,
    rating_count: 156,
    highlights: ['栗松溫泉', '嘉明湖登山口', '知本溫泉'],
    days_plan: [
      {
        day: 1, label: 'Day 1 知本溫泉暖身', has_island: false,
        stops: [
          { id: 'm1-s1', name: '知本溫泉', category: 'attraction', latitude: 22.6897, longitude: 121.0038, stay_duration: 120, closed_days: [1] },
        ],
      },
      {
        day: 2, label: 'Day 2 栗松野溪', has_island: false,
        stops: [
          { id: 'm1-s2', name: '栗松野溪溫泉', category: 'attraction', latitude: 23.0524, longitude: 121.1213, stay_duration: 180, tip: '溯溪約 2 小時，建議早上 7 點出發' },
        ],
      },
      {
        day: 3, label: 'Day 3 都蘭山步道', has_island: false,
        stops: [
          { id: 'm1-s3', name: '都蘭山步道', category: 'attraction', latitude: 23.0917, longitude: 121.2397, stay_duration: 150 },
        ],
      },
    ],
    affiliate_links: { rental: { label: '租車', url: null }, ticket: { label: '售票連結', url: null }, accommodation: { label: '山區住宿', url: null } },
  },

  // ── Foodie ─────────────────────────────────────────────────────────────
  {
    id: 'foodie-2d-market',
    title: '大胃王市場掃街',
    theme: 'foodie',
    days: 2,
    cover_image: '',
    completion_count: 3102,
    rating: 4.8,
    rating_count: 421,
    highlights: ['台東觀光夜市', '卑南豬血湯', '池上飯包'],
    days_plan: [
      {
        day: 1, label: 'Day 1 市區掃街', has_island: false,
        stops: [
          { id: 'f1-s1', name: '台東觀光夜市', category: 'food', latitude: 22.7553, longitude: 121.1564, stay_duration: 120 },
          { id: 'f1-s2', name: '卑南豬血湯', category: 'food', latitude: 22.7437, longitude: 121.1469, stay_duration: 45 },
        ],
      },
      {
        day: 2, label: 'Day 2 縱谷美食', has_island: false,
        stops: [
          { id: 'f1-s3', name: '池上飯包文化故事館', category: 'attraction', latitude: 23.1058, longitude: 121.2193, stay_duration: 60, closed_days: [1, 2] },
          { id: 'f1-s4', name: '池上便當本舖', category: 'food', latitude: 23.1072, longitude: 121.2201, stay_duration: 60 },
        ],
      },
    ],
    affiliate_links: { rental: { label: '租車', url: null }, ticket: { label: '售票連結', url: null }, accommodation: { label: '周邊住宿', url: null } },
  },

  // ── Editor Pick ────────────────────────────────────────────────────────
  {
    id: 'editor-pick-2d-local',
    title: '小編私房在地路線',
    theme: 'editor_pick',
    days: 2,
    cover_image: '',
    completion_count: 567,
    rating: 4.9,
    rating_count: 87,
    highlights: ['初鹿牧場', '鸞山森林博物館', '東糖文化園區'],
    days_plan: [
      {
        day: 1, label: 'Day 1 在地農村體驗', has_island: false,
        stops: [
          { id: 'e1-s1', name: '初鹿牧場', category: 'attraction', latitude: 22.7836, longitude: 121.0714, stay_duration: 120 },
          { id: 'e1-s2', name: '鸞山森林博物館', category: 'attraction', latitude: 22.8519, longitude: 121.0681, stay_duration: 150, tip: '需提前預約，限小班制' },
        ],
      },
      {
        day: 2, label: 'Day 2 糖廠文化', has_island: false,
        stops: [
          { id: 'e1-s3', name: '台東糖廠文化園區', category: 'attraction', latitude: 22.7617, longitude: 121.1326, stay_duration: 90 },
        ],
      },
    ],
    affiliate_links: { rental: { label: '租車', url: null }, ticket: { label: '售票連結', url: null }, accommodation: { label: '農莊住宿', url: null } },
  },

  // ── Hidden ─────────────────────────────────────────────────────────────
  {
    id: 'hidden-3d-secret',
    title: '小編秘境深度探索',
    theme: 'hidden',
    days: 3,
    cover_image: '',
    completion_count: 213,
    rating: 5.0,
    rating_count: 44,
    highlights: ['加路蘭秘境', '水往上流', '金樽漁港'],
    days_plan: [
      {
        day: 1, label: 'Day 1 加路蘭秘境', has_island: false,
        stops: [
          { id: 'h1-s1', name: '加路蘭遊憩區', category: 'attraction', latitude: 22.8736, longitude: 121.2916, stay_duration: 90 },
        ],
      },
      {
        day: 2, label: 'Day 2 奇景之旅', has_island: false,
        stops: [
          { id: 'h1-s2', name: '水往上流', category: 'attraction', latitude: 23.0671, longitude: 121.3717, stay_duration: 30 },
          { id: 'h1-s3', name: '金樽漁港', category: 'attraction', latitude: 23.1531, longitude: 121.4283, stay_duration: 60 },
        ],
      },
      {
        day: 3, label: 'Day 3 秘境收尾', has_island: false,
        stops: [
          { id: 'h1-s4', name: '小黃山', category: 'attraction', latitude: 22.9302, longitude: 121.0841, stay_duration: 120 },
        ],
      },
    ],
    affiliate_links: { rental: { label: '租車', url: null }, ticket: { label: '售票連結', url: null }, accommodation: { label: '秘境民宿', url: null } },
  },
];

export function getRecommendedRoutes(theme: AdventureTheme, days: number): CuratedRoute[] {
  const exact      = MOCK_CURATED_ROUTES.filter(r => r.theme === theme && r.days === days);
  const sameTheme  = MOCK_CURATED_ROUTES.filter(r => r.theme === theme && r.days !== days);
  const others     = MOCK_CURATED_ROUTES.filter(r => r.theme !== theme);
  return [...exact, ...sameTheme, ...others].slice(0, 3);
}
