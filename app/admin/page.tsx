import { createClient } from '@supabase/supabase-js'
import AdminClient, { type AdminEvent } from './AdminClient'

// 每次進入後台都取最新資料，不做靜態快取
export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function AdminPage() {
  const [{ data: foods, error }, { count: pendingCount }] = await Promise.all([
    supabase.from('food').select('*').order('name', { ascending: true }),
    supabase
      .from('pending_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">
        無法載入景點資料：{error.message}
      </div>
    )
  }

  const events: AdminEvent[] = (foods ?? []).map((spot: any) => ({
    id: spot.id,
    title: spot.name,
    start_time: spot.created_at ?? new Date().toISOString(),
    end_time: null,
    venue_name: spot.name,
    latitude: Number.parseFloat(String(spot.lat ?? spot.latitude ?? '')) || null,
    longitude: Number.parseFloat(String(spot.lng ?? spot.longitude ?? '')) || null,
    is_published: true,
    image_captured: null,
  }))

  return (
    <main className="min-h-screen bg-[#F5F5DC]">
      <AdminClient initialEvents={events} initialPendingCount={pendingCount ?? 0} />
    </main>
  )
}
