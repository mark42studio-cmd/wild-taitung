'use server'

import { createServerClient } from '@/lib/supabase'
import { validate, SubmitSpotUgcSchema, SubmitFoodUgcSchema } from '@/lib/validation'


const sb = createServerClient

export async function submitSpotUgc(payload: {
  name: string
  route: string
  quote?: string
  guide?: string
  tags?: string
  email?: string
  image_url: string | null
}): Promise<{ error?: string }> {
  const safe = validate(SubmitSpotUgcSchema, payload)

  const { error } = await sb()
    .from('pending_events')
    .insert([{
      name:        safe.name,
      type:        'attraction',
      category:    'spot',
      time:        null,
      location:    safe.route,
      description: safe.guide || null,
      image_url:   safe.image_url ?? null,
      email:       safe.email || null,
      comments:    JSON.stringify({
        quote: safe.quote || null,
        tags:  safe.tags
          ? safe.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [],
      }),
      status: 'pending',
    }])

  if (error) return { error: error.message }
  return {}
}

export async function submitFoodUgc(payload: {
  name: string
  route: string
  food_cat: string
  quote?: string
  desc?: string
  email?: string
  image_url: string | null
}): Promise<{ error?: string }> {
  const safe = validate(SubmitFoodUgcSchema, payload)

  const { error } = await sb()
    .from('pending_events')
    .insert([{
      name:        safe.name,
      type:        'food',
      category:    'food',
      time:        null,
      location:    safe.route,
      description: safe.desc || null,
      image_url:   safe.image_url ?? null,
      email:       safe.email || null,
      comments:    JSON.stringify({
        food_category: safe.food_cat,
        quote:         safe.quote || null,
      }),
      status: 'pending',
    }])

  if (error) return { error: error.message }
  return {}
}
