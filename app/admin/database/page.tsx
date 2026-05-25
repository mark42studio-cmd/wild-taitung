import { createClient } from '@supabase/supabase-js';
import EventBrowser from '@/components/EventBrowser';
import type { Event, Food } from '@/types';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function foodToEvent(spot: Food): Event | null {
  const latitude = Number.parseFloat(String(spot.lat ?? spot.latitude ?? ''));
  const longitude = Number.parseFloat(String(spot.lng ?? spot.longitude ?? ''));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const placeType = spot.type ?? 'spot';
  const category = spot.category === 'rail' || spot.category === 'sea' || spot.category === 'city' || spot.category === 'mtn' || spot.category === 'islands'
    ? spot.category
    : placeType === 'food' ? 'city' : 'mtn';

  return {
    id:               spot.id,
    title:            spot.name,
    description:      spot.description ?? '',
    long_description: spot.safety_notes ?? undefined,
    safety_notes:     spot.safety_notes ?? undefined,
    venue_name:       spot.name,
    latitude,
    longitude,
    category,
    place_type:       placeType,
    vibe_tags:        placeType === 'food' ? ['美食', '市區'] : ['山線', '秘境'],
    start_time:       '2020-01-01T00:00:00+08:00',
    end_date:         '2099-12-31',
    is_free:          true,
    weather_resilience: 1,
    affiliate_links: {
      rental:        { label: '租車/租機車', url: null },
      ticket:        { label: '售票連結',   url: null },
      accommodation: { label: '周邊住宿',   url: null },
    },
  };
}

export default async function Home() {
  const { data: foods, error } = await supabase
    .from('food')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[野台東] food fetch error:', error.message);
    return <div className="p-10 text-red-500">哎呀，載入景點失敗了：{error.message}</div>;
  }

  const events = (foods ?? [])
    .map((spot) => foodToEvent(spot as Food))
    .filter((event): event is Event => event !== null);

  return (
    <main className="h-screen overflow-hidden">
      <EventBrowser initialEvents={events} />
    </main>
  );
}
