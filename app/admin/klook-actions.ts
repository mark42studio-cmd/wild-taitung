'use server'

import { GoogleGenAI } from '@google/genai'
import { createServerClient } from '@/lib/supabase'

// ── 常數（與 backend/generate_images.py 保持一致）───────────────────────────

const STORAGE_BUCKET = 'wild-taitung-assets'
const TEXT_MODEL     = 'gemini-2.5-flash-lite'
const IMAGE_MODEL    = 'gemini-2.5-flash-image'

const STYLE_SUFFIX =
  'pure illustration, completely textless, no signs, no writing of any kind, ' +
  'focus on the main subject and atmosphere only, ' +
  'watercolor travel illustration style, warm natural lighting, ' +
  'vibrant colors, high quality'

const ANTI_TEXT_DIRECTIVE =
  '[CRITICAL RULE: ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO SIGNBOARDS, ' +
  'NO WATERMARKS, NO LOGOS, NO CAPTIONS, NO NUMBERS. PURE ILLUSTRATION ONLY.]'

const PROMPT_SYSTEM_INSTRUCTION = `
你是一個台灣旅遊 App 的 AI 插畫 Prompt 工程師。
根據提供的商品名稱與類別，生成一段精確的英文視覺描述供 AI 繪圖使用。

【絕對規則】
1. 回傳內容只能是英文，不含任何中文、日文或其他非英文字符
2. 禁止在 prompt 中出現任何招牌文字、店名、品牌名或 Logo 描述
3. 禁止使用 "sign", "text", "label", "banner", "menu" 等字詞
4. 只回傳 prompt 本身，不加任何解釋、標籤或 Markdown 格式
5. 長度控制在 25–55 個英文字之間

【內容規則】
- ticket（門票）：描述入場體驗場景、建築外觀或自然地貌、光線氛圍
- activity（體驗活動）：描述戶外活動場景（海、山、河、文化）、人物動態感
- multi_day（多日行程）：描述台灣多元地貌的旅途風景
`.trim()

// ── 公開型別定義 ──────────────────────────────────────────────────────────────

export interface KlookParseResult {
  title: string
  price: string
  category: 'ticket' | 'activity' | 'multi_day'
  affiliateUrl: string
  imageUrl: string
}

export interface KlookSavePayload extends KlookParseResult {
  sourceUrl: string
}

export interface PlaceSuggestion {
  id: string
  name: string
}

export interface ActionResult {
  success: boolean
  error?: string
}

// ── Server Action：AI 文字解析 ─────────────────────────────────────────────

export async function parseAffiliateData(
  sourceUrl: string,
  rawText: string,
  imageUrl: string,
): Promise<KlookParseResult> {
  if (!sourceUrl.trim()) throw new Error('請填寫原始網址')
  if (!rawText.trim())   throw new Error('請貼上網頁內容')

  const affiliateUrl = buildAffiliateUrl(sourceUrl)
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const prompt = `
你是一個資料萃取機器人。請從以下 Klook 商品頁面文字中提取三個欄位，嚴格以 JSON 格式回傳，不得包含任何說明文字或 markdown：

JSON Schema：
{
  "title": "精煉後的商品名稱（繁體中文，去除多餘的平台前綴或促銷詞）",
  "price": "最低價格字串，例如 'NT$1,200' 或 '¥800'，若找不到填 '價格未知'",
  "category": "只能是 'ticket'（門票/入場券）、'activity'（單日體驗活動）、'multi_day'（多日行程）其中之一"
}

--- 商品頁面文字 ---
${rawText.slice(0, 8000)}
`.trim()

  let parsed: { title: string; price: string; category: string }

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    })
    parsed = JSON.parse(response.text ?? '{}')
  } catch (err) {
    console.error('[parseAffiliateData] Gemini 解析失敗:', err)
    throw new Error('AI 解析失敗，請確認 GEMINI_API_KEY 有效且內容不為空')
  }

  const validCategories = ['ticket', 'activity', 'multi_day'] as const
  const category = validCategories.includes(parsed.category as any)
    ? (parsed.category as KlookParseResult['category'])
    : 'activity'

  return {
    title:    parsed.title || '（未能解析標題）',
    price:    parsed.price || '價格未知',
    category,
    affiliateUrl,
    imageUrl: imageUrl.trim(),
  }
}

