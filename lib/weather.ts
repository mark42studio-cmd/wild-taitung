import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const CWA_BASE_URL = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';
const THREE_DAY_DATASET = 'F-D0047-037';
const WEEK_DATASET = 'F-D0047-089';
const TAITUNG_LOCATION_NAME = '臺東縣';

export interface WeatherCacheRow {
  id?: string;
  location_name: string;
  dataset_id: string;
  fetched_at: string;
  expires_at: string;
  rain_prob_6h: number | null;
  weather_code: string | null;
  wind_beaufort: number | null;
  wave_height_m: number | null;
  raw_json?: unknown;
}

type WeatherCacheInsertRow = Omit<WeatherCacheRow, 'id' | 'raw_json'>;

export interface JournalWeatherSummary {
  label: string;
  description: string;
  rows: WeatherCacheRow[];
}

// CWA ElementValue 的 key 因元素而異（如 Weather、ProbabilityOfPrecipitation、BeaufortScale…），
// 不是泛用的 Value/value，故用 Record 接收任意 key。
type CwaElementValue = Record<string, string | undefined>;

interface CwaTimeSlot {
  StartTime?: string;
  EndTime?: string;
  DataTime?: string;
  ElementValue?: CwaElementValue[];
  elementValue?: CwaElementValue[];
}

interface CwaWeatherElement {
  ElementName?: string;
  elementName?: string;
  Time?: CwaTimeSlot[];
  time?: CwaTimeSlot[];
}

interface CwaLocation {
  LocationName?: string;
  locationName?: string;
  WeatherElement?: CwaWeatherElement[];
  weatherElement?: CwaWeatherElement[];
}

interface CwaApiResponse {
  success?: string;
  records?: {
    Locations?: Array<{ Location?: CwaLocation[]; location?: CwaLocation[] }>;
    locations?: Array<{ Location?: CwaLocation[]; location?: CwaLocation[] }>;
  };
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function addHours(date: Date, hours: number): string {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy.toISOString();
}

function extractLocations(data: CwaApiResponse): CwaLocation[] {
  const groups = data.records?.Locations ?? data.records?.locations ?? [];
  return groups.flatMap((group) => group.Location ?? group.location ?? []);
}

function findElement(location: CwaLocation, names: string[]): CwaWeatherElement | undefined {
  const elements = location.WeatherElement ?? location.weatherElement ?? [];
  return elements.find((element) => names.includes(element.ElementName ?? element.elementName ?? ''));
}

// 從指定 element 的第一個 Time slot 取值，依序嘗試 valueKeys 直到找到非空字串。
// CWA 各元素用專屬 key（ProbabilityOfPrecipitation、Weather、BeaufortScale…）而非泛用 Value。
function getElementValue(location: CwaLocation, elementNames: string[], ...valueKeys: string[]): string | null {
  const element = findElement(location, elementNames);
  const times = element?.Time ?? element?.time ?? [];
  const obj = (times[0]?.ElementValue ?? times[0]?.elementValue ?? [])[0];
  if (!obj) return null;
  for (const key of valueKeys) {
    const v = obj[key];
    if (v != null && v !== '' && v !== ' ') return v;
  }
  return null;
}

async function fetchCwaDataset(datasetId: string, apiKey: string): Promise<CwaApiResponse> {
  const url = new URL(`${CWA_BASE_URL}/${datasetId}`);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('locationName', TAITUNG_LOCATION_NAME);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CWA ${datasetId} 抓取失敗：${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CwaApiResponse;
  if (data.success && data.success !== 'true') {
    throw new Error(`CWA ${datasetId} 回傳 success=${data.success}`);
  }

  return data;
}

function toWeatherRows(datasetId: string, fetchedAt: Date, data: CwaApiResponse): WeatherCacheRow[] {
  const expiresAt = addHours(fetchedAt, 3);
  return extractLocations(data).map((location) => ({
    location_name: location.LocationName ?? location.locationName ?? TAITUNG_LOCATION_NAME,
    dataset_id: datasetId,
    fetched_at: fetchedAt.toISOString(),
    expires_at: expiresAt,
    // F-D0047-037/089 的 PoP 元素的 ElementValue key 為 ProbabilityOfPrecipitation
    rain_prob_6h: numberOrNull(getElementValue(location, ['PoP6h', 'PoP12h', 'PoP'], 'ProbabilityOfPrecipitation')),
    // Wx 的 ElementValue 包含 Weather（描述文字）和 WeatherCode（代碼），取描述文字
    weather_code: getElementValue(location, ['Wx'], 'Weather', 'WeatherCode'),
    // BeaufortScale 的 ElementValue key 與 ElementName 同名
    wind_beaufort: numberOrNull(getElementValue(location, ['BeaufortScale'], 'BeaufortScale')),
    // WaveHeight 同上
    wave_height_m: numberOrNull(getElementValue(location, ['WaveHeight'], 'WaveHeight')),
    raw_json: location,
  }));
}

export function createServiceSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY，無法更新 weather_cache');
  }

  return createClient(supabaseUrl, serviceKey);
}

