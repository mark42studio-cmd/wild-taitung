/**
 * scrape-spots.mjs — 野台東四大類資料自動化產線
 *
 * 資料來源：
 *   1. 交通部觀光署開放資料 (免費 JSON，無需授權)
 *   2. Google Places Text Search (現有 GOOGLE_MAPS_API_KEY)
 *   3. 手工秘境種子資料 (台東獨有野溪溫泉、古道等)
 *
 * Pipeline：Fetch → Gemini AI 清洗 → 圖片上傳 Supabase Storage → upsert spots 表
 *
 * 用法：
 *   node scripts/scrape-spots.mjs                     # 全跑
 *   node scripts/scrape-spots.mjs --dry-run           # 不寫入 DB，只印出結果
 *   node scripts/scrape-spots.mjs --category 美食     # 只跑某類別
 *   node scripts/scrape-spots.mjs --skip-images       # 跳過圖片下載加速測試
 */

import { createClient }    from '@supabase/supabase-js';
import { GoogleGenAI }     from '@google/genai';
import { resolve, dirname } from 'node:path';
import { fileURLToPath }   from 'node:url';
import crypto              from 'node:crypto';
import dotenv              from 'dotenv';
import axios               from 'axios';

const __dirname  = dirname(fileURLToPath(import.meta.url));

// ─── 環境變數載入 ──────────────────────────────────────────────────────────────
// 載入順序：repo 根目錄 .env → wildTaitung/.env → 再以 .env.local 覆蓋（override: true）
// 這樣 .env.local 的值永遠優先，且兩層目錄都能找到
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../../.env.local'), override: true });
dotenv.config({ path: resolve(__dirname, '../.env.local'),    override: true });

const ARGS       = process.argv.slice(2);
const DRY_RUN    = ARGS.includes('--dry-run');
const SKIP_IMG   = ARGS.includes('--skip-images');
const CAT_FILTER = (() => {
  const i = ARGS.indexOf('--category');
  return i !== -1 ? ARGS[i + 1] : null;
})();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// 相容 GOOGLE_PLACES_API_KEY（前端命名）與 GOOGLE_MAPS_API_KEY（後端命名）
// .trim().replace 強制剝除 .env 雙引號/單引號污染與隱形空白
const sanitize = (v) => (v ? v.replace(/^["']|["']$/g, '').trim() : null);
const GOOGLE_KEY        = sanitize(process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY);
const GOOGLE_NEW_KEY    = sanitize(process.env.GOOGLE_PLACES_NEW_API_KEY);
const USE_NEW_PLACES_API = !!GOOGLE_NEW_KEY;  // 偵測到新版 Key → 強制切換新版協議
const GEMINI_KEY        = process.env.GEMINI_API_KEY;
const BUCKET       = 'spots-images';
const sleep        = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_KEY');
if (!GEMINI_KEY)  throw new Error('缺少 GEMINI_API_KEY — 請在 .env.local 加上 GEMINI_API_KEY=...');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai       = new GoogleGenAI({ apiKey: GEMINI_KEY });

// ─── Phase 1A：交通部觀光署開放資料 (台東景點 / 住宿) ─────────────────────────
const TDX_ENDPOINTS = [
  {
    url: 'https://media.taiwan.net.tw/XMLReleaseALL_public/scenic_spot_C_f.json',
    category: '景點',
    nameField: 'Name',
    descField: 'Description',
    latField: 'Py',
    lngField: 'Px',
    addrField: 'Add',
    photoField: 'Picture1',
    regionField: 'City',
  },
  {
    url: 'https://media.taiwan.net.tw/XMLReleaseALL_public/hotel_C_f.json',
    category: '住宿',
    nameField: 'Hotelname',
    descField: 'Description',
    latField: 'Py',
    lngField: 'Px',
    addrField: 'Add',
    photoField: 'Picture1',
    regionField: 'City',
  },
];

async function fetchTaiwanOpenData(endpoint) {
  console.log(`  [OpenData] 下載 ${endpoint.category} 資料集...`);
  const res = await fetch(endpoint.url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const items = Array.isArray(json) ? json : (json.XML_Head?.Infos?.Info ?? []);

  // 僅保留台東縣資料
  const taitung = items.filter((item) => {
    const addr = (item[endpoint.addrField] ?? '') + (item[endpoint.regionField] ?? '');
    return addr.includes('台東') || addr.includes('臺東');
  });

  console.log(`    → 台東 ${endpoint.category}: ${taitung.length} 筆`);
  return taitung.map((item) => ({
    name:            item[endpoint.nameField]?.trim() ?? '',
    category:        endpoint.category,
    address:         item[endpoint.addrField]?.trim() ?? '',
    lat:             parseFloat(item[endpoint.latField]) || null,
    lng:             parseFloat(item[endpoint.lngField]) || null,
    description_raw: item[endpoint.descField]?.trim() ?? '',
    photo_url_raw:   item[endpoint.photoField]?.trim() ?? null,
    source:          'taiwan_opendata',
  })).filter((r) => r.name.length > 0);
}

// ─── Phase 1B：Google Places Text Search (台東美食 / 補充景點) ───────────────
// 清掉 Google Places 店名常見後綴：(xxx)、（xxx）、|xxx、｜xxx
function cleanShopName(name) {
  if (!name) return '';
  return name.replace(/[（\x28|｜].*$/g, '').trim();
}

const GOOGLE_SEARCHES = [
  { category: '美食', keyword: '台東 特色餐廳 在地美食' },
  { category: '美食', keyword: '台東 咖啡廳 甜點 特色' },
  { category: '美食', keyword: '台東 小吃 夜市 在地' },
  { category: '景點', keyword: '台東 特色景點 必去' },
  { category: '景點', keyword: '台東 海岸 步道 自然' },
];

async function fetchGoogleTextSearch(keyword) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', keyword);
  url.searchParams.set('language', 'zh-TW');
  url.searchParams.set('region', 'tw');
  url.searchParams.set('key', GOOGLE_KEY);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`    [Places Legacy] "${keyword}" → ${data.status}`);
    return [];
  }
  return (data.results ?? []).slice(0, 8);
}

// ─── Places API (New) — POST Text Search ─────────────────────────────────────
// 回傳格式已映射回舊版結構 { name, address, lat, lng }，下游無感知
async function fetchGoogleTextSearchNew(keyword) {
  try {
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: keyword },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_NEW_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
        timeout: 10000,
      },
    );
    return (response.data.places ?? []).slice(0, 8).map((place) => ({
      name:    cleanShopName(place.displayName?.text ?? ''),
      address: place.formattedAddress?.trim()  ?? '',
      lat:     place.location?.latitude         ?? null,
      lng:     place.location?.longitude        ?? null,
    }));
  } catch (err) {
    const status = err.response?.status ?? 'network error';
    const detail = err.response?.data?.error?.message ?? err.message;
    console.warn(`    [Places New] "${keyword}" → ${status}: ${detail}`);
    return [];
  }
}

