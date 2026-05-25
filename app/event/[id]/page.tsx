import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Event, Food } from '@/types';

// 景點詳細頁：總是從 DB 即時讀取，不做靜態快取
export const dynamic = 'force-dynamic';
import { ArrowLeft, ExternalLink, Ticket, Car, BedDouble, Link2, Backpack, ShoppingBag } from 'lucide-react';
import AddItineraryButton from '@/components/AddItineraryButton';
import EventMapWrapper from '@/components/EventMapWrapper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function foodToEvent(spot: Food): Event {
  const latitude = Number.parseFloat(String(spot.lat ?? spot.latitude ?? ''));
  const longitude = Number.parseFloat(String(spot.lng ?? spot.longitude ?? ''));
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
    latitude:         Number.isFinite(latitude) ? latitude : undefined,
    longitude:        Number.isFinite(longitude) ? longitude : undefined,
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

/** opening_hours JSON 陣列取第一筆 */
function firstOpeningHour(raw: string): string {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : raw;
  } catch { return raw; }
}

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const { data: spot, error } = await supabase
    .from('food')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !spot) {
    notFound();
  }

  const event = foodToEvent(spot as Food);

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 fixed top-0 w-full z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 font-bold text-sm">
            <ArrowLeft size={18} /> 返回首頁
          </Link>
        </div>
      </header>

      <section className="relative w-full h-[50vh] min-h-[400px] pt-16">
        {event.image_captured ? (
          <Image
            src={event.image_captured}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1B2E26] to-[#1e4a5f] flex items-center justify-center">
            <span className="text-white/25 font-bold text-xl tracking-widest">野台東 Wild Taitung</span>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 md:p-12 pb-16">
          <div className="max-w-5xl mx-auto w-full">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 leading-tight drop-shadow-lg">
              {event.title}
            </h1>
            <p className="text-white/90 text-lg font-medium drop-shadow-md">
              {event.opening_hours ? firstOpeningHour(event.opening_hours) : '全年開放'}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 -mt-10">
        
        <div className="md:col-span-2 space-y-8">
          <section className="flex flex-wrap gap-3 bg-white p-6 rounded-2xl shadow-sm">
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${event.is_free ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {event.is_free ? '免費參加' : '付費活動'}
            </span>
            

{event.vibe_tags?.map((tag: string) => (
              <span key={tag} className="px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                #{tag.replace(/^#+/, '')}
              </span>
            ))}
          </section>

          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              景點介紹
            </h2>
            <div className="text-gray-600 leading-relaxed whitespace-pre-wrap text-lg">
              {event.long_description || event.description || '目前暫無詳細介紹。'}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
            
            <div className="mb-6 space-y-3">
              <AddItineraryButton event={event} />
              
              {event.ticket_url && (
                <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-colors shadow-sm">
                  <Ticket size={18} /> 前往購票 / 報名
                </a>
              )}
              
              {event.source_url && (
                <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-600 py-3 rounded-xl font-bold transition-colors border border-gray-200">
                  <ExternalLink size={18} /> 官方網站
                </a>
              )}
            </div>

            <hr className="my-6 border-gray-100" />

            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">活動地點</h2>
            <p className="text-gray-800 font-bold mb-4 text-lg">{event.venue_name}</p>
            
            <div className="w-full h-56 rounded-xl overflow-hidden border border-gray-200 shadow-inner">
              <EventMapWrapper event={event} />
            </div>
            
            <div className="mt-4 text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded text-center">
              GPS: {event.latitude}, {event.longitude}
            </div>

            {/* 建議裝備（預留分潤區塊） */}
            {event.gear_items && Array.isArray(event.gear_items) && event.gear_items.length > 0 && (
              <>
                <hr className="my-6 border-gray-100" />
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Backpack size={14} /> 建議裝備
                </h2>
                <div className="flex flex-col gap-2">
                  {(event.gear_items as Array<{ label: string; url: string | null; desc?: string }>).map((item, i) => (
                    item.url ? (
                      <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                         className="w-full flex items-center gap-3 bg-[#1B2E26]/5 hover:bg-[#1B2E26]/10 text-[#1B2E26] px-4 py-3 rounded-xl font-bold text-sm transition-colors border border-[#1B2E26]/10">
                        <ShoppingBag size={16} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.desc && <span className="text-xs text-gray-400 font-normal">{item.desc}</span>}
                      </a>
                    ) : (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 text-gray-500 px-4 py-3 rounded-xl text-sm border border-gray-100">
                        <ShoppingBag size={16} className="shrink-0" />{item.label}
                        {item.desc && <span className="ml-auto text-xs text-gray-400">{item.desc}</span>}
                      </div>
                    )
                  ))}
                </div>
              </>
            )}

            {/* 行程周邊（分潤連結） — 只要有任一 url 才顯示整個區塊 */}
            {event.affiliate_links && (event.affiliate_links.rental.url || event.affiliate_links.ticket.url || event.affiliate_links.accommodation.url) && (
              <>
                <hr className="my-6 border-gray-100" />
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">行程周邊</h2>
                <div className="flex flex-col gap-2">
                  {event.affiliate_links.rental.url && (
                    <a
                      href={event.affiliate_links.rental.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 bg-sky-50 hover:bg-sky-100 text-sky-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors border border-sky-100"
                    >
                      <Car size={16} className="shrink-0" />
                      {event.affiliate_links.rental.label}
                    </a>
                  )}
                  {event.affiliate_links.ticket.url && (
                    <a
                      href={event.affiliate_links.ticket.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors border border-amber-100"
                    >
                      <Link2 size={16} className="shrink-0" />
                      {event.affiliate_links.ticket.label}
                    </a>
                  )}
                  {event.affiliate_links.accommodation.url && (
                    <a
                      href={event.affiliate_links.accommodation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors border border-purple-100"
                    >
                      <BedDouble size={16} className="shrink-0" />
                      {event.affiliate_links.accommodation.label}
                    </a>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

      </div>
    </main>
  );
}
