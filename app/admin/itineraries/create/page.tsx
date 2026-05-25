import { listSpotsForSelect } from '../../actions'
import CreateItineraryClient from './_client'

export const dynamic = 'force-dynamic'

export default async function CreateItineraryPage() {
  let spots: Awaited<ReturnType<typeof listSpotsForSelect>> = []
  try {
    spots = await listSpotsForSelect()
  } catch {
    // Supabase not reachable — client shows empty select
  }
  return <CreateItineraryClient spots={spots} />
}
