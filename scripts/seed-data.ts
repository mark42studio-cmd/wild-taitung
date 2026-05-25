import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Category = 'sea' | 'mtn' | 'city' | 'rail';
type SeedRow = {
  name: string;
  description: string;
  lat: number;
  lng: number;
  type: 'food' | 'spot';
  category: Category;
  safety_notes?: string;
  wild_tags?: string[];
};

function loadEnvFile() {
  const envPaths = [resolve(process.cwd(), '..', '.env'), resolve(process.cwd(), '.env')]
    .filter((candidate) => existsSync(candidate));
  for (const envPath of envPaths) {
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.replace(/^\uFEFF/, '');
      const match = cleanLine.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, matchedKey, rawValue] = match;
      const key = matchedKey.replace(/^\uFEFF/, '');
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('缺少 SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const foodRows: SeedRow[] = [
  {
    name: '東河包子',
    description: '東海岸經典包子店，適合安排在都蘭、東河與三仙台之間的海線補給。',
    lat: 22.9692,
    lng: 121.3039,
    type: 'food',
    category: 'sea',
  },
  {
    name: '拉勞蘭小米工坊',
    description: '南迴線上的小米與部落風味據點，可認識太麻里、金崙一帶的飲食文化。',
    lat: 22.5819,
    lng: 120.9918,
    type: 'food',
    category: 'rail',
  },
  {
    name: '榕樹下米苔目',
    description: '台東市區代表小吃，適合放在市區散步與鐵花村行程前後。',
    lat: 22.7539,
    lng: 121.1507,
    type: 'food',
    category: 'city',
  },
  {
    name: '關山便當',
    description: '山線代表性的鐵路便當，適合關山、池上、鹿野一帶行程作為午餐補給。',
    lat: 23.0476,
    lng: 121.1637,
    type: 'food',
    category: 'mtn',
  },
];

const placeRows: SeedRow[] = [
  {
    name: '鹿野高台',
    description: '俯瞰縱谷與熱氣球活動的山線景點，天氣好時視野開闊。',
    lat: 22.9125,
    lng: 121.1215,
    type: 'spot',
    category: 'mtn',
    wild_tags: ['山線', '高台', '熱氣球'],
  },
  {
    name: '三仙台',
    description: '東海岸地標景點，拱橋、礁岩與海景適合清晨或傍晚造訪。',
    lat: 23.1245,
    lng: 121.4135,
    type: 'spot',
    category: 'sea',
    wild_tags: ['海線', '海岸', '日出'],
  },
  {
    name: '鐵花村',
    description: '台東市區音樂、手作與夜間散步據點，可串接市區小吃。',
    lat: 22.7527,
    lng: 121.1497,
    type: 'spot',
    category: 'city',
    wild_tags: ['市區', '音樂', '夜間'],
  },
  {
    name: '多良車站',
    description: '南迴線海景車站，可眺望太平洋與鐵道景觀。',
    lat: 22.5055,
    lng: 120.9595,
    type: 'spot',
    category: 'rail',
    wild_tags: ['南迴線', '海景', '鐵道'],
  },
];

const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertByName(table: 'food' | 'places', rows: SeedRow[]) {
  const { data: existing, error: selectError } = await supabase.from(table).select('id, name');
  if (selectError) throw new Error(`[${table}] 讀取既有資料失敗：${selectError.message}`);

  const existingByName = new Map((existing ?? []).map((row: { id: string; name: string }) => [row.name, row.id]));
  const written: Array<{ name: string; lat: number; lng: number; category: Category }> = [];

  for (const row of rows) {
    const payload: Record<string, unknown> = {
      ...row,
      lat: Number(row.lat),
      lng: Number(row.lng),
    };
    const id = existingByName.get(row.name);
    let query = id
      ? supabase.from(table).update(payload).eq('id', id)
      : supabase.from(table).insert([payload]);
    let { data, error } = await query.select('name, lat, lng, category').single();
    if (table === 'places' && error?.message.includes("Could not find the 'category' column")) {
      delete payload.category;
      query = id
        ? supabase.from(table).update(payload).eq('id', id)
        : supabase.from(table).insert([payload]);
      const fallback = await query.select('name, lat, lng').single();
      data = fallback.data ? { ...fallback.data, category: row.category } : null;
      error = fallback.error;
      console.warn(`[seed-data] public.places 缺少 category 欄位，${row.name} 已以 wild_tags/type 保留分類資訊。`);
    }
    if (error) throw new Error(`[${table}] 寫入 ${row.name} 失敗：${error.message}`);
    written.push(data as { name: string; lat: number; lng: number; category: Category });
  }

  return written;
}

const [foodWritten, placesWritten] = await Promise.all([
  upsertByName('food', foodRows),
  upsertByName('places', placeRows),
]);

console.log('[seed-data] food 已寫入：', foodWritten);
console.log('[seed-data] places 已寫入：', placesWritten);
