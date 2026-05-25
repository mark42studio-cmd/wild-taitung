'use server'

import { GoogleGenAI } from '@google/genai'
import { createServerClient } from '@/lib/supabase'
import { getLocalYYYYMMDD } from '@/lib/tripDates'
import type { BuilderDay, CuratedStop } from '@/types'

// ── 公開型別 ──────────────────────────────────────────────────────────────────

export interface AiPlannerInput {
  description: string   // 旅人偏好自由描述
  days: number          // 天數 1–7
  regions: string[]     // 地區偏好（縱谷線 / 東海岸 / 台東市區 / 南迴線）
  foodPrefs: string[]   // 美食偏好
}

export interface AiPlannerResult {
  days: BuilderDay[]
  adventureName: string
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function generateAiItinerary(
  input: AiPlannerInput,
  startDate: string,
): Promise<AiPlannerResult> {
  if (input.days < 1 || input.days > 7) throw new Error('天數必須在 1–7 之間')

  const sb = createServerClient()
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  // ── 1. 從 Supabase 撈取真實景點與美食 ──────────────────────────────────────
  const [{ data: placesRaw, error: pErr }, { data: foodsRaw, error: fErr }] = await Promise.all([
    sb.from('places')
      .select('id, name, description, latitude, longitude, lat, lng, closed_days, wild_tags')
      .limit(60),
    sb.from('food')
      .select('id, name, lat, lng, closed_days')
      .limit(50),
  ])

  if (pErr) console.warn('[generateAiItinerary] places 查詢警告:', pErr.message)
  if (fErr) console.warn('[generateAiItinerary] food 查詢警告:', fErr.message)

  const toNum = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n }

  const places = (placesRaw ?? [])
    .map(p => ({
      id:     String(p.id),
      name:   String(p.name ?? ''),
      lat:    toNum(p.latitude ?? p.lat),
      lng:    toNum(p.longitude ?? p.lng),
      tags:   ((p.wild_tags as string[] | null) ?? []).join(','),
      closed: ((p.closed_days as number[] | null) ?? []).join(',') || '—',
    }))
    .filter(p => p.name && p.lat !== 0 && p.lng !== 0)

  const foods = (foodsRaw ?? [])
    .map(f => ({
      id:     String(f.id),
      name:   String(f.name ?? ''),
      lat:    toNum(f.lat),
      lng:    toNum(f.lng),
      closed: ((f.closed_days as number[] | null) ?? []).join(',') || '—',
    }))
    .filter(f => f.name && f.lat !== 0 && f.lng !== 0)

  if (places.length + foods.length < 5) {
    throw new Error('資料庫景點不足，請先確認 Supabase places / food 表有資料')
  }

  // ── 2. 組裝 Gemini prompt ─────────────────────────────────────────────────
  // 格式：類型(A=景點/F=美食)|id|name|lat|lng|tags|closed
  const catalog = [
    ...places.map(p => `A|${p.id}|${p.name}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}|${p.tags}|closed:${p.closed}`),
    ...foods.map(f  => `F|${f.id}|${f.name}|${f.lat.toFixed(4)}|${f.lng.toFixed(4)}||closed:${f.closed}`),
  ].join('\n')

  const regionStr = input.regions.length > 0 ? input.regions.join('、') : '全台東皆可'
  const foodStr   = input.foodPrefs.length > 0 ? input.foodPrefs.join('、') : '不限'

  const prompt = `
你是一位台東深度旅遊手札策展人。根據旅人需求，從「景點/美食清單」挑選最合適的景點，規劃 ${input.days} 天行程。

【旅人需求】
偏好描述：${input.description || '開放任何風格，偏自然體驗'}
天數：${input.days} 天
地區偏好：${regionStr}
美食偏好：${foodStr}

【選點規則】
1. id / name / lat / lng 必須完全對應清單資料，禁止自行新增清單外的景點
2. 每天安排 3–5 站，景點（A）與美食（F）交錯排列
3. 同天景點依地理動線合理排序，避免南北來回
4. closed 欄位代表公休日（0=日 1=一 2=二 … 6=六），選點時納入考量
5. 行程名稱需帶台東意境，10 字以內

嚴格以下方 JSON 格式回傳，不得含說明文字或 markdown 標記：
{
  "adventureName": "行程名稱",
  "days": [
    {
      "day": 1,
      "has_island": false,
      "stops": [
        {
          "id": "景點原始 id",
          "name": "景點名稱",
          "category": "attraction 或 food",
          "latitude": 緯度數字,
          "longitude": 經度數字,
          "stay_duration": 停留分鐘（60/90/120/180 擇一）,
          "tip": "一句路況或推薦提示（可空字串）",
          "closed_days": [公休日數字陣列]
        }
      ]
    }
  ]
}

【景點/美食清單】（格式：類型|id|name|lat|lng|tags|closed）
${catalog.slice(0, 14000)}
`.trim()

  // ── 3. 呼叫 Gemini 2.5 Flash Lite ─────────────────────────────────────────
  let raw: { adventureName: string; days: any[] }

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    })
    raw = JSON.parse(resp.text ?? '{}')
  } catch (err) {
    console.error('[generateAiItinerary] Gemini 失敗:', err)
    throw new Error('AI 行程生成失敗，請稍後再試')
  }

  if (!Array.isArray(raw?.days) || raw.days.length === 0) {
    throw new Error('AI 回傳格式有誤，請重新嘗試')
  }

  // ── 4. 轉換為 BuilderDay[]，注入日期 ─────────────────────────────────────
  const [y, m, d] = startDate.split('-').map(Number)
  const VALID_CATEGORIES = new Set(['attraction', 'food', 'accommodation', 'transport'])

  const builderDays: BuilderDay[] = raw.days.slice(0, input.days).map((aiDay, i) => {
    const date = getLocalYYYYMMDD(new Date(y, m - 1, d + i))

    const stops: CuratedStop[] = (Array.isArray(aiDay.stops) ? aiDay.stops : [])
      .map((s: any): CuratedStop | null => {
        const lat = typeof s.latitude  === 'number' ? s.latitude  : 0
        const lng = typeof s.longitude === 'number' ? s.longitude : 0
        if (!lat || !lng) return null
        return {
          id:            String(s.id || `ai-${i}-${Math.random().toString(36).slice(2, 7)}`),
          name:          String(s.name || '未知景點'),
          category:      VALID_CATEGORIES.has(s.category) ? s.category : 'attraction',
          latitude:      lat,
          longitude:     lng,
          stay_duration: typeof s.stay_duration === 'number' && s.stay_duration >= 15 ? s.stay_duration : 60,
          tip:           s.tip || undefined,
          closed_days:   Array.isArray(s.closed_days) ? s.closed_days : [],
        }
      })
      .filter(Boolean) as CuratedStop[]

    return {
      day:           i + 1,
      label:         `Day ${i + 1}`,
      has_island:    aiDay.has_island ?? false,
      stops,
      date,
      departureTime: '09:00',
    }
  })

  return {
    days:          builderDays,
    adventureName: raw.adventureName || 'AI 台東手札',
  }
}
