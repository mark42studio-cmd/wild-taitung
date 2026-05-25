/**
 * 野台東 Wild Taitung 統一輸入校驗 Schema（Zod）
 *
 * 所有 API Route 與 Server Action 在碰觸 Supabase 前，必須通過此處的 Schema 驗證。
 * 新增 API 端點時，請在此檔對應分區加入 Schema，並在端點中呼叫 validate()。
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// 原子型別（可組合到各 Schema 中）
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase 主鍵，必須為標準 UUID v4 格式 */
export const UuidSchema = z
  .string()
  .uuid('id 必須為合法 UUID');

/**
 * ISO 8601 timestamp（含時區，例：2026-04-20T10:00:00+08:00）
 * - 拒絕超過 40 字元的異常長字串（防止 buffer flooding）
 * - 拒絕包含 HTML/SQL 特殊字元的注入字串
 * - 最終以 Date.parse() 確認是合法時間值
 */
export const IsoTimestampSchema = z
  .string()
  .max(40, '時間字串超過長度限制')
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    '必須為 ISO 8601 格式（YYYY-MM-DDTHH:MM:SS…）'
  )
  .refine(s => !isNaN(Date.parse(s)), '非合法日期時間值');

/**
 * 純日期字串（YYYY-MM-DD）
 * 嚴格格式，拒絕任何帶有 HTML 標籤、SQL 關鍵字或額外字元的輸入。
 */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '必須為 YYYY-MM-DD 格式')
  .refine(s => !isNaN(Date.parse(s)), '非合法日期值');

/**
 * 短文字（搜尋關鍵字、標籤等）
 * - trim() 去除頭尾空白
 * - max(100) 防止超長輸入塞爆 API 查詢
 */
export const ShortStringSchema = z
  .string()
  .trim()
  .min(1, '不得為空')
  .max(100, '超過 100 字元限制');

/** 地址字串，允許較長但仍設上限 */
export const AddressSchema = z
  .string()
  .trim()
  .min(1, '地址不得為空')
  .max(200, '地址超過 200 字元上限');

/** 場館/活動名稱 */
export const VenueNameSchema = z
  .string()
  .trim()
  .min(1, '名稱不得為空')
  .max(100, '名稱超過 100 字元上限');

/** 圖片 URL（可為 null） */
export const ImageUrlSchema = z
  .string()
  .url('必須為合法 URL')
  .max(500, 'URL 超過長度限制')
  .nullable()
  .optional();

/** 緯度 */
export const LatitudeSchema = z
  .number()
  .min(-90, '緯度不得低於 -90')
  .max(90,  '緯度不得超過 90');

/** 經度 */
export const LongitudeSchema = z
  .number()
  .min(-180, '經度不得低於 -180')
  .max(180,  '經度不得超過 180');