// ── Server Action：寫入資料庫（含 AI 手繪圖重繪）─────────────────────────
//
// 永不 throw。所有錯誤均以 { success: false, error } 回傳，
// 確保 Next.js Server Action 序列化不會崩潰產生 500。
//
// klook_products 欄位（已確認存在）：
//   id            int8  BIGSERIAL 自動遞增，不需傳入
//   title         text
//   price         text
//   affiliate_url text  unique — upsert ON CONFLICT 依據
//   category      text  ('ticket' | 'activity' | 'multi_day')
//   image_url     text  AI 重繪後的 Storage URL，或降級時的原始 Klook URL

export async function saveAffiliateData(
  payload: KlookSavePayload,
): Promise<ActionResult> {
  try {
    const sb = createServerClient()
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    // ── 圖像重繪管線（任何失敗只降級，絕不影響 DB 寫入）──────────────────
    let finalImageUrl: string | null = payload.imageUrl || null

    if (payload.imageUrl) {
      try {
        const visualPrompt = await buildProductVisualPrompt(ai, payload.title, payload.category)
        const imageBuffer  = await generateStyledImageBytes(ai, visualPrompt, payload.imageUrl)

        if (imageBuffer) {
          const storageUrl = await uploadImageToStorage(sb, imageBuffer)
          if (storageUrl) {
            finalImageUrl = storageUrl
          } else {
            console.warn('[saveAffiliateData] Storage 上傳失敗，降級保留原始 imageUrl')
          }
        } else {
          console.warn('[saveAffiliateData] AI 圖片生成失敗，降級保留原始 imageUrl')
        }
      } catch (imgErr) {
        console.error('[saveAffiliateData] 圖像管線例外，跳過重繪:', imgErr)
      }
    }

    // ── 寫入資料庫 ─────────────────────────────────────────────────────────
    const { error } = await sb
      .from('klook_products')
      .upsert(
        {
          title:         payload.title,
          price:         payload.price,
          affiliate_url: payload.affiliateUrl,
          category:      payload.category,
          image_url:     finalImageUrl,
        },
        { onConflict: 'affiliate_url' },
      )

    if (error) {
      console.error('[saveAffiliateData] Supabase 寫入失敗:', error)
      return { success: false, error: `資料庫寫入失敗：${error.message}` }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知錯誤'
    console.error('[saveAffiliateData] 頂層例外:', err)
    return { success: false, error: msg }
  }
}

// ── Server Action：模糊搜尋相符景點 ──────────────────────────────────────────

export async function findMatchingPlaces(
  klookTitle: string,
): Promise<PlaceSuggestion[]> {
  const sb = createServerClient()
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  let keyword = klookTitle.slice(0, 8)

  try {
    const resp = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `從以下 Klook 商品名稱中，只萃取最核心的景點或地點名稱（繁體中文，2–8個字）。只回傳景點名稱本身，不含任何標點或說明。\n商品名稱：${klookTitle}`,
      config: { maxOutputTokens: 20, temperature: 0.1 },
    })
    const raw = (resp.text ?? '').trim().replace(/[「」。，、\s]/g, '')
    if (raw) keyword = raw.slice(0, 20)
  } catch {
    // fallback: 取商品名前 6 個字
  }

  const { data, error } = await sb
    .from('places')
    .select('id, name')
    .ilike('name', `%${keyword}%`)
    .limit(5)

  if (error || !data) {
    console.warn('[findMatchingPlaces] 查詢失敗或無結果:', error?.message)
    return []
  }

  return data.map(p => ({ id: String(p.id), name: p.name as string }))
}

// ── Server Action：取得所有景點（供前端下拉選單）────────────────────────────

export async function fetchAllPlaces(): Promise<PlaceSuggestion[]> {
  const sb = createServerClient()
  const { data, error } = await sb
    .from('places')
    .select('id, name')
    .order('name')

  if (error || !data) {
    console.warn('[fetchAllPlaces] 查詢失敗:', error?.message)
    return []
  }

  return data.map(p => ({ id: String(p.id), name: p.name as string }))
}

