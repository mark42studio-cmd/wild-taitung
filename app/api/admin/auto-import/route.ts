import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createServerClient } from '@/lib/supabase';

const MODEL = 'gemini-2.5-flash';

const PARSE_PROMPT = `你是一位在台東生活多年的獨立選物編輯，具備當代文化與空間美學素養，習慣用第一人稱的日記語氣觀察在地日常。你的任務是從以下破碎文字中提取地點資訊，並回傳**純 JSON 陣列**（不加任何 markdown code fence 或說明文字，直接輸出 [ ... ]）。

【寫作禁忌】絕對禁止使用下列詞彙與句型：
- 「融合…風情」「不可錯過」「複合式空間」「讓人流連忘返」「別具一格」「悠閒氛圍」「隱藏版」「打卡勝地」「獨特體驗」「必訪」
- 任何以「這裡」開頭再接形容詞的句型
- 任何以「是一個…的地方」結尾的句型

每個物件需包含以下欄位：
1. "name": string — 地點或店家名稱（保留原文）
2. "tableType": "places" | "food" — 自然景點/藝文空間/秘境填 "places"，餐廳/咖啡/甜點/店家填 "food"
3. "category": string
   - 若 tableType 為 "places"：填 "縱谷線" | "南迴線" | "海線" | "市區"
   - 若 tableType 為 "food"：填 "在地小吃" | "特色風味" | "甜點冰品" | "咖啡茶飲"
4. "description": string — 帶有具體細節的場所描述，2–3句話。必須包含至少一個具體事實（如：選書策展方向、手沖豆款產區、建築材質、景觀方位、食材來源、座位數量規模等），不寫泛泛的氣氛形容。
5. "quote": string — 一句 25 字以內的風格標語，像是隨手寫在日記扉頁的句子，帶有明確的感知對象（光線、氣味、聲音、觸感），而非情緒宣告。
6. "lat": number | null — 盡可能提供準確的緯度（台東地區約 22.3~23.3）
7. "lng": number | null — 盡可能提供準確的經度（台東地區約 120.8~121.5）

若文字中找不到任何地點，回傳空陣列 []。`;

export type ParsedItem = {
  name: string;
  tableType: 'places' | 'food';
  category: string;
  description: string;
  quote: string;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
};

export async function POST(req: Request) {
  try {
    const { rawText } = await req.json() as { rawText?: string };
    if (!rawText?.trim()) {
      return NextResponse.json({ error: '請提供原始文字' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `${PARSE_PROMPT}\n\n---\n\n${rawText}`,
    });

    const rawOutput = response.text ?? '';
    const jsonStr = rawOutput
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    let items: ParsedItem[];
    try {
      const candidate = JSON.parse(jsonStr);
      if (!Array.isArray(candidate)) throw new Error('not array');
      items = (candidate as ParsedItem[]).map(i => ({ ...i, image_url: i.image_url ?? null }));
    } catch {
      return NextResponse.json(
        { error: 'AI 解析失敗：回傳格式不正確，請重試', rawOutput },
        { status: 422 },
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ newItems: [], duplicateItems: [], message: 'AI 未能從文字中識別出任何地點' });
    }

    // ── 解析後立即去重：批次查詢兩張表 ──────────────────────────────────
    const supabase = createServerClient();
    const names = items.map(i => i.name);

    const [{ data: existingPlaces }, { data: existingFoods }] = await Promise.all([
      supabase.from('places').select('name').in('name', names),
      supabase.from('food').select('name').in('name', names),
    ]);

    const existingNames = new Set([
      ...(existingPlaces ?? []).map(r => r.name as string),
      ...(existingFoods ?? []).map(r => r.name as string),
    ]);

    const newItems = items.filter(i => !existingNames.has(i.name));
    const duplicateItems = items.filter(i => existingNames.has(i.name));

    return NextResponse.json({ newItems, duplicateItems });
  } catch (err) {
    console.error('[auto-import/parse]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
