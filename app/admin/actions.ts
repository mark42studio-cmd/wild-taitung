'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase'
import {
  validate,
  TogglePublishedSchema,
  GeocodeAddressSchema,
  UpdateEventFieldsSchema,
  InsertPlaceSchema,
  InsertFoodSchema,
  DeleteEventSchema,
} from '@/lib/validation'

const sb = createServerClient

export async function togglePublished(id: string, current: boolean): Promise<void> {
  const { id: safeId } = validate(TogglePublishedSchema, { id, current });

  const { error } = await sb()
    .from('food')
    .select('id')
    .eq('id', safeId)
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/admin')
}

export async function geocodeAddress(address: string): Promise<{
  latitude: number
  longitude: number
  formatted: string
}> {
  const { address: safeAddress } = validate(GeocodeAddressSchema, { address });

  const key = process.env.GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(safeAddress)}&key=${key}`
  const res = await fetch(url)
  const json = await res.json()
  if (json.status !== 'OK' || !json.results?.[0]) {
    console.error('[geocodeAddress] Google API error:', json.status, json.error_message ?? '', '| query:', safeAddress)
    throw new Error(`找不到座標（${json.status}）：請嘗試更詳細的地址`)
  }
  const { lat, lng } = json.results[0].geometry.location
  return {
    latitude:  lat as number,
    longitude: lng as number,
    formatted: json.results[0].formatted_address as string,
  }
}

export async function updateEventFields(
  id: string,
  fields: {
    start_time?: string
    end_time?: string | null
    venue_name?: string
    latitude?: number
    longitude?: number
    image_captured?: string | null
  }
): Promise<void> {
  // .strict() Schema 確保 fields 只能包含白名單欄位，防止欄位注入
  const { id: safeId, fields: safeFields } = validate(UpdateEventFieldsSchema, { id, fields });
  const spotFields: Record<string, unknown> = {};
  if (safeFields.venue_name !== undefined) spotFields.name = safeFields.venue_name;
  if (safeFields.latitude !== undefined) spotFields.lat = safeFields.latitude;
  if (safeFields.longitude !== undefined) spotFields.lng = safeFields.longitude;

  if (Object.keys(spotFields).length === 0) {
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath(`/event/${safeId}`)
    return
  }

  const { data, error } = await sb()
    .from('food')
    .update(spotFields)
    .eq('id', safeId)
    .select('id')
  if (error) {
    console.error('[updateEventFields] Supabase error:', error.message, '| id:', safeId)
    throw new Error(error.message)
  }
  if (!data || data.length === 0) {
    console.error('[updateEventFields] 0 rows affected — RLS may be blocking the update | id:', safeId)
    throw new Error('更新失敗：無資料被更動，請至 Supabase 確認 RLS Policy 是否允許此操作')
  }
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath(`/event/${safeId}`)
}

export async function insertPlace(payload: Record<string, unknown>): Promise<void> {
  const safe = validate(InsertPlaceSchema, payload);

  const { error } = await sb().from('places').insert([{
    name:          safe.name,
    description:   safe.description ?? '',
    lat:           safe.latitude,
    lng:           safe.longitude,
    category:      safe.category ?? null,
    image_url:      safe.image_url || null,
    affiliate_link: safe.affiliate_url || null,
    wild_tags:      safe.vibe_tags ?? [],
  }])
  if (error) throw new Error(error.message)
  revalidatePath('/admin/places')
}

export async function insertFood(payload: Record<string, unknown>): Promise<void> {
  const safePayload = validate(InsertFoodSchema, payload);

  const { error } = await sb().from('food').insert([{
    name: safePayload.name,
    description: safePayload.description ?? '',
    lat: safePayload.latitude,
    lng: safePayload.longitude,
    type: 'food',
    category: 'city',
  }])
  if (error) throw new Error(error.message)
}

export async function deleteEvent(id: string): Promise<void> {
  const { id: safeId } = validate(DeleteEventSchema, { id });

  const { data, error } = await sb().from('food').delete().eq('id', safeId).select('id')
  if (error) {
    console.error('[deleteEvent] Supabase error:', error.message, '| id:', safeId)
    throw new Error(error.message)
  }
  if (!data || data.length === 0) {
    console.error('[deleteEvent] 0 rows affected — RLS may be blocking the delete | id:', safeId)
    throw new Error('刪除失敗：無資料被更動，請至 Supabase 確認 RLS Policy 是否允許此操作')
  }
  revalidatePath('/')
  revalidatePath('/admin')
}

// ── Spots ─────────────────────────────────────────────────────────────────────

export type PlaceRecord = {
  id: string
  name: string
  description?: string | null
  lat: number | null
  lng: number | null
  category?: string | null
  type?: string | null
  quote?: string | null
  safety_notes?: string | null
  image_url?: string | null
  affiliate_link?: string | null
  wild_tags?: string[] | null
  popularity?: number | null
}

export async function listPlaces(): Promise<PlaceRecord[]> {
  const { data, error } = await sb()
    .from('places')
    .select('id,name,description,lat,lng,category,type,quote,safety_notes,image_url,affiliate_link,wild_tags,popularity')
    .order('name', { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as PlaceRecord[]
}

export async function updatePlaceAffiliate(id: string, affiliate_url: string | null): Promise<void> {
  const { error } = await sb()
    .from('places')
    .update({ affiliate_link: affiliate_url })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/places')
}

// ── Affiliates ────────────────────────────────────────────────────────────────

export type AffiliateRecord = {
  id: string
  title: string
  description?: string | null
  link_url: string | null
  icon_emoji?: string | null
}

export async function listAffiliates(): Promise<AffiliateRecord[]> {
  const { data, error } = await sb()
    .from('affiliates')
    .select('id,title,description,link_url,icon_emoji')
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AffiliateRecord[]
}

// ── Spots for itinerary builder (id + name only) ──────────────────────────────

export type SpotSelectOption = { id: string; name: string; category: string | null }

export async function listSpotsForSelect(): Promise<SpotSelectOption[]> {
  const { data, error } = await sb()
    .from('places')
    .select('id,name,category')
    .order('name', { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as SpotSelectOption[]
}

// ── Food DB ───────────────────────────────────────────────────────────────────

export type FoodRecord = {
  id: string
  name: string
  description?: string | null
  lat: number | null
  lng: number | null
  category?: string | null
  type?: string | null
  image_url?: string | null
  safety_notes?: string | null
  wild_tags?: string[] | null
  popularity?: number | null
}

export async function listFoods(): Promise<FoodRecord[]> {
  const { data, error } = await sb()
    .from('food')
    .select('id,name,description,lat,lng,category,type,image_url,safety_notes,wild_tags,popularity')
    .order('name', { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as FoodRecord[]
}

// ── Affiliate Links ───────────────────────────────────────────────────────────

export type AffiliateLink = {
  id: string
  key: string
  label: string
  url: string | null
  icon: string
  is_active: boolean
}

export async function getAffiliateLinks(): Promise<AffiliateLink[]> {
  const { data, error } = await sb()
    .from('affiliate_links')
    .select('*')
    .order('key')
  if (error) throw new Error(error.message)
  return (data ?? []) as AffiliateLink[]
}

export async function upsertAffiliateLink(
  link: Omit<AffiliateLink, 'id'>
): Promise<void> {
  const { error } = await sb()
    .from('affiliate_links')
    .upsert([link], { onConflict: 'key' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}