// ── Server Action：將 Klook 分潤 URL 綁定至指定景點 ──────────────────────────
//
// 直接寫入 places.affiliate_link (text)，單一欄位，永不 throw。

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function bindKlookToPlace(
  placeId: string,
  affiliateUrl: string,
): Promise<ActionResult> {
  // 防止將 klook_products.id (bigint) 誤傳為 places.id (uuid)
  if (!placeId || !UUID_RE.test(placeId)) {
    console.error('[bindKlookToPlace] UUID 格式錯誤，收到:', placeId)
    return { success: false, error: `無效的景點 ID 格式：${placeId}（必須是 UUID）` }
  }
  if (!affiliateUrl) {
    return { success: false, error: '分潤連結不可為空' }
  }

  console.log('[後台寫入測試] 正在往景點 ID:', placeId, '灌入網址:', affiliateUrl)

  try {
    const sb = createServerClient()

    const { error: updateErr } = await sb
      .from('places')
      .update({ affiliate_link: affiliateUrl })
      .eq('id', placeId)

    if (updateErr) {
      console.error('[bindKlookToPlace] Supabase 更新失敗:', updateErr.message, updateErr.details)
      return { success: false, error: `景點綁定失敗：${updateErr.message}` }
    }

    console.log('[bindKlookToPlace] ✓ 寫入成功，placeId:', placeId)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知錯誤'
    console.error('[bindKlookToPlace] 頂層例外:', err)
    return { success: false, error: msg }
  }
}

// ── 私有 Helpers ─────────────────────────────────────────────────────────────

async function buildProductVisualPrompt(
  ai: GoogleGenAI,
  title: string,
  category: string,
): Promise<string> {
  const categoryLabel: Record<string, string> = {
    ticket:    '門票/入場體驗',
    activity:  '單日戶外體驗活動',
    multi_day: '多日台灣旅行行程',
  }
  const label = categoryLabel[category] ?? '旅遊體驗'

  try {
    const resp = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `類別：${label}\n商品名稱：${title}`,
      config: {
        systemInstruction: PROMPT_SYSTEM_INSTRUCTION,
        temperature: 0.75,
        maxOutputTokens: 150,
      },
    })
    let raw = (resp.text ?? '').trim()
    raw = raw.replace(/```[a-z]*\n?/g, '').replace(/`/g, '').trim()
    raw = raw.replace(/[一-鿿　-〿＀-￯]+/g, '').trim()
    if (raw) return `${raw}, ${STYLE_SUFFIX} ${ANTI_TEXT_DIRECTIVE}`
  } catch (err) {
    const is503 = String(err).includes('503')
    if (is503) {
      console.warn('[buildProductVisualPrompt] Gemini 503 過載，降級至 fallback prompt')
    } else {
      console.error('[buildProductVisualPrompt] Gemini text 失敗:', err)
    }
  }

  return `scenic travel activity in Taitung Taiwan, adventure and nature, ${STYLE_SUFFIX} ${ANTI_TEXT_DIRECTIVE}`
}

async function generateStyledImageBytes(
  ai: GoogleGenAI,
  prompt: string,
  sourceImageUrl?: string,
): Promise<Buffer | null> {
  let contents: unknown = prompt

  if (sourceImageUrl) {
    try {
      const imgRes = await fetch(sourceImageUrl, {
        signal: AbortSignal.timeout(10_000),
      })
      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer()
        const base64   = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = imgRes.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
        contents = [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: `Redraw in this exact illustration style: ${prompt}` },
            ],
          },
        ]
      }
    } catch (fetchErr) {
      console.warn('[generateStyledImageBytes] 來源圖片取得失敗，改用純文字生成:', fetchErr)
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: contents as any,
      config: { responseModalities: ['IMAGE'] },
    })

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64')
      }
    }

    console.warn('[generateStyledImageBytes] 模型未回傳圖片內容')
    return null
  } catch (err) {
    console.error('[generateStyledImageBytes] 圖片生成失敗:', err)
    return null
  }
}

async function uploadImageToStorage(
  sb: ReturnType<typeof createServerClient>,
  imageBuffer: Buffer,
): Promise<string | null> {
  const hex      = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const filePath = `klook_products/${hex}.png`

  try {
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (error) {
      console.error('[uploadImageToStorage] Supabase Storage 上傳失敗:', error)
      return null
    }

    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
    return data.publicUrl
  } catch (err) {
    console.error('[uploadImageToStorage] 上傳過程例外:', err)
    return null
  }
}

// ── URL Helper ───────────────────────────────────────────────────────────────

// 使用 Klook 官方分潤跳轉格式，encodeURIComponent 確保原始 URL 安全編碼。
function buildAffiliateUrl(rawUrl: string): string {
  return `https://affiliate.klook.com/redirect?aid=119810&aff_adid=1283550&k_site=${encodeURIComponent(rawUrl)}`
}
