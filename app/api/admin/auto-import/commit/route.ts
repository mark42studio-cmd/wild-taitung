import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { ParsedItem } from '../route';

function mapPlacesCategory(cat: string): string {
  if (cat === '縱谷線') return 'valley';
  if (cat === '南迴線') return 'south';
  if (cat === '海線') return 'sea';
  return 'city';
}

function mapFoodCategory(cat: string): string {
  if (cat === '在地小吃') return 'local';
  if (cat === '特色風味') return 'specialty';
  if (cat === '甜點冰品') return 'dessert';
  if (cat === '咖啡茶飲') return 'coffee';
  return 'local';
}

export async function POST(req: Request) {
  try {
    const { items } = await req.json() as { items?: ParsedItem[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '請提供要寫入的資料' }, { status: 400 });
    }

    const supabase = createServerClient();
    const inserted: ParsedItem[] = [];
    const failed: (ParsedItem & { reason: string })[] = [];

    await Promise.all(
      items.map(async (item) => {
        const table = item.tableType === 'food' ? 'food' : 'places';
        const image_url = item.image_url?.trim() || null;

        let insertError: { message: string } | null = null;

        if (table === 'food') {
          const { error } = await supabase.from('food').insert({
            name: item.name,
            category: mapFoodCategory(item.category),
            description: item.quote || item.description,
            lat: item.lat ?? null,
            lng: item.lng ?? null,
            image_url,
            popularity: 0,
          });
          insertError = error;
        } else {
          const { error } = await supabase.from('places').insert({
            name: item.name,
            category: mapPlacesCategory(item.category),
            quote: item.quote,
            description: item.description,
            lat: item.lat ?? null,
            lng: item.lng ?? null,
            image_url,
            popularity: 0,
          });
          insertError = error;
        }
        if (insertError) {
          failed.push({ ...item, reason: `寫入失敗：${insertError.message}` });
        } else {
          inserted.push(item);
        }
      }),
    );

    return NextResponse.json({ inserted, failed });
  } catch (err) {
    console.error('[auto-import/commit]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
