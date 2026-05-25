import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. 環境變數設定
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleApiKey) {
  console.error("❌ 缺少環境變數，請確認 .env.local 裡有填寫 GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("📍 野台東 AI 座標抓取管線啟動...");

  // 2. 撈出缺少座標的資料
  const { data: items, error } = await supabase
    .from('food') // 如果你的景點放在 spots 表，這裡記得改
    .select('id, name')
    .is('lat', null);

  if (error) {
    console.error("❌ 讀取資料庫失敗:", error);
    return;
  }

  if (!items || items.length === 0) {
    console.log("✨ 所有地點都有座標了，太棒啦！");
    return;
  }

  console.log(`🔍 找到 ${items.length} 筆缺少座標的資料\n`);

  // 3. 呼叫 Google Maps API 抓取座標
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // 強制加上「台東」兩個字，幫助 Google 定位更精準
    const keyword = `台東 ${item.name}`; 
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(keyword)}&key=${googleApiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        // 取得第一筆搜尋結果的經緯度
        const location = data.results[0].geometry.location;
        const lat = location.lat;
        const lng = location.lng;

        // 4. 寫回資料庫
        const { error: updateError } = await supabase
          .from('food')
          .update({ lat, lng })
          .eq('id', item.id);

        if (updateError) throw updateError;
        console.log(`✅ [${i+1}/${items.length}] 成功定位 [${item.name}]: ${lat}, ${lng}`);
      } else {
        console.log(`⚠️ [${i+1}/${items.length}] 找不到座標 [${item.name}]: Google API 狀態 ${data.status}`);
      }
    } catch (err) {
      console.error(`❌ 發生錯誤 [${item.name}]:`, err.message);
    }

    // 休息 1 秒，避免打爆 API 限制
    await sleep(1000); 
  }
}

main();