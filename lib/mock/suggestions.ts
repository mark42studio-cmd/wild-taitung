import type { CuratedStop } from '@/types';

const RICH_SUGGESTIONS: Record<string, CuratedStop[]> = {
  '台東森林公園美食': [
    { id: 'rsg-001', name: '洄游吧台東',       category: 'food',       latitude: 22.754, longitude: 121.148, stay_duration: 60,  tip: '台東市區 · 主打在地漁獲' },
    { id: 'rsg-002', name: '卑南豬血湯',       category: 'food',       latitude: 22.743, longitude: 121.146, stay_duration: 30,  tip: '中華路 · 賣完即止，建議早上去' },
    { id: 'rsg-003', name: '藍蜻蜓速食',       category: 'food',       latitude: 22.751, longitude: 121.150, stay_duration: 45,  tip: '中山路 · 台東人的早午餐首選' },
  ],
  '成功漁港特選海產': [
    { id: 'rsg-004', name: '珊瑚海海鮮',       category: 'food',       latitude: 23.099, longitude: 121.379, stay_duration: 75,  tip: '成功鎮 · 現撈直送，活魚三吃必點' },
    { id: 'rsg-005', name: '成功上將魚排',     category: 'food',       latitude: 23.098, longitude: 121.378, stay_duration: 45,  tip: '週末人多，建議 11:30 前抵達' },
    { id: 'rsg-006', name: '成功漁港市場',     category: 'attraction', latitude: 23.100, longitude: 121.380, stay_duration: 40,  tip: '清晨 5 點開市，看漁獲拍賣的最佳時機' },
  ],
  '台東市區景點': [
    { id: 'rsg-007', name: '台東縣史前文化博物館', category: 'attraction', latitude: 22.752, longitude: 121.147, stay_duration: 90 },
    { id: 'rsg-008', name: '鐵道藝術村',           category: 'attraction', latitude: 22.747, longitude: 121.148, stay_duration: 60,  tip: '週末有藝文活動，值得多留一下' },
  ],
};

const FALLBACK: CuratedStop[] = [
  { id: 'fallback-1', name: '台東市區推薦景點 A', category: 'attraction', latitude: 22.755, longitude: 121.147, stay_duration: 60 },
  { id: 'fallback-2', name: '台東在地美食 B',     category: 'food',       latitude: 22.752, longitude: 121.145, stay_duration: 45 },
];

export function getRichSuggestions(keyword: string): CuratedStop[] {
  return RICH_SUGGESTIONS[keyword] ?? FALLBACK;
}
