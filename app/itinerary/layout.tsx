import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '行程規劃',
  description: '使用野台東 Wild Taitung 規劃你的台東野旅行程。支援多日行程拖拉排序、地圖可視化，串聯野溪溫泉、露營秘境與部落體驗，打造最具野性的台東路線。',
  keywords: ['台東行程規劃', '台東野旅行程', '台東多日遊', '台東野溪溫泉', '台東秘境露營', '台東隱藏景點'],
  openGraph: {
    title: '台東野旅行程規劃｜野台東 Wild Taitung',
    description: '多日行程拖拉排序、互動地圖可視化，打造你的專屬台東野性路線。',
    type: 'website',
  },
};

export default function ItineraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
