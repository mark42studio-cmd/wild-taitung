import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const foodRows = [
  {
    name: '東河包子',
    description: '東河老街人氣包子店，適合海線旅途中補給，招牌肉包與饅頭是許多旅人的台東記憶。',
    district: '東河',
    lat: 22.9692,
    lng: 121.3039,
    type: 'food',
    category: 'sea',
  },
  {
    name: '拉勞蘭小米工坊',
    description: '認識小米文化與部落飲食的工坊據點，可作為南迴旅程的文化與美食停靠點。',
    district: '太麻里',
    lat: 22.5823,
    lng: 120.9921,
    type: 'food',
    category: 'rail',
  },
  {
    name: '藍蜻蜓速食專賣店',
    description: '台東市經典炸雞速食店，在地人與旅人都熟悉的市區美食地標。',
    district: '台東市',
    lat: 22.7539,
    lng: 121.1507,
    type: 'food',
    category: 'city',
  },
  {
    name: '榕樹下米苔目',
    description: '台東市老字號米苔目店，湯頭清爽，適合安排在市區散步與鐵花村周邊行程。',
    district: '台東市',
    lat: 22.7558,
    lng: 121.1502,
    type: 'food',
    category: 'city',
  },
  {
    name: '關山便當',
    description: '山線代表性鐵路便當，適合關山、池上、鹿野一帶行程中作為午餐補給。',
    district: '關山',
    lat: 23.0476,
    lng: 121.1637,
    type: 'food',
    category: 'mtn',
  },
  {
    name: '池上飯包故事館',
    description: '以池上米與鐵路便當文化為主題的景點與餐食據點，可串接山線稻田景觀。',
    district: '池上',
    lat: 23.1245,
    lng: 121.2193,
    type: 'food',
    category: 'mtn',
  },
  {
    name: '鹿野高台',
    description: '台東縱谷制高點，適合安排滑草、熱氣球季與俯瞰山線田野。',
    district: '鹿野',
    lat: 22.9125,
    lng: 121.1215,
    type: 'spot',
    category: 'mtn',
  },
  {
    name: '栗松野溪溫泉',
    description: '山谷裡的野溪溫泉秘境，路程具挑戰性，適合有戶外經驗的旅人。',
    district: '海端',
    lat: 23.1082,
    lng: 121.0792,
    type: 'spot',
    category: 'mtn',
  },
];

const supabase = createClient(supabaseUrl, supabaseKey);
const payload = foodRows.map(({ name, description, lat, lng, type, category }) => ({
  name,
  description,
  lat,
  lng,
  type,
  category,
}));

const { data: existing, error: selectError } = await supabase
  .from('food')
  .select('id, name');

if (selectError) {
  console.error('[seed_food_data] select failed:', selectError.message);
  process.exit(1);
}

const existingByName = new Map((existing ?? []).map((row) => [row.name, row.id]));
const written = [];

for (const row of payload) {
  const id = existingByName.get(row.name);
  if (id) {
    const { data, error } = await supabase
      .from('food')
      .update(row)
      .eq('id', id)
      .select('name, lat, lng, type, category')
      .single();
    if (error) {
      console.error(`[seed_food_data] update failed: ${row.name}`, error.message);
      process.exit(1);
    }
    written.push(data);
  } else {
    const { data, error } = await supabase
      .from('food')
      .insert([row])
      .select('name, lat, lng, type, category')
      .single();
    if (error) {
      console.error(`[seed_food_data] insert failed: ${row.name}`, error.message);
      process.exit(1);
    }
    written.push(data);
  }
}

console.log('[seed_food_data] wrote food rows:', written);
