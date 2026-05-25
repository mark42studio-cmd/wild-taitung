'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase'
import { validate, UuidSchema, ApproveOverridesSchema } from '@/lib/validation'

const ROUTE_TO_CAT: Record<string, string> = {
  縱谷線: 'mtn',
  南迴線: 'south',
  海線:   'sea',
  市區:   'city',
}

type ApproveOverrides = {
  name: string
  description: string | null
  image_url: string | null
  quote: string | null
  tags: string[]
}

export async function approveSubmission(
  id: string,
  overrides: ApproveOverrides,
): Promise<{ error?: string }> {
  const safeId = validate(UuidSchema, id)
  const safeOverrides = validate(ApproveOverridesSchema, overrides)
  const sb = createServerClient()

  const { data: row, error: fetchErr } = await sb
    .from('pending_events')
    .select('category, location')
    .eq('id', safeId)
    .single()
  if (fetchErr || !row) return { error: '找不到申請記錄' }

  const dbCategory = ROUTE_TO_CAT[row.location as string] ?? 'city'

  if ((row.category as string) === 'spot') {
    const { error: insertErr } = await sb
      .from('places')
      .insert([{
        name:        safeOverrides.name,
        description: safeOverrides.description || null,
        quote:       safeOverrides.quote || null,
        wild_tags:   safeOverrides.tags,
        category:    dbCategory,
        image_url:   safeOverrides.image_url || null,
        popularity:  0,
      }])
    if (insertErr) return { error: insertErr.message }
  } else {
    const { error: insertErr } = await sb
      .from('food')
      .insert([{
        name:        safeOverrides.name,
        description: safeOverrides.description || null,
        category:    dbCategory,
        image_url:   safeOverrides.image_url || null,
        wild_tags:   safeOverrides.tags,
        popularity:  0,
      }])
    if (insertErr) return { error: insertErr.message }
  }

  await sb.from('pending_events').update({ status: 'approved' }).eq('id', safeId)
  revalidatePath('/admin/submissions')
  revalidatePath('/')
  return {}
}

export async function rejectSubmission(id: string): Promise<{ error?: string }> {
  const safeId = validate(UuidSchema, id)
  const { error } = await createServerClient()
    .from('pending_events')
    .update({ status: 'rejected' })
    .eq('id', safeId)
  if (error) return { error: error.message }
  revalidatePath('/admin/submissions')
  return {}
}
