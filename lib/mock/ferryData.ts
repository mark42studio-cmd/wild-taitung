export interface FerrySchedule {
  time: string;
  operator: string;
  duration: string;
  price: number;
  url: string | null;
}

export interface FerryRoute {
  destination: string;
  departurePort: string;
  note: string;
  schedules: FerrySchedule[];
}

export const FERRY_ROUTES: Record<string, FerryRoute> = {
  '綠島': {
    destination: '綠島',
    departurePort: '富岡漁港',
    note: '建議提前 3 天以上購票，旺季請提早 1 週',
    schedules: [
      { time: '07:30', operator: '綠島之星',  duration: '50 分', price: 380, url: null },
      { time: '09:30', operator: '凱旋客輪',  duration: '50 分', price: 360, url: null },
      { time: '11:30', operator: '天王星',    duration: '55 分', price: 350, url: null },
      { time: '13:30', operator: '綠島之星',  duration: '50 分', price: 380, url: null },
      { time: '15:30', operator: '凱旋客輪',  duration: '50 分', price: 360, url: null },
    ],
  },
  '蘭嶼': {
    destination: '蘭嶼',
    departurePort: '富岡漁港',
    note: '航程較長，易暈船者建議備藥；每週一、三、五發船',
    schedules: [
      { time: '07:00', operator: '蘭嶼之星',  duration: '2.5 小時', price: 680, url: null },
      { time: '13:30', operator: '台東輪船',  duration: '2.5 小時', price: 650, url: null },
    ],
  },
};
