export interface SpotOption {
  id: string;
  name: string;
  category: 'food' | 'attraction' | 'hidden' | 'accommodation';
  latitude: number;
  longitude: number;
  stay_duration: number;
  rating: number;
  rating_count: number;
  tip?: string;
  region: '台東市' | '東海岸' | '縱谷' | '南迴' | '離島';
  vibes?: string[];
}

export const SPOT_OPTIONS: SpotOption[] = [
  // ── 美食 ─────────────────────────────────────────────────────────────────
  { id: 'sp-f01', name: '東河包子',          category: 'food', latitude: 23.0513, longitude: 121.3621, stay_duration: 30,  rating: 4.9, rating_count: 8432,  tip: '必點鮮肉、蔥肉兩種口味',       region: '東海岸', vibes: ['親子共遊', '網美打卡'] },
  { id: 'sp-f02', name: '老東台米苔目',       category: 'food', latitude: 22.7508, longitude: 121.1491, stay_duration: 30,  rating: 4.8, rating_count: 3210,  tip: '台東市區必吃早餐',             region: '台東市', vibes: ['親子共遊', '歷史文化', '雨天備案'] },
  { id: 'sp-f03', name: '池上飯包 (本店)',    category: 'food', latitude: 23.0978, longitude: 121.2188, stay_duration: 45,  rating: 4.8, rating_count: 5620,  tip: '現做便當，搭配伯朗大道最對味', region: '縱谷',   vibes: ['親子共遊', '網美打卡', '雨天備案'] },
  { id: 'sp-f04', name: '藍蜻蜓速食',        category: 'food', latitude: 22.7511, longitude: 121.1497, stay_duration: 30,  rating: 4.7, rating_count: 2104,  tip: '台東人的早午餐首選',           region: '台東市', vibes: ['親子共遊'] },
  { id: 'sp-f05', name: '洄游吧台東',         category: 'food', latitude: 22.7540, longitude: 121.1480, stay_duration: 60,  rating: 4.6, rating_count: 1890,  tip: '主打在地漁獲，推薦鮭魚丼',     region: '台東市', vibes: ['網美打卡', '雨天備案'] },
  { id: 'sp-f06', name: '珊瑚海海鮮',         category: 'food', latitude: 23.0990, longitude: 121.3790, stay_duration: 75,  rating: 4.9, rating_count: 1204,  tip: '現撈直送，活魚三吃必點',       region: '東海岸', vibes: ['親子共遊'] },
  { id: 'sp-f07', name: '卑南豬血湯',         category: 'food', latitude: 22.7430, longitude: 121.1460, stay_duration: 30,  rating: 4.6, rating_count:  823,  tip: '賣完即止，建議早上去',         region: '台東市', vibes: ['歷史文化'] },
  { id: 'sp-f08', name: '虱目魚丸湯 (南王)',   category: 'food', latitude: 22.7644, longitude: 121.1398, stay_duration: 25,  rating: 4.6, rating_count:  678,  tip: '在地阿嬤老字號',               region: '台東市', vibes: ['歷史文化', '親子共遊'] },
  { id: 'sp-f09', name: '鹿野農會米店',       category: 'food', latitude: 22.9893, longitude: 121.1738, stay_duration: 30,  rating: 4.5, rating_count:  441,  tip: '直送台東米，送禮自用皆宜',     region: '縱谷',   vibes: ['親子共遊'] },
  { id: 'sp-f10', name: '成功上將魚排',       category: 'food', latitude: 23.0980, longitude: 121.3780, stay_duration: 45,  rating: 4.5, rating_count:  388,  tip: '週末人多，建議 11:30 前抵達', region: '東海岸', vibes: ['親子共遊'] },

  // ── 景點 ─────────────────────────────────────────────────────────────────
  { id: 'sp-a01', name: '台東森林公園',         category: 'attraction', latitude: 22.7553, longitude: 121.1565, stay_duration: 90,  rating: 4.8, rating_count: 12840, tip: '免費入場，日落時分必去',     region: '台東市', vibes: ['親子共遊', '網美打卡'] },
  { id: 'sp-a02', name: '三仙台',               category: 'attraction', latitude: 23.1228, longitude: 121.4167, stay_duration: 90,  rating: 4.9, rating_count: 18230, tip: '跨海步橋是台東地標',         region: '東海岸', vibes: ['戶外冒險', '網美打卡', '親子共遊'] },
  { id: 'sp-a03', name: '伯朗大道',             category: 'attraction', latitude: 23.1013, longitude: 121.2222, stay_duration: 60,  rating: 4.8, rating_count: 22100, tip: '日出後一小時光線最美',       region: '縱谷',   vibes: ['網美打卡', '親子共遊'] },
  { id: 'sp-a04', name: '鹿野高台',             category: 'attraction', latitude: 22.9893, longitude: 121.1620, stay_duration: 90,  rating: 4.7, rating_count:  9870, tip: '熱氣球季在此，可體驗滑翔翼', region: '縱谷',   vibes: ['戶外冒險', '網美打卡'] },
  { id: 'sp-a05', name: '鐵花村音樂聚落',       category: 'attraction', latitude: 22.7508, longitude: 121.1467, stay_duration: 120, rating: 4.7, rating_count:  7230, tip: '週末有現場演出，文創市集',   region: '台東市', vibes: ['夜生活', '網美打卡', '雨天備案'] },
  { id: 'sp-a06', name: '太麻里金針山',         category: 'attraction', latitude: 22.6176, longitude: 121.0396, stay_duration: 180, rating: 4.6, rating_count:  4510, tip: '金針花季 8–9 月必訪',        region: '南迴',   vibes: ['戶外冒險', '網美打卡'] },
  { id: 'sp-a07', name: '知本溫泉',             category: 'attraction', latitude: 22.6867, longitude: 121.0066, stay_duration: 120, rating: 4.5, rating_count:  6340, tip: '山中野溪溫泉體驗',           region: '南迴',   vibes: ['戶外冒險', '親子共遊'] },
  { id: 'sp-a08', name: '都歷海灘',             category: 'attraction', latitude: 22.9419, longitude: 121.3576, stay_duration: 120, rating: 4.7, rating_count:  3820, tip: '衝浪、浮潛、獨木舟皆宜',     region: '東海岸', vibes: ['戶外冒險', '網美打卡'] },
  { id: 'sp-a09', name: '台東縣史前文化博物館', category: 'attraction', latitude: 22.7553, longitude: 121.1500, stay_duration: 90,  rating: 4.6, rating_count:  5120, tip: '台灣最完整的史前文物館',     region: '台東市', vibes: ['歷史文化', '親子共遊', '雨天備案'] },
  { id: 'sp-a10', name: '成功漁港',             category: 'attraction', latitude: 23.0991, longitude: 121.3794, stay_duration: 60,  rating: 4.7, rating_count:  4380, tip: '清晨看漁獲拍賣最精彩',       region: '東海岸', vibes: ['網美打卡', '戶外冒險'] },

  // ── 秘境 ─────────────────────────────────────────────────────────────────
  { id: 'sp-h01', name: '金樽漁港',          category: 'hidden', latitude: 23.0688, longitude: 121.3947, stay_duration: 60,  rating: 4.9, rating_count: 2340, tip: '在地人才知道，潔白沙灘零遊客',     region: '東海岸', vibes: ['戶外冒險', '網美打卡'] },
  { id: 'sp-h02', name: '石梯坪潮池',        category: 'hidden', latitude: 23.3891, longitude: 121.4677, stay_duration: 90,  rating: 4.8, rating_count: 1890, tip: '退潮時顯露壺穴地形，超上鏡',       region: '東海岸', vibes: ['戶外冒險', '網美打卡'] },
  { id: 'sp-h03', name: '姑仔崙吊橋',        category: 'hidden', latitude: 22.8342, longitude: 121.1156, stay_duration: 45,  rating: 4.7, rating_count:  980, tip: '幾乎沒有遊客的木造古橋',           region: '縱谷',   vibes: ['歷史文化', '網美打卡'] },
  { id: 'sp-h04', name: '利嘉林道',          category: 'hidden', latitude: 22.8011, longitude: 121.0788, stay_duration: 120, rating: 4.6, rating_count:  760, tip: '布農族秘境，早晨雲霧繚繞',         region: '台東市', vibes: ['戶外冒險'] },
  { id: 'sp-h05', name: '小野柳地質公園',    category: 'hidden', latitude: 22.7239, longitude: 121.2002, stay_duration: 60,  rating: 4.5, rating_count: 2200, tip: '奇岩怪石，適合半日健行',           region: '台東市', vibes: ['戶外冒險', '親子共遊'] },
  { id: 'sp-h06', name: '長光梯田',          category: 'hidden', latitude: 23.4511, longitude: 121.4798, stay_duration: 60,  rating: 4.7, rating_count:  880, tip: '秋收時節金黃梯田，無人知曉的秘境', region: '東海岸', vibes: ['網美打卡', '戶外冒險'] },
  { id: 'sp-h07', name: '朝日溫泉 (海底版)', category: 'hidden', latitude: 22.6651, longitude: 121.4888, stay_duration: 90,  rating: 4.8, rating_count: 1560, tip: '全台唯一海水冒泡野溪溫泉',         region: '離島',   vibes: ['戶外冒險', '網美打卡'] },

  // ── 住宿 ─────────────────────────────────────────────────────────────────
  { id: 'sp-ac01', name: '娜路彎大酒店',    category: 'accommodation', latitude: 22.7583, longitude: 121.1441, stay_duration: 60, rating: 4.7, rating_count: 3120, tip: '台東最具代表性的度假酒店',     region: '台東市', vibes: ['親子共遊', '網美打卡'] },
  { id: 'sp-ac02', name: '知本老爺酒店',    category: 'accommodation', latitude: 22.6889, longitude: 121.0078, stay_duration: 60, rating: 4.8, rating_count: 4560, tip: '溫泉無限暢泡，療癒首選',       region: '南迴',   vibes: ['親子共遊'] },
  { id: 'sp-ac03', name: '鹿野渡假村',      category: 'accommodation', latitude: 22.9878, longitude: 121.1690, stay_duration: 60, rating: 4.6, rating_count: 1890, tip: '高台旁，熱氣球起飛點步行可達', region: '縱谷',   vibes: ['戶外冒險', '親子共遊'] },
  { id: 'sp-ac04', name: '月光小棧 (都蘭)', category: 'accommodation', latitude: 22.9892, longitude: 121.3188, stay_duration: 60, rating: 4.5, rating_count:  673, tip: '藝術家開設，充滿東海岸氣息',   region: '東海岸', vibes: ['網美打卡'] },
];