async function fetchGooglePlaceDetails(placeId) {
  const fields = 'name,formatted_address,geometry,opening_hours,photos,types';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=zh-TW&key=${GOOGLE_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  return data.result ?? null;
}

async function collectGooglePlaces() {
  const results = [];
  const apiLabel = USE_NEW_PLACES_API ? 'Places API (New)' : 'Places API (Legacy)';

  for (const { category, keyword } of GOOGLE_SEARCHES) {
    if (CAT_FILTER && category !== CAT_FILTER) continue;
    console.log(`  [${apiLabel}] 搜尋 [${category}] "${keyword}"...`);

    if (USE_NEW_PLACES_API) {
      // ── 新版：一次 POST 取回所有欄位，不需 Details 補充呼叫 ───────────────
      const places = await fetchGoogleTextSearchNew(keyword);
      for (const p of places) {
        if (!p.name) continue;
        results.push({
          name:            p.name,
          category,
          address:         p.address,
          lat:             p.lat,
          lng:             p.lng,
          description_raw: '',
          photo_ref:       null,   // 新版 FieldMask 未請求 photos
          google_types:    [],
          source:          'google_places_new',
        });
      }
      await sleep(500);
    } else {
      // ── 舊版：Text Search → Details 二段式 ───────────────────────────────
      const places = await fetchGoogleTextSearch(keyword);
      await sleep(500);
      for (const p of places) {
        const details = await fetchGooglePlaceDetails(p.place_id);
        if (!details) continue;
        results.push({
          name:            cleanShopName(details.name ?? ''),
          category,
          address:         details.formatted_address?.trim() ?? '',
          lat:             details.geometry?.location?.lat ?? null,
          lng:             details.geometry?.location?.lng ?? null,
          description_raw: '',
          photo_ref:       details.photos?.[0]?.photo_reference ?? null,
          google_types:    details.types ?? [],
          source:          'google_places',
        });
        await sleep(300);
      }
      await sleep(800);
    }
  }
  console.log(`  → Google Places 合計 ${results.length} 筆`);
  return results;
}

// ─── Phase 1C：手工秘境種子 ────────────────────────────────────────────────────
const CURATED_SECRETS = [
  {
    name: '知本野溪溫泉',
    address: '台東縣卑南鄉溫泉村知本溫泉區上游野溪',
    lat: 22.697, lng: 121.001,
    description_raw: '知本溫泉上游山林中散落的天然碳酸氫鈉泉，無色透明，沿途需涉水溯溪三十分鐘，以山溪聲為背景入浴，無人工設施。',
  },
  {
    name: '多良野溪溫泉',
    address: '台東縣太麻里鄉多良村海濱礫石灘',
    lat: 22.505, lng: 120.958,
    description_raw: '南迴公路旁隱藏的海岸野溪溫泉，溫熱泉水在礫石灘與太平洋交會，月圓大潮時可仰望繁星泡湯，難以言說的壯闊。',
  },
  {
    name: '嘉明湖',
    address: '台東縣海端鄉利稻村嘉明湖國家步道',
    lat: 23.292, lng: 121.038,
    description_raw: '海拔三三一○公尺的高山湖泊，需跋涉兩天方能抵達。清晨薄霧瀰漫，湛藍湖面如鏡，是台灣最接近天空的秘境之一。',
  },
  {
    name: '都蘭部落秘徑',
    address: '台東縣東河鄉都蘭村都蘭山麓',
    lat: 22.983, lng: 121.250,
    description_raw: '都蘭山腳下阿美族聖山稜線古道，林間百年茄苳與野生山豬蹤跡，少有外人知曉的森林密徑，需嚮導帶路方能進入。',
  },
  {
    name: '三和野溪溫泉',
    address: '台東縣卑南鄉太平村利嘉林道深處',
    lat: 22.788, lng: 121.082,
    description_raw: '利嘉林道深處的碳酸泉，需越野車行進泥土山路方能抵達，林間薄霧與溪石之間泡湯，是台東最清幽的野外沐浴體驗。',
  },
  {
    name: '石梯坪潮間帶',
    address: '台東縣豐濱鄉港口村石梯坪',
    lat: 23.574, lng: 121.488,
    description_raw: '東海岸最完整的潮間帶生態系，珊瑚礁、海葵、寄居蟹與礁岩魚類。退潮時大量海蝕壺穴裸露，是天然的生態教室。',
  },
  {
    name: '加路蘭漂流木海岸',
    address: '台東縣台東市加路蘭海岸',
    lat: 22.791, lng: 121.199,
    description_raw: '颱風後漂流木堆積礫石灘形成的自然地景裝置，隨季節面貌更迭，傍晚橘紅夕陽將木頭與海面一同燃燒成金。',
  },
  {
    name: '蘭嶼朗島部落夜間浮潛',
    address: '台東縣蘭嶼鄉朗島村海域',
    lat: 22.077, lng: 121.541,
    description_raw: '朗島部落外海礁盤，夜間螢光浮游生物環繞珊瑚礁，飛魚季時魚群穿梭照明光束，蘭嶼達悟族私房的深夜海洋。',
  },
  {
    name: '綠島朝日溫泉',
    address: '台東縣綠島鄉中寮村海邊',
    lat: 22.660, lng: 121.478,
    description_raw: '全球三處海底湧出的海岸溫泉之一。朝日未出之際獨坐礁石泡湯，蒼茫太平洋在眼前緩緩甦醒，鹽味與硫磺味混合成獨特的海洋溫泉體驗。',
  },
  {
    name: '新武呂溪泛舟秘道',
    address: '台東縣海端鄉新武呂溪上游',
    lat: 23.201, lng: 121.175,
    description_raw: '海端鄉山地部落入口的中央山脈溪谷，水色翠綠如玉，兩岸峭壁聳立，非商業泛舟路線，需自備裝備與嚮導許可。',
  },
];

// ─── Phase 2：圖片下載與上傳 Supabase Storage ──────────────────────────────────
async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) { console.warn('[Storage] 無法列出 bucket，跳過建立步驟'); return; }
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr) console.warn(`[Storage] bucket 建立失敗（可能已存在）：${createErr.message}`);
    else console.log(`[Storage] bucket "${BUCKET}" 已建立`);
  }
}