export async function updateWeatherCache(options?: {
  apiKey?: string;
  supabase?: SupabaseClient;
}): Promise<WeatherCacheRow[]> {
  const apiKey = options?.apiKey || process.env.NEXT_PUBLIC_CWA_API_KEY;
  if (!apiKey) throw new Error('缺少 NEXT_PUBLIC_CWA_API_KEY 授權碼');

  const supabase = options?.supabase ?? createServiceSupabaseClient();
  const fetchedAt = new Date();
  const [threeDayData, weekData] = await Promise.all([
    fetchCwaDataset(THREE_DAY_DATASET, apiKey),
    fetchCwaDataset(WEEK_DATASET, apiKey),
  ]);

  const rows = [
    ...toWeatherRows(THREE_DAY_DATASET, fetchedAt, threeDayData),
    ...toWeatherRows(WEEK_DATASET, fetchedAt, weekData),
  ];

  if (rows.length === 0) {
    console.warn('[weather] CWA API 回傳 0 筆地點資料，請確認 API Key 與回應格式');
    return [];
  }

  const { error: deleteError } = await supabase
    .from('weather_cache')
    .delete()
    .lt('expires_at', fetchedAt.toISOString());
  if (deleteError) console.warn('[weather] 清理過期快取失敗（不影響寫入）：', deleteError.message);

  const dedupedRows = Array.from(
    rows.reduce((acc, row) => {
      const existing = acc.get(row.location_name);
      if (!existing || row.dataset_id === THREE_DAY_DATASET) acc.set(row.location_name, row);
      return acc;
    }, new Map<string, WeatherCacheRow>()).values(),
  );
  const insertRows: WeatherCacheInsertRow[] = dedupedRows.map(({ raw_json: _rawJson, id: _id, ...row }) => row);

  console.log(`[weather] 準備寫入 ${insertRows.length} 筆（原始 ${rows.length} 筆去重後）`);
  console.log('[weather] 第一筆範本：', JSON.stringify({
    location_name: insertRows[0]?.location_name,
    dataset_id:    insertRows[0]?.dataset_id,
    fetched_at:    insertRows[0]?.fetched_at,
    expires_at:    insertRows[0]?.expires_at,
    rain_prob_6h:  insertRows[0]?.rain_prob_6h,
    weather_code:  insertRows[0]?.weather_code,
  }));

  const { error } = await supabase.from('weather_cache').upsert(insertRows, { onConflict: 'location_name' });
  if (error) throw new Error(`weather_cache 寫入失敗：${error.message}`);

  console.log('[weather] upsert 完成，資料已存入 Supabase');
  return rows;
}

export async function fetchCurrentWeather(
  supabase: SupabaseClient,
  locationName = TAITUNG_LOCATION_NAME,
  now = new Date(),
): Promise<WeatherCacheRow | null> {
  const baseSelect = 'id, location_name, dataset_id, fetched_at, expires_at, rain_prob_6h, weather_code, wind_beaufort, wave_height_m';
  const query = supabase
    .from('weather_cache')
    .select(baseSelect)
    .gt('expires_at', now.toISOString())
    .order('fetched_at', { ascending: false })
    .limit(1);

  const { data, error } = await query.ilike('location_name', `%${locationName}%`);

  if (error) {
    console.error('[weather] weather_cache 最新資料讀取失敗', error.message);
    return null;
  }

  if (data && data.length > 0) return data[0] as WeatherCacheRow;

  const fallback = await supabase
    .from('weather_cache')
    .select(baseSelect)
    .gt('expires_at', now.toISOString())
    .order('fetched_at', { ascending: false })
    .limit(1);

  if (fallback.error) {
    console.error('[weather] weather_cache fallback 讀取失敗', fallback.error.message);
    return null;
  }

  return (fallback.data?.[0] as WeatherCacheRow | undefined) ?? null;
}

export async function readWeatherCache(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<WeatherCacheRow[]> {
  const { data, error } = await supabase
    .from('weather_cache')
    .select('id, location_name, dataset_id, fetched_at, expires_at, rain_prob_6h, weather_code, wind_beaufort, wave_height_m')
    .gt('expires_at', now.toISOString())
    .order('fetched_at', { ascending: false })
    .limit(40);

  if (error) {
    console.error('[weather] weather_cache 讀取失敗', error.message);
    return [];
  }

  return (data ?? []) as WeatherCacheRow[];
}

export function summarizeWeatherForTrip(
  rows: WeatherCacheRow[],
  tripStartDate: string,
  now = new Date(),
): JournalWeatherSummary {
  if (!tripStartDate) {
    return {
      label: '目前天氣',
      description: rows.length > 0 ? '目前顯示台東最新快取天氣。' : '尚未取得天氣快取資料。',
      rows,
    };
  }

  const tripStart = new Date(`${tripStartDate}T00:00:00+08:00`);
  const daysAway = Math.ceil((tripStart.getTime() - now.getTime()) / 86400000);

  if (daysAway <= 3) {
    return {
      label: '三天內預報',
      description: '使用中央氣象署三日預報，適合安排近期路線與戶外停留時間。',
      rows: rows.filter((row) => row.dataset_id === THREE_DAY_DATASET),
    };
  }

  if (daysAway > 7) {
    return {
      label: '一週趨勢',
      description: '超過七天的行程先參考一週趨勢，出發前建議再次更新天氣。',
      rows: rows.filter((row) => row.dataset_id === WEEK_DATASET),
    };
  }

  return {
    label: '一週預報',
    description: '使用中央氣象署一週預報，協助判斷行程區域與備案。',
    rows: rows.filter((row) => row.dataset_id === WEEK_DATASET),
  };
}
