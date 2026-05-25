import { supabase } from '@/lib/supabase';
import MasonryGallery from '@/components/MasonryGallery';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '台東秘境景點',
  description: '探索台東隱藏景點、野溪溫泉與自然秘境，以復古水彩影像呈現每一處山林海岸。',
};

// Supabase Storage bucket 名稱，若不同請調整
const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wild-taitung-assets/assets`;

function resolveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return `${STORAGE_BASE}/${raw}`;
}

export default async function PlacesPage() {
  const { data: spots, error } = await supabase
    .from('places')
    .select('id, name, description, image_url, lat, lng, wild_tags')
    .order('name', { ascending: true });

  console.log('[PlacesPage] spots count:', spots?.length ?? 0, '| error:', error?.message ?? null);
  if (error) console.error('[PlacesPage] fetch error:', error.message);

  const items = (spots ?? []).map(p => ({
    id: String(p.id ?? ''),
    name: String(p.name ?? '（未命名）'),
    description: (p.description as string | null) ?? null,
    image_url: resolveUrl(p.image_url as string | null),
  }));

  return (
    <main className="min-h-screen px-4 py-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <p className="text-wild-ocean text-xs tracking-[0.2em] uppercase mb-2 font-sans">
          Wild Gallery · 景點
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-3">
          台東秘境景點
        </h1>
        <p className="text-wild-mist text-sm max-w-prose leading-relaxed">
          每一處山林、海岸與溫泉，都是一場與大自然的對話。
        </p>
      </header>

      {/* FALLBACK TEST — 確認資料能渲染後移除 */}
      <pre className="text-xs text-wild-mist overflow-auto max-h-[80vh] p-4 bg-[#0e1c15] rounded">
        {JSON.stringify(spots, null, 2)}
      </pre>
      {/* <MasonryGallery items={items} emptyMessage="景點資料準備中，敬請期待" /> */}
    </main>
  );
}
