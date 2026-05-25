import { createServerClient } from '@/lib/supabase'
import SubmissionsClient from './SubmissionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SubmissionsPage() {
  const { data, error } = await createServerClient()
    .from('pending_events')
    .select('id, type, name, category, description, image_url, status, created_at, time, location, comments, email')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center font-bold text-red-500">
        無法載入投稿資料：{error.message}
      </div>
    )
  }

  return <SubmissionsClient items={data ?? []} />
}