// ─────────────────────────────────────────────────────────────────────────────
// API Route Schemas
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/places — Google Places 文字搜尋 */
export const PlacesQuerySchema = z.object({
  query: ShortStringSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Server Action Schemas
// ─────────────────────────────────────────────────────────────────────────────

/** togglePublished(id, current) */
export const TogglePublishedSchema = z.object({
  id:      UuidSchema,
  current: z.boolean(),
});

/** geocodeAddress(address) */
export const GeocodeAddressSchema = z.object({
  address: AddressSchema,
});

/**
 * updateEventFields(id, fields)
 * .strict() 確保無法透過 fields 注入未在白名單內的資料庫欄位。
 */
export const UpdateEventFieldsSchema = z.object({
  id: UuidSchema,
  fields: z.object({
    start_time:     IsoTimestampSchema.optional(),
    end_time:       IsoTimestampSchema.nullable().optional(),
    venue_name:     VenueNameSchema.optional(),
    latitude:       LatitudeSchema.optional(),
    longitude:      LongitudeSchema.optional(),
    image_captured: ImageUrlSchema,
  }).strict(),  // 拒絕白名單外的欄位，防止 DB 欄位注入
});

/**
 * insertPlace(payload) / insertFood(payload)
 * .strip() 靜默移除白名單外的欄位，避免未知欄位寫入 DB。
 */
const PlaceBaseSchema = z.object({
  name:              VenueNameSchema,
  latitude:          LatitudeSchema,
  longitude:         LongitudeSchema,
  vibe_tags:         z.array(z.string().trim().max(30)).max(10).optional(),
  image_url:         z.string().url().max(500).optional().or(z.literal('')),
  description:       z.string().trim().max(1000).optional(),
  cuisine_type:      z.string().trim().max(50).optional(),
  price_range:       z.string().trim().max(20).optional(),
  affiliate_url:     z.string().max(2000).optional().or(z.literal('')),
});

export const InsertPlaceSchema = PlaceBaseSchema.extend({
  category: z.string().trim().max(50).optional(),
});
export const InsertFoodSchema  = PlaceBaseSchema;

/**
 * insertSpot(payload) — writes to `spots` table
 * Includes stay_duration, closed_days, category beyond the base schema.
 */
export const InsertSpotSchema = z.object({
  name:          VenueNameSchema,
  latitude:      LatitudeSchema,
  longitude:     LongitudeSchema,
  category:      z.enum(['attraction', 'hidden', 'mountain', 'ocean', 'spring', 'cultural', 'food']).optional(),
  stay_duration: z.number().int().min(5).max(1440).optional(),
  closed_days:   z.array(z.number().int().min(0).max(6)).max(7).optional(),
  description:   z.string().trim().max(1000).optional(),
  image_url:     z.string().url().max(500).optional().or(z.literal('')),
  affiliate_url: z.string().url().max(500).optional().or(z.literal('')),
  affiliate_id:  z.string().uuid().optional().or(z.literal('')),
  vibe_tags:     z.array(z.string().trim().max(30)).max(10).optional(),
}).strip();

/** deleteEvent(id) */
export const DeleteEventSchema = z.object({
  id: UuidSchema,
});

/** submitEvent(payload) — 使用者活動上架申請 */
export const SubmitEventSchema = z.object({
  name:        z.string().trim().min(1, '活動名稱不得為空').max(100),
  category:    z.enum(['food', 'spot']).default('spot'),
  time:        z.string().trim().min(1, '時間不得為空').max(200),
  location:    z.string().trim().min(1, '地點不得為空').max(200),
  description: z.string().trim().min(1, '活動介紹不得為空').max(2000),
  image_url:   z.string().trim().max(500).optional().or(z.literal('')),
  comments:    z.string().trim().max(1000).optional().or(z.literal('')),
});

/** submitSpotUgc — 玩家投稿秘境景點 */
export const SubmitSpotUgcSchema = z.object({
  name:      z.string().trim().min(1, '景點名稱不得為空').max(100),
  route:     z.enum(['縱谷線', '南迴線', '海線', '市區']),
  quote:     z.string().trim().max(40).optional().or(z.literal('')),
  guide:     z.string().trim().max(2000).optional().or(z.literal('')),
  tags:      z.string().trim().max(300).optional().or(z.literal('')),
  image_url: z.string().url().max(500).nullable().optional(),
  email:     z.string().email('請輸入有效的 Email 格式').optional().or(z.literal('')),
});

/** submitFoodUgc — 店家自主上架美食 */
export const SubmitFoodUgcSchema = z.object({
  name:      z.string().trim().min(1, '店名不得為空').max(100),
  route:     z.enum(['縱谷線', '南迴線', '海線', '市區']),
  food_cat:  z.enum(['在地小吃', '特色風味', '甜點冰品', '咖啡茶飲']),
  quote:     z.string().trim().max(40).optional().or(z.literal('')),
  desc:      z.string().trim().max(2000).optional().or(z.literal('')),
  image_url: z.string().url().max(500).nullable().optional(),
  email:     z.string().email('請輸入有效的 Email 格式').optional().or(z.literal('')),
});

/** approveSubmission overrides — 主理人在審核彈窗補齊或修改的欄位 */
export const ApproveOverridesSchema = z.object({
  name:        z.string().trim().min(1, '名稱不得為空').max(100),
  description: z.string().trim().max(2000).nullable(),
  image_url:   z.string().url('圖片須為合法 URL').max(500).nullable(),
  quote:       z.string().trim().max(40).nullable(),
  tags:        z.array(z.string().trim().max(30)).max(10),
  lat:         z.number().min(-90, '緯度不得低於 -90').max(90, '緯度不得超過 90').nullable().optional(),
  lng:         z.number().min(-180, '經度不得低於 -180').max(180, '經度不得超過 180').nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server Action 專用驗證器。
 *
 * 通過回傳 parsed data（unwrapped）；
 * 失敗拋出 Error，訊息僅包含欄位名稱與規則描述，不洩漏 stack trace。
 *
 * 使用範例：
 *   const { id } = validate(DeleteEventSchema, { id });
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`輸入資料驗證失敗 — ${messages}`);
  }
  return result.data;
}

/**
 * API Route 專用：回傳 { ok, data } 或 { ok, error, status }。
 * 呼叫端可直接對 ok 做 if/else，保持 handler 乾淨。
 */
export function parseRequest<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: string; status: 400 } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { ok: false, error: messages, status: 400 };
  }
  return { ok: true, data: result.data };
}