async function downloadBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToSupabase(buffer, ext = 'jpg') {
  const filename = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: `image/${ext}`, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function resolveImageUrl(raw) {
  if (SKIP_IMG || !raw) return null;
  try {
    const buffer = await downloadBuffer(raw);
    return await uploadToSupabase(buffer);
  } catch (err) {
    console.warn(`      [Image] 上傳失敗 (${err.message.slice(0, 60)})`);
    return null;
  }
}

// Google Places 照片 → Supabase
async function resolveGooglePhoto(photoRef) {
  if (SKIP_IMG || !photoRef) return null;
  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=900&photo_reference=${photoRef}&key=${GOOGLE_KEY}`;
  return resolveImageUrl(googleUrl);
}

// ─── Phase 3：Gemini AI 清洗 ──────────────────────────────────────────────────
const GEMINI_PROMPT = (item) => `
你是在台東生活多年、皮膚曬得黝黑的在地策展人。你不寫觀光文案，你是坐在太平洋海灘旁、或是部落火堆邊，把秘密說給好朋友聽。
請根據下列原始地點資訊，輸出嚴格符合 JSON 格式的物件，不得有任何額外文字或 markdown。

原始資訊：
名稱：${item.name}
地址：${item.address ?? ''}
輸入分類：${item.category}
原始描述：${item.description_raw ?? '（無）'}
Google 標籤：${(item.google_types ?? []).join(', ')}

輸出 JSON（所有欄位必填，不可省略）：
{
  "spot_type": 嚴格限定為 "景點" | "美食" | "秘境" | "住宿" 之一（僅供內部路由，不存入 DB）,
  "category": 根據地址判斷，嚴格限定為 "city" | "sea" | "mtn" 之一（存入 DB category 欄位，不可使用其他值）,
  "description": 【見下方文風規則】,
  "wild_tags": 2-4 個標籤陣列，從以下選擇：野外冒險、山林靜謐、海岸療癒、部落文化、溫泉浸泡、日出日落、在地小吃、手作工藝、生態探索、夜間體驗、親子友善、情侶首選、攝影聖地、歷史文化、秘境探訪
}

━━ description 文風規則（違反任一條，視為回傳失敗）━━
1. 字數：繁體中文，20–30 字左右，不強求對仗，要像人話，像朋友在說秘密。
2. 嚴禁封印詞彙：絕對禁用「滌淨塵囂、凝視蒼穹、湛藍深邃、微鹹交融、低語、靜謐、穿梭、孤寂」，這些詞太像教科書，在台東沒有人會這樣講話。
3. 同樣禁止：「風景優美、十分好玩、值得一遊、必打卡、熱門、推薦、距離XX公里、旅客」等觀光局公文語氣。
4. 生活感細節：多用真正有溫度的詞，例如「海風黏黏的」「柴火味」「老人家說」「光腳踩著」「滾燙」「冰涼」「屁股坐在」「手撕開」「直接噴出來」。
5. 野性口吻：真誠、接地氣、帶點野性，可以有短句、可以有動作，不說教、不解釋、不行銷。

在地帶路人範例（學習口吻，禁止直接抄用）：
- 秘境 → 「在峽谷溪床裡自己挖的溫泉。屁股坐在熱呼呼的溪石上，耳邊只有溪水暴力的聲音，躺著就能看星星。」
- 秘境 → 「帶一罐啤酒來。吹著黏黏的海風、泡著滾燙的泉水，前面就是太平洋在拍打礫石的聲音。」
- 美食 → 「海岸公路旁大排長龍的柴火煙囪味。手撕開老麵，在地溫體豬肉的滾燙肉汁直接噴出來。」
- 景點 → 「不要中午來，太陽會曬到你頭昏。傍晚躺在草皮上吹海風，看浪花拍打漂流木，那才叫台東的節奏。」

━━ category 地區代碼規則（共三個合法值）━━
台東市/卑南/市區 → "city"
東河/成功/長濱/豐濱/東海岸 → "sea"
鹿野/關山/池上/海端/延平/縱谷/山區 → "mtn"
太麻里/大武/達仁/金峰 → "sea"（南迴海岸線，歸入 sea）
南迴線景點 → 依地形判斷：臨海者 "sea"，近山者 "mtn"
綠島/蘭嶼/小蘭嶼 → "sea"（離島皆歸入 sea）
地址不明時，依常識推斷最接近的三個代碼之一，絕對不可輸出 "rail" 或 "islands"。
`.trim();

// 503 過載偵測：Gemini SDK 的錯誤訊息通常包含 "503" 或 "overloaded"
function is503(err) {
  return /503|overloaded|overload|service\s+unavailable/i.test(err?.message ?? '');
}

async function enrichWithGemini(item, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: GEMINI_PROMPT(item),
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(result.text);
      // 防呆：確保必要欄位存在（spot_type + category 是路由與 DB 寫入的關鍵）
      if (!parsed.spot_type || !parsed.category || !parsed.description) {
        throw new Error('Gemini 回傳欄位不完整');
      }
      // 確保 category 是合法代碼（僅允許三個值）
      const validCats = ['city', 'sea', 'mtn'];
      if (!validCats.includes(parsed.category)) {
        throw new Error(`Gemini 回傳非法 category 代碼：${parsed.category}（只允許 city / sea / mtn）`);
      }
      return parsed;
    } catch (err) {
      if (attempt === retries) throw err;
      // 503 過載 → 等更久（60s / 120s）；其他錯誤 → 線性退避（30s / 60s）
      const wait = is503(err)
        ? Math.min(attempt * 60000, 120000)
        : attempt * 30000;
      const tag = is503(err) ? '[Gemini 503 過載]' : '[Gemini 錯誤]';
      console.warn(`      ${tag} retry ${attempt}/${retries}，等待 ${wait / 1000}s... (${err.message.slice(0, 60)})`);
      await sleep(wait);
    }
  }
}

// ─── Phase 4：寫入 Supabase spots 表 ─────────────────────────────────────────
// 根據 spot_type 路由到正確資料表
// 美食 → public.food | 其他 (景點/秘境/住宿) → public.places
function resolveTable(spotType) {
  return spotType === '美食' ? 'food' : 'places';
}

// 台東市區中心點，作為 places 表 lat/lng NOT NULL 的最後防線
const TAITUNG_DEFAULT_LAT = 22.756;
const TAITUNG_DEFAULT_LNG = 121.152;

// food 表 payload — 嚴格對齊 food schema
function buildFoodRecord(raw, enriched, imageUrl) {
  return {
    name:        raw.name,
    description: enriched.description,
    category:    enriched.category,
    lat:         raw.lat ?? null,
    lng:         raw.lng ?? null,
    wild_tags:   enriched.wild_tags ?? [],
    image_url:   imageUrl ?? null,
  };
}

// places 表 payload — 嚴格對齊 places schema（lat/lng NOT NULL，不可傳 null）
function buildPlacesRecord(raw, enriched, imageUrl) {
  const lat = (typeof raw.lat === 'number' && !isNaN(raw.lat))
    ? raw.lat : TAITUNG_DEFAULT_LAT;
  const lng = (typeof raw.lng === 'number' && !isNaN(raw.lng))
    ? raw.lng : TAITUNG_DEFAULT_LNG;
  if (lat === TAITUNG_DEFAULT_LAT || lng === TAITUNG_DEFAULT_LNG) {
    console.warn(`      [⚠ 座標防呆] ${raw.name} 無有效座標，使用台東市預設中心點`);
  }
  return {
    name:        raw.name,
    description: enriched.description,
    category:    enriched.category,
    lat,
    lng,
    wild_tags:   enriched.wild_tags ?? [],
    image_url:   imageUrl ?? null,
  };
}

async function upsertRecord(raw, enriched, imageUrl) {
  const table  = resolveTable(enriched.spot_type);
  const record = table === 'food'
    ? buildFoodRecord(raw, enriched, imageUrl)
    : buildPlacesRecord(raw, enriched, imageUrl);

  if (DRY_RUN) {
    console.log(`      [DRY-RUN] → ${table} | ${record.name} [${record.category}]`);
    return { table, record };
  }
  const { error } = await supabase
    .from(table)
    .upsert(record, { onConflict: 'name' });
  if (error) throw new Error(`[${table}] ${error.message}`);
  return { table, record };
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌿 野台東資料自動化產線啟動');
  if (DRY_RUN)    console.log('   ⚠️  DRY-RUN 模式，不寫入資料庫');
  if (SKIP_IMG)   console.log('   ⚠️  --skip-images，跳過圖片下載');
  if (CAT_FILTER) console.log(`   → 僅處理類別：${CAT_FILTER}`);
  console.log('');

  // ── 環境變數健康檢查 ──────────────────────────────────────────────────────
  console.log('🔑 [環境變數檢查]');
  console.log(`   GOOGLE_PLACES_NEW_API_KEY : ${GOOGLE_NEW_KEY ? '已偵測到 ✓ (優先使用新版 API)' : '未讀取到 ✗'}`);
  console.log(`   GOOGLE_PLACES_API_KEY     : ${process.env.GOOGLE_PLACES_API_KEY ? '已偵測到 ✓' : '未讀取到 ✗'}`);
  console.log(`   GOOGLE_MAPS_API_KEY       : ${process.env.GOOGLE_MAPS_API_KEY   ? '已偵測到 ✓' : '未讀取到 ✗'}`);
  console.log(`   GEMINI_API_KEY            : ${process.env.GEMINI_API_KEY        ? '已偵測到 ✓' : '未讀取到 ✗'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_URL  : ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '已偵測到 ✓' : '未讀取到 ✗'}`);
  if (!GOOGLE_NEW_KEY && !GOOGLE_KEY) {
    console.error('\n❌ 找不到任何 Google API Key！請確認 .env 內有設定 GOOGLE_PLACES_NEW_API_KEY（新版）或 GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY（舊版）。');
    process.exit(1);
  }
  const googleKeySrc = USE_NEW_PLACES_API
    ? 'GOOGLE_PLACES_NEW_API_KEY → Places API (New) POST Text Search'
    : (process.env.GOOGLE_PLACES_API_KEY ? 'GOOGLE_PLACES_API_KEY' : 'GOOGLE_MAPS_API_KEY') + ' → Places API (Legacy)';
  console.log(`   → 實際使用：${googleKeySrc}\n`);

  if (!DRY_RUN) await ensureBucket();

  // ── 收集所有原始資料 ──────────────────────────────────────────────────────
  const allRaw = [];

  console.log('📡 Phase 1：收集原始資料');

  // 1A. 觀光署開放資料
  for (const endpoint of TDX_ENDPOINTS) {
    if (CAT_FILTER && endpoint.category !== CAT_FILTER) continue;
    try {
      const items = await fetchTaiwanOpenData(endpoint);
      allRaw.push(...items);
    } catch (err) {
      console.warn(`  [OpenData] ${endpoint.category} 失敗：${err.message}`);
    }
    await sleep(1000);
  }

  // 1B. Google Places
  if (!CAT_FILTER || ['美食', '景點'].includes(CAT_FILTER)) {
    const googleItems = await collectGooglePlaces();
    allRaw.push(...googleItems);
  }

  // 1C. 手工秘境
  if (!CAT_FILTER || CAT_FILTER === '秘境') {
    for (const s of CURATED_SECRETS) {
      allRaw.push({ ...s, category: '秘境', google_types: [], source: 'curated' });
    }
    console.log(`  [Curated] 秘境種子：${CURATED_SECRETS.length} 筆`);
  }

  // 去重（以名稱為準）
  const seen = new Set();
  const deduplicated = allRaw.filter((r) => {
    if (!r.name || seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });

  console.log(`\n合計原始資料 ${deduplicated.length} 筆（去重後）\n`);

  // ── 逐筆清洗、上傳圖片、寫入 ──────────────────────────────────────────────
  console.log('🧠 Phase 2-4：AI 清洗 → 圖片上傳 → 資料庫寫入\n');
  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < deduplicated.length; i++) {
    const raw = deduplicated[i];
    console.log(`[${String(i + 1).padStart(3)}/${deduplicated.length}] ${raw.name}`);

    try {
      // Gemini 清洗
      const enriched = await enrichWithGemini(raw);

      // 圖片：Google Places photo_ref 優先，fallback 到 opendata photo_url_raw
      const imageUrl = raw.photo_ref
        ? await resolveGooglePhoto(raw.photo_ref)
        : await resolveImageUrl(raw.photo_url_raw ?? null);

      const { table, record } = await upsertRecord(raw, enriched, imageUrl);
      const imgFlag = imageUrl ? ' 🖼' : '';
      console.log(`      ✅  → ${table} [${record.category}]${imgFlag}`);
      console.log(`      ✍️  引言：「${record.description}」`);
      success++;
    } catch (err) {
      console.error(`      ❌ 失敗：${err.message}`);
      failed++;
    }

    // Gemini rate-limit 緩衝
    await sleep(1200);
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`🎉 完成！成功 ${success} 筆 ｜ 跳過 ${skipped} 筆 ｜ 失敗 ${failed} 筆`);
  if (DRY_RUN) console.log('   （DRY-RUN 模式，以上皆未實際寫入）');
}

main().catch((err) => {
  console.error('\n❌ 產線中斷：', err.message);
  process.exit(1);
});
