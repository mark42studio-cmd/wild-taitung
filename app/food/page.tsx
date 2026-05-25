import { supabase } from '@/lib/supabase';
import MasonryGallery from '@/components/MasonryGallery';
import type { Metadata } from 'next';

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wild-taitung-assets/assets`;

function resolveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return `${STORAGE_BASE}/${raw}`;
}

export const metadata: Metadata = {
  title: '台東在地美食',
  description: '從南迴海鮮到池上便當，野台東美食地圖帶你深入台東最真實的味蕾記憶。',
};

export const revalidate = 3600;

export default async function FoodPage() {
  const { data: foods, error } = await supabase
    .from('food')
    .select('id, name, category, description, image_url, popularity')
    .order('popularity', { ascending: false, nullsFirst: false });

  if (error) console.error('[FoodPage] fetch error:', error.message);

  const items = (foods ?? []).map(f => ({
    id: String(f.id ?? ''),
    name: String(f.name ?? '（未命名）'),
    image_url: resolveUrl(f.image_url as string | null),
    rating: (f.popularity as number | null) ?? null,
    cuisine_type: (f.category as string | null) ?? null,
    price_range: null,
  }));

  return (
    <main className="min-h-screen px-4 py-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <p className="text-wild-ocean text-xs tracking-[0.2em] uppercase mb-2 font-sans">
          Wild Gallery · 美食
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-3">
          台東在地美食
        </h1>
        <p className="text-wild-mist text-sm max-w-prose leading-relaxed">
          從南迴公路的海鮮攤到池上的便當香，台東的味道永遠是最真實的旅行記憶。
        </p>
      </header>

      <MasonryGallery items={items} emptyMessage="美食資料準備中，敬請期待" />
    </main>
  );
}
