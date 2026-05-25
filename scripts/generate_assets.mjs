/**
 * generate_assets.mjs — 雙重保險版
 *
 * Step 0: 先呼叫 ListModels API，確認你的 Key 實際可用哪些 Imagen 模型
 * Step 2: 棄用 SDK，改用原生 fetch + :generateImages 端點（非 :predict）
 *
 * 執行方式（在 wildTaitung/ 目錄下）：
 *   node scripts/generate_assets.mjs
 *
 * .env.local 必須包含：
 *   NEXT_PUBLIC_SUPABASE_URL  — Supabase 專案 URL
 *   SUPABASE_SERVICE_KEY      — Service Role Key（繞過 RLS）
 *   GEMINI_API_KEY            — Gemini / Imagen API 金鑰
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Buffer } from 'node:buffer';

dotenv.config({ path: '.env.local' });

// ── 環境變數驗證 ─────────────────────────────────────────────────────────────

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY;

const missing = [];
if (!SUPABASE_URL)         missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
if (!GEMINI_API_KEY)       missing.push('GEMINI_API_KEY');

if (missing.length > 0) {
  console.error('❌ .env.local 缺少以下必要變數：');
  missing.forEach((v) => console.error(`   - ${v}`));
  process.exit(1);
}

// ── 設定 ────────────────────────────────────────────────────────────────────

const TABLE            = 'food';
const BUCKET           = 'wild-taitung-assets';
const FOLDER           = 'assets';
const RATE_LIMIT_DELAY = 5_000;
const PLACEHOLDER_URLS = ['5.webp', '6.webp'];
const PREFERRED_MODEL  = 'imagen-4.0-generate-001'; // 偏好，若 Key 沒有會自動降版

const STYLE_SUFFIX =
  'vintage watercolor illustration, hand-drawn adventure style, bold messy ink outlines, ' +
  'heavy paper texture, distressed and weathered look, earthy color palette, isolated on white ' +
  'background, sticker aesthetic, high contrast, folk art influence.';

// ── 初始化 ───────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ── Step 0：ListModels 偵錯 ──────────────────────────────────────────────────
// 先查清楚你的 Key 到底能用哪些 Imagen 模型，完全避免盲猜模型名稱

async function detectImagenModel() {
  console.log('🔎 查詢 API Key 可用的模型清單（ListModels）...\n');

  const res  = await fetch(`${GENAI_BASE}/models?key=${GEMINI_API_KEY}&pageSize=200`);
  const json = await res.json();

  if (!res.ok) {
    console.error('❌ ListModels API 錯誤：');
    console.error(JSON.stringify(json, null, 2));
    return null;
  }

  const allModels = json.models ?? [];
  console.log(`   API 共回傳 ${allModels.length} 個模型`);

  // 過濾：名稱含 imagen（含 predict 或 generateImages 方法皆算）
  const imagenModels = allModels.filter((m) => {
    const name    = (m.name ?? '').toLowerCase();
    const methods = m.supportedGenerationMethods ?? [];
    return (
      name.includes('imagen') ||
      methods.includes('generateImages') ||
      (name.includes('image') && methods.includes('predict'))
    );
  });

  if (imagenModels.length === 0) {
    console.log('\n' + '⚠'.repeat(2) + ' 警告 ' + '⚠'.repeat(2));
    console.log('你的 API Key 沒有任何 Imagen 生圖模型！');
    console.log('這表示帳戶尚未申請 Imagen 存取權，或 Key 未啟用 Imagen。');
    console.log('\n📋 你目前可用的所有模型（供參考）：');
    allModels.forEach((m) => {
      const methods = (m.supportedGenerationMethods ?? []).join(', ');
      console.log(`   ${m.name.padEnd(55)} [${methods}]`);
    });
    return null;
  }

  console.log(`\n✅ 找到 ${imagenModels.length} 個生圖模型：`);
  imagenModels.forEach((m) => {
    const methods  = (m.supportedGenerationMethods ?? []).join(', ');
    const isTarget = m.name.includes(PREFERRED_MODEL) ? '  ← 偏好選項' : '';
    console.log(`   • ${m.name.padEnd(55)} [${methods}]${isTarget}`);
  });

  // 優先用偏好模型，否則取第一個可用的
  const preferred = imagenModels.find((m) => m.name.includes(PREFERRED_MODEL));
  const selected  = preferred ?? imagenModels[0];
  const modelId   = selected.name.replace(/^models\//, '');

  console.log(`\n🎯 本次將使用：${modelId}\n`);
  return modelId;
}

// ── Step 1：撈出缺圖資料 ──────────────────────────────────────────────────────

async function fetchMissingImages() {
  const placeholderFilter = PLACEHOLDER_URLS
    .map((p) => `image_url.ilike.%${p}`)
    .join(',');

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, description')
    .or(`image_url.is.null,${placeholderFilter}`);

  if (error) throw new Error(`Supabase fetch 失敗：${error.message}`);
  return data ?? [];
}

// ── Step 2：原生 fetch 生圖（:predict 端點，Vertex AI payload 格式）──────────
// Imagen 4.0 透過 ListModels 確認只支援 predict，payload 須用 instances/parameters

async function generateImage(modelId, name, description) {
  const prompt = `${name}: ${description ?? name}。${STYLE_SUFFIX}`;
  console.log(`   📝 Prompt 前 80 字：${prompt.slice(0, 80)}...`);

  // 根據模型支援的方法決定端點
  // imagen-4.0 → :predict；舊版 imagen-3 → :generateImages
  const action   = modelId.includes('imagen-4') ? 'predict' : 'generateImages';
  const endpoint = `${GENAI_BASE}/models/${modelId}:${action}?key=${GEMINI_API_KEY}`;
  console.log(`   🔗 端點：.../${modelId}:${action}`);

  // :predict 端點使用 Vertex AI 風格 payload
  // :generateImages 端點使用扁平結構 payload
  const requestBody = action === 'predict'
    ? {
        instances:  [{ prompt }],
        parameters: { sampleCount: 1 },
      }
    : {
        prompt,
        number_of_images:    1,
        aspect_ratio:        '1:1',
        safety_filter_level: 'block_some',
        person_generation:   'DONT_ALLOW',
      };

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(requestBody),
  });

  // 先讀純文字，避免空回應或 HTML 錯誤頁直接 .json() 當機
  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} - 內容：${rawText}`);
  }

  if (!rawText || rawText.trim() === '') {
    throw new Error('API 回傳空白內容（HTTP 200 但 body 為空）');
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`API 回應無法解析為 JSON，原始內容：${rawText.slice(0, 400)}`);
  }

  // :predict 回應：predictions[0].bytesBase64Encoded
  // :generateImages 回應：generatedImages[0].image.imageBytes
  const b64 =
    json.predictions?.[0]?.bytesBase64Encoded ??
    json.generatedImages?.[0]?.image?.imageBytes;

  if (!b64) {
    throw new Error(
      `API 回傳成功但無影像資料，原始回應：\n${JSON.stringify(json, null, 2).slice(0, 500)}`
    );
  }

  console.log(`   🖼️  圖像生成成功，Base64 長度：${b64.length}`);
  return b64;
}

// ── Step 3：上傳至 Supabase Storage ─────────────────────────────────────────

async function uploadImage(id, b64) {
  const buffer   = Buffer.from(b64, 'base64');
  const filename = `${FOLDER}/spot_${id}_${Date.now()}.jpg`;

  console.log(`   📤 上傳中：${filename}（${(buffer.length / 1024).toFixed(1)} KB）`);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert:      false,
    });

  if (error) throw new Error(`Storage 上傳失敗：${error.message}`);
  return filename;
}

// ── Step 4：取得 Public URL 並更新資料庫 ─────────────────────────────────────

async function updateRecord(id, filename) {
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  const publicUrl = urlData.publicUrl;

  const { error } = await supabase
    .from(TABLE)
    .update({ image_url: publicUrl })
    .eq('id', id);

  if (error) throw new Error(`DB 更新失敗：${error.message}`);
  return publicUrl;
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 野台東 AI 插畫生成管線啟動（雙重保險版）');
  console.log(`   目標資料表：${TABLE}  |  Storage：${BUCKET}/${FOLDER}\n`);
  console.log('═'.repeat(50));

  // Step 0：先確認可用的 Imagen 模型
  const modelId = await detectImagenModel();

  if (!modelId) {
    console.error('\n❌ 無可用的 Imagen 生圖模型，流程終止。');
    console.error('   請至 https://aistudio.google.com/ 確認 Imagen 存取權限。');
    process.exit(1);
  }

  console.log('═'.repeat(50));

  // Step 1：撈缺圖資料
  let records;
  try {
    records = await fetchMissingImages();
  } catch (err) {
    console.error(`❌ 無法讀取資料：${err.message}`);
    process.exit(1);
  }

  if (records.length === 0) {
    console.log('✅ 所有資料皆已有圖片，無需補圖。');
    return;
  }

  console.log(`🔍 找到 ${records.length} 筆資料需要生圖\n`);

  let successCount = 0;
  let failCount    = 0;

  for (const record of records) {
    const { id, name, description } = record;
    const index = records.indexOf(record) + 1;

    console.log('─'.repeat(50));
    console.log(`🎨 [${index}/${records.length}] 正在生成：${name}（id: ${id}）`);

    try {
      const b64      = await generateImage(modelId, name, description);
      const filename = await uploadImage(id, b64);
      const url      = await updateRecord(id, filename);

      console.log(`✅ 上傳成功：${url}`);
      successCount++;
    } catch (err) {
      console.error(`⚠️  失敗（${name}）：${err.message}`);
      failCount++;
    }

    if (index < records.length) {
      console.log(`⏳ 等待 ${RATE_LIMIT_DELAY / 1000} 秒（Rate Limit 保護）...\n`);
      await sleep(RATE_LIMIT_DELAY);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`🏁 完成！成功 ${successCount} 筆，失敗 ${failCount} 筆。`);
}

main();
